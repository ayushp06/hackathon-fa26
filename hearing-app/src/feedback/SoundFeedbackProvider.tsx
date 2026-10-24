/* eslint-disable react-hooks/immutability -- Expo Audio configures each native player's own volume property. */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { preload, setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { AccessibilityInfo } from 'react-native';
import { useFeedbackSettings } from '../state/useFeedbackSettings';
import { type FeedbackSound, SoundFeedbackContext } from './useSoundFeedback';

const sources = {
  tick: require('../assets/sounds/tick.wav'),
  tap: require('../assets/sounds/tap.wav'),
  confirm: require('../assets/sounds/confirm.wav'),
};

void Promise.all(Object.values(sources).map((source) => preload(source))).catch(() => {});

const durations = { tick: 80, tap: 100, confirm: 200 } as const;

export function SoundFeedbackProvider({ children }: { children: ReactNode }) {
  const enabled = useFeedbackSettings((state) => state.soundEnabled);
  const tick = useAudioPlayer(sources.tick);
  const tap = useAudioPlayer(sources.tap);
  const confirm = useAudioPlayer(sources.confirm);
  const [configured, setConfigured] = useState(false);
  const [screenReader, setScreenReader] = useState(true);
  const screenReaderRef = useRef(true);
  const activePlayer = useRef<AudioPlayer | null>(null);
  const busyUntil = useRef(0);

  useEffect(() => {
    tick.volume = 0.18;
    tap.volume = 0.18;
    confirm.volume = 0.18;
  }, [tick, tap, confirm]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setScreenReader(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    screenReaderRef.current = screenReader;
    if (screenReader) activePlayer.current?.pause();
  }, [screenReader]);

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
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
    if (!enabled || !configured || screenReader) return;
    const now = Date.now();
    if (sound !== 'confirm' && now < busyUntil.current) return;
    const player = sound === 'tick' ? tick : sound === 'tap' ? tap : confirm;
    if (!player.isLoaded) return;
    activePlayer.current?.pause();
    activePlayer.current = player;
    busyUntil.current = now + durations[sound];
    void player.seekTo(0).then(() => {
      if (activePlayer.current === player && useFeedbackSettings.getState().soundEnabled && !screenReaderRef.current) player.play();
    }).catch(() => {});
  }, [enabled, configured, screenReader, tick, tap, confirm]);

  return <SoundFeedbackContext.Provider value={play}>{children}</SoundFeedbackContext.Provider>;
}
