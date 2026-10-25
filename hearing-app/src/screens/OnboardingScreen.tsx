import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { pickHearingTestDocument, previewHearingTestDocument, removeHearingTestDocument } from '../hearingTest/importDocument';
import type { HearingPreferences } from '../state/hearingPreferences';
import { useAppStore } from '../state/useAppStore';
import { HearingTestScreen } from './HearingTestScreen';

type Step = 'question' | 'import' | 'test' | 'preferences';

function fileSize(bytes: number | null) {
  if (bytes === null) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function OnboardingScreen() {
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const saveFile = useAppStore((state) => state.saveHearingTestFile);
  const clearFile = useAppStore((state) => state.clearHearingTestFile);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const savedFile = useAppStore((state) => state.hearingTestFile);
  const [step, setStep] = useState<Step>('question');
  const [path, setPath] = useState<'import' | 'test'>('test');
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [preferences, setPreferences] = useState<Partial<HearingPreferences>>({});
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
      setStep(path);
    } else {
      setStep('question');
    }
  };

  const importFile = async () => {
    haptics.selection();
    sound.tap();
    setPicking(true);
    setError('');
    let selected: Awaited<ReturnType<typeof pickHearingTestDocument>> = null;
    try {
      selected = await pickHearingTestDocument();
      if (!selected) return;
      if (savedFile) await removeHearingTestDocument(savedFile);
      saveFile(selected);
      haptics.success();
      sound.confirm();
    } catch (error) {
      if (selected) await removeHearingTestDocument(selected).catch(() => {});
      setError(error instanceof Error ? error.message : 'Could not import that file. Please try again.');
    } finally {
      setPicking(false);
    }
  };

  const removeFile = async () => {
    if (!savedFile) return;
    haptics.selection();
    sound.tap();
    setPicking(true);
    setError('');
    try {
      await removeHearingTestDocument(savedFile);
      clearFile();
    } catch {
      setError('Could not remove the file. Please try again.');
    } finally {
      setPicking(false);
    }
  };

  const takeTestInstead = async () => {
    if (savedFile) {
      setPicking(true);
      setError('');
      try {
        await removeHearingTestDocument(savedFile);
        clearFile();
      } catch {
        setError('Could not remove the imported file. Please try again.');
        setPicking(false);
        return;
      }
      setPicking(false);
    }
    choose('test');
  };

  const previewFile = async () => {
    if (!savedFile) return;
    haptics.selection();
    sound.tap();
    setError('');
    try {
      await previewHearingTestDocument(savedFile);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not preview the file.');
    }
  };

  const finish = () => {
    if (preferences.vocalTones === undefined || preferences.backgroundNoise === undefined || preferences.toneEmphasis === undefined) return;
    completeOnboarding({ vocalTones: preferences.vocalTones, backgroundNoise: preferences.backgroundNoise, toneEmphasis: preferences.toneEmphasis });
    haptics.success();
    sound.confirm();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.top}>
        {step !== 'question' ? <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: picking }} disabled={picking} onPress={back} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable> : <View />}
        <Text style={styles.progress}>Step {step === 'question' ? 1 : step === 'preferences' ? 3 : 2} of 3</Text>
      </View>
      <View style={styles.progressTrack} accessibilityLabel={`Step ${step === 'question' ? 1 : step === 'preferences' ? 3 : 2} of 3`}>
        <View style={[styles.progressFill, { width: step === 'question' ? '33.33%' : step === 'preferences' ? '100%' : '66.67%' }]} />
      </View>

      {step === 'question' ? <>
        <Text accessibilityRole="header" style={styles.title}>Do you have hearing test results?</Text>
        <Text style={styles.body}>You can import a PDF or image, or do a short listening check now.</Text>
        <Action label="Yes, import results" onPress={() => choose('import')} />
        <Action label="No, do a hearing test" onPress={() => void takeTestInstead()} secondary />
      </> : null}

      {step === 'import' ? <>
        <Text accessibilityRole="header" style={styles.title}>Import hearing test results</Text>
        <Text style={styles.body}>Choose a PDF, JPG, PNG, or HEIC file. It stays in this app’s storage.</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {savedFile ? <View style={styles.fileCard}>
          {(savedFile.mimeType === 'image/jpeg' || savedFile.mimeType === 'image/png' || (savedFile.mimeType === 'image/heic' && Platform.OS !== 'web'))
            ? <Image source={{ uri: savedFile.uri }} accessibilityLabel={`Preview of ${savedFile.name}`} resizeMode="contain" style={styles.imagePreview} />
            : <View style={styles.filePlaceholder}><Text style={styles.placeholderText}>{savedFile.mimeType === 'application/pdf' ? 'PDF document' : 'Image file'}</Text></View>}
          <Text style={styles.fileName}>{savedFile.name}</Text>
          <Text style={styles.fileMeta}>{savedFile.mimeType} · {fileSize(savedFile.sizeBytes)}</Text>
          {savedFile.importedAt ? <Text style={styles.fileMeta}>Imported {new Date(savedFile.importedAt).toLocaleDateString()}</Text> : null}
          <Text style={styles.statusLabel}>Pending Analysis</Text>
          <Text style={styles.fileMeta}>No hearing thresholds have been extracted or interpreted.</Text>
          {Platform.OS !== 'web' ? <Action label="Preview file" onPress={() => void previewFile()} secondary /> : null}
          <Action label="Replace file" onPress={() => void importFile()} disabled={picking} secondary />
          <Action label="Remove file" onPress={() => void removeFile()} disabled={picking} secondary />
        </View> : <Action label={picking ? 'Opening files…' : 'Import PDF, JPG, PNG, or HEIC'} onPress={() => void importFile()} disabled={picking} />}
        <Text style={styles.note}>You can continue without automatic analysis.</Text>
        <Action label="Continue" onPress={() => choose('preferences')} disabled={!savedFile || picking} />
        <Action label="Take Hearing Test Instead" onPress={() => void takeTestInstead()} disabled={picking} secondary />
      </> : null}

      {step === 'test' ? <>
        <HearingTestScreen onContinue={() => choose('preferences')} onExit={back} />
      </> : null}

      {step === 'preferences' ? <>
        <Text accessibilityRole="header" style={styles.title}>Which sounds do you want to be louder?</Text>
        <Text style={styles.body}>Choose what you prefer. You can review your choices before finishing.</Text>
        <Preference label="Vocal tones?" choices={[['Yes', true], ['No', false]]} value={preferences.vocalTones} onChange={(value) => setPreferences((current) => ({ ...current, vocalTones: value }))} />
        <Preference label="Background noise?" choices={[['Yes', true], ['No', false]]} value={preferences.backgroundNoise} onChange={(value) => setPreferences((current) => ({ ...current, backgroundNoise: value }))} />
        <Preference label="Emphasize softer or louder tones?" choices={[['Softer', 'softer'], ['Louder', 'louder'], ['Neither', 'neither']]} value={preferences.toneEmphasis} onChange={(value) => setPreferences((current) => ({ ...current, toneEmphasis: value }))} />
        <Action label="Finish Setup" onPress={finish} disabled={preferences.vocalTones === undefined || preferences.backgroundNoise === undefined || preferences.toneEmphasis === undefined} />
      </> : null}

      {error && step !== 'import' ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.secondary, (pressed || disabled) && styles.dimmed]}>
    <Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

function Preference<T extends boolean | HearingPreferences['toneEmphasis']>({ label, choices, value, onChange }: { label: string; choices: [string, T][]; value: T | undefined; onChange: (value: T) => void }) {
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  return <View style={styles.preference}>
    <Text style={styles.preferenceLabel}>{label}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
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
  fileCard: { borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  imagePreview: { width: '100%', height: 180, marginBottom: theme.spacing.md },
  filePlaceholder: { height: 120, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  placeholderText: { ...theme.typography.segment, color: theme.colors.secondaryText },
  fileName: { ...theme.typography.segment, color: theme.colors.text, marginBottom: theme.spacing.xs },
  fileMeta: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginBottom: theme.spacing.xs },
  statusLabel: { ...theme.typography.segment, color: theme.colors.text, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  note: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginTop: theme.spacing.md, marginBottom: theme.spacing.lg },
  preference: { marginBottom: theme.spacing.lg },
  preferenceLabel: { fontSize: 18, lineHeight: 24, color: theme.colors.text, marginBottom: theme.spacing.sm },
  choices: { flexDirection: 'row', padding: theme.spacing.xs, borderWidth: theme.sizing.borderWidth, borderColor: theme.colors.border, borderRadius: theme.sizing.segmentRadius },
  choice: { flex: 1, minHeight: theme.sizing.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.sm, borderRadius: theme.sizing.segmentRadius - theme.spacing.xs },
  selectedChoice: { backgroundColor: theme.colors.text },
  choiceText: { ...theme.typography.segment, color: theme.colors.text, textAlign: 'center' },
  selectedChoiceText: { color: theme.colors.background },
  error: { ...theme.typography.segment, color: theme.colors.text, marginTop: theme.spacing.md },
});
