/* eslint-disable react-hooks/immutability -- Expo Audio configures each native player's own volume property. */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { preload, setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { AccessibilityInfo, Platform } from 'react-native';
import { useAppStore } from '../state/useAppStore';
import { isSoundReady } from './feedbackTiming';
import { type FeedbackSound, SoundFeedbackContext } from './useSoundFeedback';
import { playWebFeedback } from './webFeedback';

const sources = {
  tick: require('../assets/sounds/tick.wav'),
  tap: require('../assets/sounds/tap.wav'),
  confirm: require('../assets/sounds/confirm.wav'),
};

void Promise.all(Object.values(sources).map((source) => preload(source))).catch(() => {});

const durations = { tick: 80, tap: 100, confirm: 200 } as const;

export function SoundFeedbackProvider({ children }: { children: ReactNode }) {
  const enabled = useAppStore((state) => state.soundFeedbackEnabled);
  const tick = useAudioPlayer(sources.tick);
  const tap = useAudioPlayer(sources.tap);
  const confirm = useAudioPlayer(sources.confirm);
  const [configured, setConfigured] = useState(false);
  const [screenReader, setScreenReader] = useState(Platform.OS !== 'web');
  const screenReaderRef = useRef(Platform.OS !== 'web');
  const activePlayer = useRef<AudioPlayer | null>(null);
  const activeSound = useRef<FeedbackSound | null>(null);
  const busyUntil = useRef(0);
  const requestId = useRef(0);

  useEffect(() => {
    tick.volume = 0.65;
    tap.volume = 0.75;
    confirm.volume = 0.35;
  }, [tick, tap, confirm]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setScreenReader(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    screenReaderRef.current = screenReader;
    if (screenReader) {
      requestId.current++;
      activePlayer.current?.pause();
    }
  }, [screenReader]);

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      requestId.current++;
      activePlayer.current?.pause();
      return;
    }
    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
    }).then(() => {
      if (mounted) setConfigured(true);
    }).catch(() => {
      if (mounted) setConfigured(false);
    });
    return () => { mounted = false; };
  }, [enabled]);

  const play = useCallback((sound: FeedbackSound) => {
    if (!enabled || screenReader || (Platform.OS !== 'web' && !configured)) return;
    const now = Date.now();
    if (!isSoundReady(sound, activeSound.current, busyUntil.current, now)) return;
    if (Platform.OS === 'web') {
      activeSound.current = sound;
      busyUntil.current = now + durations[sound];
      playWebFeedback(sound);
      return;
    }
    const player = sound === 'tick' ? tick : sound === 'tap' ? tap : confirm;
    if (!player.isLoaded) return;
    activePlayer.current?.pause();
    activePlayer.current = player;
    activeSound.current = sound;
    busyUntil.current = now + durations[sound];
    const request = ++requestId.current;
    void player.seekTo(0).then(() => {
      if (request === requestId.current && useAppStore.getState().soundFeedbackEnabled && !screenReaderRef.current) player.play();
    }).catch(() => {});
  }, [enabled, configured, screenReader, tick, tap, confirm]);

  return <SoundFeedbackContext.Provider value={play}>{children}</SoundFeedbackContext.Provider>;
}
