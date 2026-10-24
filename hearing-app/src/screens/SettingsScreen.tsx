import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useFeedbackSettings } from '../state/useFeedbackSettings';

export function SettingsScreen() {
  const hapticsEnabled = useFeedbackSettings((state) => state.hapticsEnabled);
  const soundEnabled = useFeedbackSettings((state) => state.soundEnabled);
  const setHapticsEnabled = useFeedbackSettings((state) => state.setHapticsEnabled);
  const setSoundEnabled = useFeedbackSettings((state) => state.setSoundEnabled);
  const haptics = useHaptics();
  const sound = useSoundFeedback();

  const toggle = (kind: 'haptics' | 'sound', enabled: boolean) => {
    haptics.selection();
    sound.tap();
    if (kind === 'haptics') setHapticsEnabled(enabled);
    else setSoundEnabled(enabled);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Feedback settings</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Haptics</Text>
        <Switch accessibilityLabel="Haptics" value={hapticsEnabled} onValueChange={(value) => toggle('haptics', value)} trackColor={{ false: theme.colors.border, true: theme.colors.text }} thumbColor={theme.colors.background} ios_backgroundColor={theme.colors.border} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sound</Text>
        <Switch accessibilityLabel="Sound" value={soundEnabled} onValueChange={(value) => toggle('sound', value)} trackColor={{ false: theme.colors.border, true: theme.colors.text }} thumbColor={theme.colors.background} ios_backgroundColor={theme.colors.border} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.xl },
  row: { minHeight: theme.sizing.settingsRowHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: theme.sizing.borderWidth, borderBottomColor: theme.colors.border },
  label: { ...theme.typography.segment, color: theme.colors.text },
});
