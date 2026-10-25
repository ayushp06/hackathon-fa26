/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- Native audio and route state must stop playback as soon as the route changes. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { createTonePlan, finishToneTest, referenceGain, type TonePresentation, type ToneTestResult } from '../hearingTest/toneTest';
import { useWiredHeadphones } from '../hearingTest/useWiredHeadphones';
import { useAppStore } from '../state/useAppStore';

type Phase = 'setup' | 'comfort' | 'running' | 'paused' | 'complete';
type ActivePresentation = { playedAt: string; trialIndex: number };

export function HearingTestScreen({ onContinue, onExit }: { onContinue: () => void; onExit: () => void }) {
  const haptics = useHaptics();
  const headphones = useWiredHeadphones();
  const { connected, available, refresh } = headphones;
  const saveResult = useAppStore((state) => state.saveHearingTestResult);
  const [backgroundNoise, setBackgroundNoise] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<ToneTestResult['mode']>('audio');
  const [trialIndex, setTrialIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const [toneActive, setToneActive] = useState(false);
  const [comfortPlayed, setComfortPlayed] = useState(false);
  const [result, setResult] = useState<ToneTestResult | null>(null);
  const [error, setError] = useState('');
  const active = useRef<ActivePresentation | null>(null);
  const presentations = useRef<TonePresentation[]>([]);
  const comfortTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plan = useMemo(() => createTonePlan(backgroundNoise), [backgroundNoise]);

  const clear500 = useAudioPlayer(require('../assets/sounds/test-500.wav'));
  const clear1000 = useAudioPlayer(require('../assets/sounds/test-1000.wav'));
  const clear2000 = useAudioPlayer(require('../assets/sounds/test-2000.wav'));
  const clear4000 = useAudioPlayer(require('../assets/sounds/test-4000.wav'));
  const noise500 = useAudioPlayer(require('../assets/sounds/test-noise-500.wav'));
  const noise1000 = useAudioPlayer(require('../assets/sounds/test-noise-1000.wav'));
  const noise2000 = useAudioPlayer(require('../assets/sounds/test-noise-2000.wav'));
  const noise4000 = useAudioPlayer(require('../assets/sounds/test-noise-4000.wav'));
  const clear500Ready = useAudioPlayerStatus(clear500).isLoaded;
  const clear1000Ready = useAudioPlayerStatus(clear1000).isLoaded;
  const clear2000Ready = useAudioPlayerStatus(clear2000).isLoaded;
  const clear4000Ready = useAudioPlayerStatus(clear4000).isLoaded;
  const noise500Ready = useAudioPlayerStatus(noise500).isLoaded;
  const noise1000Ready = useAudioPlayerStatus(noise1000).isLoaded;
  const noise2000Ready = useAudioPlayerStatus(noise2000).isLoaded;
  const noise4000Ready = useAudioPlayerStatus(noise4000).isLoaded;
  const ready = clear500Ready && clear1000Ready && clear2000Ready && clear4000Ready
    && noise500Ready && noise1000Ready && noise2000Ready && noise4000Ready;
  const players = useMemo(() => ({
    quiet: [clear500, clear1000, clear2000, clear4000],
    background_noise: [noise500, noise1000, noise2000, noise4000],
  }), [clear500, clear1000, clear2000, clear4000, noise500, noise1000, noise2000, noise4000]);

  useEffect(() => () => {
    if (comfortTimer.current) clearTimeout(comfortTimer.current);
    Object.values(players).flat().forEach((player) => player.pause());
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
  }, [players]);

  const finishPresentation = useCallback((heardAt: string | null) => {
    const current = active.current;
    if (!current || current.trialIndex !== trialIndex) return;
    active.current = null;
    presentations.current.push({ ...plan[trialIndex], trialIndex, playedAt: current.playedAt, heardAt, endedAt: new Date().toISOString(), interrupted: false });
    setToneActive(false);
    if (trialIndex === plan.length - 1) {
      const completed = finishToneTest(mode, plan, [...presentations.current]);
      saveResult(completed);
      setResult(completed);
      setPhase('complete');
    } else setTrialIndex(trialIndex + 1);
  }, [trialIndex, plan, mode, saveResult]);

  useEffect(() => {
    if (phase === 'complete') haptics.success();
    // Only the transition to complete should produce a success cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const interruptPresentation = useCallback(() => {
    const current = active.current;
    if (current) {
      presentations.current.push({ ...plan[current.trialIndex], trialIndex: current.trialIndex, playedAt: current.playedAt, heardAt: null, endedAt: new Date().toISOString(), interrupted: true });
      active.current = null;
    }
    setToneActive(false);
  }, [plan]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (mode === 'audio' && !refresh()) {
      setPhase('paused');
      setError('Wired headphones are required. Reconnect them to resume.');
      return;
    }
    const trial = plan[trialIndex];
    const player = players[trial.scenario][trial.frequencyHz === 500 ? 0 : trial.frequencyHz === 1000 ? 1 : trial.frequencyHz === 2000 ? 2 : 3];
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let verification: ReturnType<typeof setTimeout> | null = null;
    const begin = () => {
      if (!live || (mode === 'audio' && !refresh())) {
        setPhase('paused');
        setError('Wired headphones are required. Reconnect them to resume.');
        return;
      }
      const playedAt = new Date().toISOString();
      const beginResponseWindow = () => {
        if (!live) return;
        active.current = { playedAt, trialIndex };
        setToneActive(true);
        timer = setTimeout(() => finishPresentation(null), 2000);
      };
      if (mode === 'audio') {
        player.play();
        verification = setTimeout(() => {
          if (!live) return;
          if (!player.playing || !refresh()) {
            player.pause();
            setPhase('paused');
            setError('Tone playback could not be verified. Check the wired connection and repeat.');
          } else beginResponseWindow();
        }, 180);
      } else beginResponseWindow();
    };
    if (mode === 'audio') {
      player.volume = trial.playerGain;
      void player.seekTo(0).then(begin).catch(() => { setPhase('paused'); setError('Tone playback failed. Try repeating this prompt.'); });
    } else begin();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      if (verification) clearTimeout(verification);
      player.pause();
    };
  }, [phase, trialIndex, replay, mode, plan, players, refresh, finishPresentation]);

  useEffect(() => {
    if (connected || mode !== 'audio') return;
    if (phase === 'running') {
      Object.values(players).flat().forEach((player) => player.pause());
      interruptPresentation();
      setPhase('paused');
      setError('Wired headphones disconnected. Playback is paused.');
    } else if (phase === 'comfort') {
      clear500.pause();
      if (comfortTimer.current) clearTimeout(comfortTimer.current);
      setComfortPlayed(false);
      setPhase('setup');
      setError('Wired headphones disconnected. Reconnect them before the level check.');
    }
  }, [connected, mode, phase, players, clear500, interruptPresentation]);

  const playComfortCheck = async () => {
    if (!ready || !refresh()) return;
    setError('');
    setComfortPlayed(false);
    if (comfortTimer.current) clearTimeout(comfortTimer.current);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      if (!refresh()) throw new Error('Wired headphones disconnected.');
      clear500.volume = referenceGain;
      await clear500.seekTo(0);
      if (!refresh()) throw new Error('Wired headphones disconnected.');
      clear500.play();
      setPhase('comfort');
      comfortTimer.current = setTimeout(() => {
        if (!clear500.playing || !refresh()) {
          clear500.pause();
          setPhase('setup');
          setError('Comfort-check playback could not be verified.');
          return;
        }
        comfortTimer.current = setTimeout(() => setComfortPlayed(true), 570);
      }, 180);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not play the level check.');
      setPhase('setup');
    }
  };

  const start = (selectedMode: ToneTestResult['mode']) => {
    if (selectedMode === 'audio' && (!comfortPlayed || !refresh())) return;
    haptics.selection();
    setError('');
    presentations.current = [];
    active.current = null;
    setTrialIndex(0);
    setMode(selectedMode);
    setPhase('running');
  };

  const pause = () => {
    haptics.selection();
    interruptPresentation();
    setPhase('paused');
  };

  const repeat = () => {
    if (mode === 'audio' && !refresh()) {
      setError('Reconnect wired headphones before repeating.');
      return;
    }
    haptics.selection();
    interruptPresentation();
    setError('');
    setReplay((value) => value + 1);
    setPhase('running');
  };

  return <View style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{"Let's do a hearing test!"}</Text>
    <Text style={styles.body}>Listen for each short tone and tap “I Hear It” when you hear it. Use a quiet place and set your device volume low before the comfort check.</Text>
    <Text style={styles.safety}>Experimental listening check. Phone audio is not calibrated in dB HL and this is not diagnostic.</Text>

    {phase === 'setup' ? <>
      <Text style={styles.status}>{available ? connected ? 'Wired headphones detected' : 'Connect wired headphones to begin' : 'Headphone detection unavailable in this build'}</Text>
      <View style={styles.option}><Text style={styles.optionText}>Include background noise</Text><Switch accessibilityLabel="Include background noise" value={backgroundNoise} onValueChange={(value) => { haptics.selection(); setBackgroundNoise(value); }} trackColor={{ false: theme.colors.border, true: theme.colors.text }} thumbColor={theme.colors.background} /></View>
      <Text style={styles.detail}>The app will not change system volume. The test starts at the checked level, then only gets quieter. If you need more volume, change it yourself and repeat the comfort check.</Text>
      <Action label={ready ? 'Play comfort-level check' : 'Loading tones…'} onPress={() => void playComfortCheck()} disabled={!ready || !connected} />
      <Action label="Run simulation without audio" onPress={() => start('simulation')} secondary />
    </> : null}

    {phase === 'comfort' ? <>
      <Text style={styles.status}>Was that tone comfortable?</Text>
      <Text style={styles.detail}>The test will use this level or a quieter one. Lower device volume if it was too loud, then replay this check.</Text>
      <Action label="Yes, start hearing test" onPress={() => start('audio')} disabled={!comfortPlayed || !connected} />
      <Action label="Repeat comfort check" onPress={() => void playComfortCheck()} secondary />
    </> : null}

    {(phase === 'running' || phase === 'paused') ? <>
      <Text style={styles.progress}>Tone {trialIndex + 1} of {plan.length} · {plan[trialIndex].scenario === 'quiet' ? 'Quiet' : 'Background noise'} · {plan[trialIndex].relativeLevel === 'reference' ? 'Reference level' : 'Quieter level'}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(trialIndex / plan.length) * 100}%` }]} /></View>
      {mode === 'simulation' ? <Text style={styles.safety}>Simulation mode: no audio plays. Taps will not be treated as hearing measurements or used for personalization.</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="I Hear It" accessibilityState={{ disabled: phase !== 'running' || !toneActive }} disabled={phase !== 'running' || !toneActive} onPress={() => { haptics.selection(); finishPresentation(new Date().toISOString()); }} style={({ pressed }) => [styles.hearButton, (pressed || phase !== 'running' || !toneActive) && styles.dimmed]}>
        <Text style={styles.hearText}>I Hear It</Text>
      </Pressable>
      {phase === 'running' ? <Action label="Pause" onPress={pause} secondary /> : <Action label="Resume" onPress={repeat} disabled={mode === 'audio' && !connected} />}
      <Action label="Repeat tone" onPress={repeat} disabled={mode === 'audio' && !connected} secondary />
    </> : null}

    {phase === 'complete' && result ? <>
      <Text style={styles.status}>{result.mode === 'audio' ? 'Experimental profile ready' : 'Simulation complete'}</Text>
      {result.profile ? <>
        <Text style={styles.detail}>{result.profile.suggestedFocusHz.length ? `Preliminary focus: ${result.profile.suggestedFocusHz.join(', ')} Hz prompts were missed.` : 'No quiet prompts were missed in this short check.'}</Text>
        {result.backgroundNoiseEnabled ? <Text style={styles.detail}>{result.profile.backgroundNoiseChallenge ? 'Some tones heard in quiet were missed with background noise.' : 'No extra misses were recorded in the noise scenario.'}</Text> : null}
      </> : <Text style={styles.detail}>No hearing profile was inferred because no audio was played.</Text>}
      <Text style={styles.safety}>These taps are experimental and cannot diagnose hearing loss or provide calibrated dB HL thresholds.</Text>
      <Action label="Continue to preferences" onPress={onContinue} />
    </> : null}

    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    <Action label="Exit hearing test" onPress={onExit} secondary />
  </View>;
}

function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.secondary, (pressed || disabled) && styles.dimmed]}><Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.md },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.secondaryText, marginBottom: theme.spacing.md },
  safety: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginBottom: theme.spacing.lg },
  status: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.md },
  detail: { fontSize: 15, lineHeight: 22, color: theme.colors.secondaryText, marginBottom: theme.spacing.md },
  option: { minHeight: theme.sizing.settingsRowHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginBottom: theme.spacing.md },
  optionText: { ...theme.typography.segment, color: theme.colors.text },
  progress: { ...theme.typography.segment, color: theme.colors.text, marginBottom: theme.spacing.sm },
  progressTrack: { height: 4, backgroundColor: theme.colors.border, marginBottom: theme.spacing.lg },
  progressFill: { height: 4, backgroundColor: theme.colors.text },
  hearButton: { minHeight: 220, borderWidth: 2, borderColor: theme.colors.text, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.lg },
  hearText: { fontSize: 28, lineHeight: 34, fontWeight: '600', color: theme.colors.text },
  action: { minHeight: theme.sizing.segmentHeight, borderWidth: 1, borderColor: theme.colors.text, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  secondary: { backgroundColor: theme.colors.background },
  actionText: { ...theme.typography.segment, color: theme.colors.background },
  secondaryText: { color: theme.colors.text },
  dimmed: { opacity: 0.55 },
  error: { ...theme.typography.segment, color: theme.colors.text, marginBottom: theme.spacing.md },
});
