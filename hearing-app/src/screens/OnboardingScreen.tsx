/* eslint-disable react-hooks/immutability -- Expo Audio configures each native player's own volume property. */
import { useEffect, useRef, useState } from 'react';
import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useAppStore } from '../state/useAppStore';

type Step = 'question' | 'import' | 'test' | 'preferences';
type Preferences = { vocalTones: boolean; backgroundNoise: boolean; softerTones: boolean };

const trials = [0, 1, 2, 0, 1, 2] as const;
const acceptedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'heic', 'webp'];

export function OnboardingScreen() {
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const saveFile = useAppStore((state) => state.saveHearingTestFile);
  const saveResponses = useAppStore((state) => state.saveHearingTestResponses);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const savedFile = useAppStore((state) => state.hearingTestFile);
  const [step, setStep] = useState<Step>('question');
  const [path, setPath] = useState<'import' | 'test'>('test');
  const [trial, setTrial] = useState(-1);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [preferences, setPreferences] = useState<Partial<Preferences>>({});
  const responses = useRef<boolean[]>([]);
  const low = useAudioPlayer(require('../assets/sounds/test-500.wav'));
  const mid = useAudioPlayer(require('../assets/sounds/test-1000.wav'));
  const high = useAudioPlayer(require('../assets/sounds/test-2000.wav'));
  const lowStatus = useAudioPlayerStatus(low);
  const midStatus = useAudioPlayerStatus(mid);
  const highStatus = useAudioPlayerStatus(high);
  const players = [low, mid, high];
  const tonesReady = lowStatus.isLoaded && midStatus.isLoaded && highStatus.isLoaded;

  useEffect(() => {
    if (step !== 'test') return;
    return () => { void setAudioModeAsync({ playsInSilentMode: false }).catch(() => {}); };
  }, [step]);

  useEffect(() => {
    if (step !== 'test' || trial < 0) return;
    const player = players[trials[trial]];
    player.volume = trial < 3 ? 0.35 : 0.7;
    void player.seekTo(0).then(() => player.play()).catch(() => { setError('Could not play the tone. Try again.'); setTrial(-1); });
    const timer = setTimeout(() => {
      player.pause();
      if (trial === trials.length - 1) {
        saveResponses([...responses.current]);
        setStep('preferences');
      } else setTrial(trial + 1);
    }, 2200);
    return () => { clearTimeout(timer); player.pause(); };
    // Players are stable Expo objects; only a new trial should replay a tone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, trial, saveResponses]);

  const choose = (next: Step) => {
    haptics.selection();
    sound.tap();
    setError('');
    if (next === 'import' || next === 'test') setPath(next);
    setStep(next);
  };

  const back = () => {
    haptics.selection();
    sound.tap();
    setError('');
    if (step === 'preferences') {
      setTrial(-1);
      responses.current = [];
      setStep(path);
    } else {
      setTrial(-1);
      setStep('question');
    }
  };

  const importFile = async () => {
    haptics.selection();
    sound.tap();
    setPicking(true);
    setError('');
    try {
      const result = await getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, base64: Platform.OS === 'web' });
      if (result.canceled) return;
      const asset = result.assets[0];
      const extension = asset.name.split('.').pop()?.toLowerCase();
      const sizeLimit = Platform.OS === 'web' ? 2 : 20;
      if (!extension || !acceptedExtensions.includes(extension) || (asset.size && asset.size > sizeLimit * 1024 * 1024)) {
        setError(`Choose a PDF or image smaller than ${sizeLimit} MB.`);
        return;
      }
      if (Platform.OS === 'web') {
        if (!asset.base64) throw new Error('Missing file data');
        saveFile({ name: asset.name, uri: asset.base64 });
      } else {
        const file = new File(Paths.document, `hearing-test-${Date.now()}.${extension}`);
        new File(asset.uri).copy(file);
        saveFile({ name: asset.name, uri: file.uri });
      }
      haptics.success();
      sound.confirm();
    } catch {
      setError('Could not import that file. Please try again.');
    } finally {
      setPicking(false);
    }
  };

  const startTest = async () => {
    setError('');
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      responses.current = Array(trials.length).fill(false);
      setTrial(0);
      haptics.selection();
    } catch {
      setError('Could not start audio. Please try again.');
    }
  };

  const finish = () => {
    if (preferences.vocalTones === undefined || preferences.backgroundNoise === undefined || preferences.softerTones === undefined) return;
    completeOnboarding(preferences as Preferences);
    haptics.success();
    sound.confirm();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.top}>
        {step !== 'question' ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable> : <View />}
        <Text style={styles.progress}>Step {step === 'question' ? 1 : step === 'preferences' ? 3 : 2} of 3</Text>
      </View>
      <View style={styles.progressTrack} accessibilityLabel={`Step ${step === 'question' ? 1 : step === 'preferences' ? 3 : 2} of 3`}>
        <View style={[styles.progressFill, { width: step === 'question' ? '33.33%' : step === 'preferences' ? '100%' : '66.67%' }]} />
      </View>

      {step === 'question' ? <>
        <Text accessibilityRole="header" style={styles.title}>Do you have hearing test results?</Text>
        <Text style={styles.body}>You can import a PDF or image, or do a short listening check now.</Text>
        <Action label="Yes, import results" onPress={() => choose('import')} />
        <Action label="No, do a hearing test" onPress={() => choose('test')} secondary />
      </> : null}

      {step === 'import' ? <>
        <Text accessibilityRole="header" style={styles.title}>Import hearing test results</Text>
        <Text style={styles.body}>Choose a PDF or image of your hearing test. The file stays on this device.</Text>
        <Action label={picking ? 'Opening files…' : savedFile ? 'Choose another file' : 'Import PDF or image'} onPress={() => void importFile()} disabled={picking} />
        {savedFile ? <Text style={styles.fileName}>Selected: {savedFile.name}</Text> : null}
        <Text style={styles.note}>Results are saved for reference. Automatic adjustment from a clinical report is not available yet.</Text>
        <Action label="Continue" onPress={() => choose('preferences')} disabled={!savedFile} secondary />
      </> : null}

      {step === 'test' ? <>
        <Text accessibilityRole="header" style={styles.title}>Hearing test</Text>
        <Text style={styles.body}>Find a quiet place and set a comfortable device volume. Tap each time you hear a tone. There are six tones.</Text>
        {trial < 0 ? <Action label={tonesReady ? 'Start hearing test' : 'Loading tones…'} onPress={() => void startTest()} disabled={!tonesReady} /> :
          <Pressable accessibilityRole="button" accessibilityLabel="I hear the tone" onPress={() => {
            if (responses.current[trial]) return;
            responses.current[trial] = true;
            haptics.selection();
          }} style={styles.tapArea}>
            <Text style={styles.tapText}>Tap when you hear a tone</Text>
            <Text style={styles.tapCount}>Tone {trial + 1} of {trials.length}</Text>
          </Pressable>}
        <Text style={styles.note}>This listening check is not a medical hearing test or calibrated audiogram.</Text>
      </> : null}

      {step === 'preferences' ? <>
        <Text accessibilityRole="header" style={styles.title}>Which sounds do you want to be louder?</Text>
        <Text style={styles.body}>Choose what you prefer. You can review your choices before finishing.</Text>
        <Preference label="Vocal tones?" choices={[['Yes', true], ['No', false]]} value={preferences.vocalTones} onChange={(value) => setPreferences((current) => ({ ...current, vocalTones: value }))} />
        <Preference label="Background noise?" choices={[['Yes', true], ['No', false]]} value={preferences.backgroundNoise} onChange={(value) => setPreferences((current) => ({ ...current, backgroundNoise: value }))} />
        <Preference label="Emphasize softer or louder tones?" choices={[['Softer', true], ['Louder', false]]} value={preferences.softerTones} onChange={(value) => setPreferences((current) => ({ ...current, softerTones: value }))} />
        <Action label="Go to Home" onPress={finish} disabled={Object.keys(preferences).length !== 3} />
      </> : null}

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.secondary, (pressed || disabled) && styles.dimmed]}>
    <Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

function Preference({ label, choices, value, onChange }: { label: string; choices: [string, boolean][]; value: boolean | undefined; onChange: (value: boolean) => void }) {
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  return <View style={styles.preference}>
    <Text style={styles.preferenceLabel}>{label}</Text>
    <View style={styles.choices}>
      {choices.map(([text, choice]) => <Pressable key={text} accessibilityRole="radio" accessibilityLabel={`${label} ${text}`} accessibilityState={{ checked: value === choice }} onPress={() => { haptics.selection(); sound.tap(); onChange(choice); }} style={[styles.choice, value === choice && styles.selectedChoice]}>
        <Text style={[styles.choiceText, value === choice && styles.selectedChoiceText]}>{text}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl },
  top: { minHeight: theme.sizing.minimumTouchTarget, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center' },
  backText: { ...theme.typography.segment, color: theme.colors.text },
  progress: { ...theme.typography.segment, color: theme.colors.secondaryText },
  progressTrack: { height: 4, backgroundColor: theme.colors.border, marginBottom: theme.spacing.xl },
  progressFill: { height: 4, backgroundColor: theme.colors.text },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.md },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.secondaryText, marginBottom: theme.spacing.xl },
  action: { minHeight: theme.sizing.segmentHeight, backgroundColor: theme.colors.text, borderWidth: 1, borderColor: theme.colors.text, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md, paddingHorizontal: theme.spacing.md },
  secondary: { backgroundColor: theme.colors.background },
  dimmed: { opacity: 0.55 },
  actionText: { ...theme.typography.segment, color: theme.colors.background },
  secondaryText: { color: theme.colors.text },
  fileName: { ...theme.typography.segment, color: theme.colors.text, marginBottom: theme.spacing.md },
  note: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginTop: theme.spacing.md, marginBottom: theme.spacing.lg },
  tapArea: { minHeight: 220, borderWidth: 1, borderColor: theme.colors.text, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  tapText: { ...theme.typography.segment, color: theme.colors.text, fontSize: 18, textAlign: 'center' },
  tapCount: { ...theme.typography.segment, color: theme.colors.secondaryText, marginTop: theme.spacing.md },
  preference: { marginBottom: theme.spacing.lg },
  preferenceLabel: { fontSize: 18, lineHeight: 24, color: theme.colors.text, marginBottom: theme.spacing.sm },
  choices: { flexDirection: 'row', gap: theme.spacing.sm },
  choice: { flex: 1, minHeight: theme.sizing.minimumTouchTarget, borderWidth: 1, borderColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  selectedChoice: { backgroundColor: theme.colors.text },
  choiceText: { ...theme.typography.segment, color: theme.colors.text },
  selectedChoiceText: { color: theme.colors.background },
  error: { ...theme.typography.segment, color: theme.colors.text, marginTop: theme.spacing.md },
});
