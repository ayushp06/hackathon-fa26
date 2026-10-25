import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useAppStore } from '../state/useAppStore';

export function SettingsScreen() {
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const soundEnabled = useAppStore((state) => state.soundFeedbackEnabled);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundFeedbackEnabled);
  const savedProfile = useAppStore((state) => state.savedProfile);
  const restoringProfile = useAppStore((state) => state.restoringProfile);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const restoreProfile = useAppStore((state) => state.restoreProfile);
  const [profileMessage, setProfileMessage] = useState('');
  const haptics = useHaptics();
  const sound = useSoundFeedback();

  const toggle = (kind: 'haptics' | 'sound', enabled: boolean) => {
    haptics.selection();
    sound.tap();
    if (kind === 'haptics') setHapticsEnabled(enabled);
    else setSoundEnabled(enabled);
  };

  const save = () => {
    saveProfile();
    setProfileMessage('Current sound settings saved.');
    haptics.selection();
    sound.confirm();
  };

  const restore = async () => {
    setProfileMessage('');
    const restored = await restoreProfile();
    setProfileMessage(restored ? 'Saved sound settings restored.' : 'Could not restore the profile. Check the device connection.');
    if (restored) {
      haptics.selection();
      sound.confirm();
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Settings</Text>
      <Text style={styles.sectionTitle}>Saved sound</Text>
      <Text style={styles.description}>Save your current volume and sound adjustments, then restore them whenever you want.</Text>
      <Pressable accessibilityRole="button" disabled={restoringProfile} onPress={save} style={styles.profileButton}>
        <Text style={styles.label}>{savedProfile ? 'Update saved sound' : 'Save current sound'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!savedProfile || restoringProfile} onPress={() => void restore()} style={[styles.profileButton, (!savedProfile || restoringProfile) && styles.disabled]}>
        <Text style={styles.label}>{restoringProfile ? 'Restoring…' : 'Restore saved sound'}</Text>
      </Pressable>
      {profileMessage ? <Text accessibilityLiveRegion="polite" style={styles.description}>{profileMessage}</Text> : null}
      <Text style={[styles.sectionTitle, styles.feedbackTitle]}>Feedback</Text>
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
  sectionTitle: { ...theme.typography.segment, color: theme.colors.text, marginBottom: theme.spacing.sm },
  feedbackTitle: { marginTop: theme.spacing.xl },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginBottom: theme.spacing.md },
  profileButton: { minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center', borderBottomWidth: theme.sizing.borderWidth, borderBottomColor: theme.colors.border },
  disabled: { opacity: 0.4 },
});
