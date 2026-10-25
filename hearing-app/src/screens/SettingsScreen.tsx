import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useAppStore } from '../state/useAppStore';

export function SettingsScreen() {
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const soundEnabled = useAppStore((state) => state.soundFeedbackEnabled);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundFeedbackEnabled);
  const restartOnboarding = useAppStore((state) => state.restartOnboarding);
  const haptics = useHaptics();
  const sound = useSoundFeedback();

  const toggle = (kind: 'haptics' | 'sound', enabled: boolean) => {
    haptics.selection();
    sound.tap();
    if (kind === 'haptics') setHapticsEnabled(enabled);
    else setSoundEnabled(enabled);
  };

  const runSetupAgain = () => {
    haptics.selection();
    sound.tap();
    restartOnboarding();
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Feedback settings</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Haptics</Text>
        <Switch accessibilityLabel="Haptics" value={hapticsEnabled} onValueChange={(value) => toggle('haptics', value)} trackColor={{ false: theme.colors.border, true: theme.colors.text }} thumbColor={theme.colors.background} ios_backgroundColor={theme.colors.border} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sound</Text>
        <Switch accessibilityLabel="Sound" value={soundEnabled} onValueChange={(value) => toggle('sound', value)} trackColor={{ false: theme.colors.border, true: theme.colors.text }} thumbColor={theme.colors.background} ios_backgroundColor={theme.colors.border} />
      </View>
      <View style={styles.setupSection}>
        <Text style={styles.setupTitle}>Hearing setup</Text>
        <Text style={styles.setupDescription}>Go through the hearing test options and preferences again. Your manual control settings stay saved.</Text>
        <Pressable accessibilityRole="button" onPress={runSetupAgain} style={({ pressed }) => [styles.setupButton, pressed && styles.pressed]}>
          <Text style={styles.setupButtonText}>Run Setup Again</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.xl },
  row: { minHeight: theme.sizing.settingsRowHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: theme.sizing.borderWidth, borderBottomColor: theme.colors.border },
  label: { ...theme.typography.segment, color: theme.colors.text },
  setupSection: { marginTop: theme.spacing.xl },
  setupTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: theme.colors.text },
  setupDescription: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginTop: theme.spacing.sm },
  setupButton: { minHeight: theme.sizing.segmentHeight, marginTop: theme.spacing.lg, borderWidth: theme.sizing.borderWidth, borderColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  setupButtonText: { ...theme.typography.segment, color: theme.colors.text },
  pressed: { opacity: 0.7 },
});
