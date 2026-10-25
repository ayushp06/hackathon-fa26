import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useAppStore } from '../state/useAppStore';
import { hardwareMode } from '../device/deviceService';
import { hardwareDeviceService } from '../device/hardwareDeviceService';
import { useDeviceStore } from '../state/useDeviceStore';

export function SettingsScreen() {
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const soundEnabled = useAppStore((state) => state.soundFeedbackEnabled);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundFeedbackEnabled);
  const savedProfile = useAppStore((state) => state.savedProfile);
  const restoringProfile = useAppStore((state) => state.restoringProfile);
  const noiseBusy = useAppStore((state) => state.noiseBusy);
  const runNoiseOperation = useAppStore((state) => state.runNoiseOperation);
  const connected = useDeviceStore((state) => !!state.connectedDevice);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const restoreProfile = useAppStore((state) => state.restoreProfile);
  const [profileMessage, setProfileMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
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
    setProfileMessage(restored ? 'Saved dial values restored. Adjust a dial to apply it to the device.' : 'Could not restore the profile.');
    if (restored) {
      haptics.selection();
      sound.confirm();
    }
  };

  const resetLearning = async () => {
    setConfirmReset(false);
    setResetMessage('');
    try {
      await runNoiseOperation(async () => {
        await hardwareDeviceService.resetLearning();
        const status = await hardwareDeviceService.getStatus();
        if (!status.connected) throw new Error('Device disconnected after reset. Check its status.');
        useAppStore.setState({ appliedNoiseReduction: status.noiseReduction, noiseReduction: status.noiseReduction });
      });
      setResetMessage('Learning ready. The target will return to 50% when valid acoustic features are processed.');
    } catch (error) { setResetMessage(error instanceof Error ? error.message : 'Reset Learning failed.'); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Settings</Text>
      <Text style={styles.sectionTitle}>Saved sound</Text>
      <Text style={styles.description}>Save your current dial values. Restoring them does not change the connected device until you adjust a dial.</Text>
      <Pressable accessibilityRole="button" disabled={restoringProfile || noiseBusy} onPress={save} style={styles.profileButton}>
        <Text style={styles.label}>{savedProfile ? 'Update saved sound' : 'Save current sound'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!savedProfile || restoringProfile || noiseBusy} onPress={() => void restore()} style={[styles.profileButton, (!savedProfile || restoringProfile || noiseBusy) && styles.disabled]}>
        <Text style={styles.label}>{restoringProfile ? 'Restoring…' : 'Restore saved sound'}</Text>
      </Pressable>
      {profileMessage ? <Text accessibilityLiveRegion="polite" style={styles.description}>{profileMessage}</Text> : null}
      {hardwareMode ? <>
        <Text style={[styles.sectionTitle, styles.feedbackTitle]}>Device learning</Text>
        <Pressable accessibilityRole="button" disabled={!connected || noiseBusy || restoringProfile} onPress={() => { setConfirmReset(true); setResetMessage(''); }} style={[styles.profileButton, (!connected || noiseBusy || restoringProfile) && styles.disabled]}><Text style={styles.label}>{noiseBusy ? 'Resetting learning…' : 'Reset Learning'}</Text></Pressable>
        {confirmReset ? <View><Text style={styles.description}>Clear all learned corrections and enable automatic adaptation?</Text><Pressable accessibilityRole="button" disabled={noiseBusy} onPress={() => void resetLearning()} style={styles.profileButton}><Text style={styles.label}>Confirm Reset Learning</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setConfirmReset(false)} style={styles.profileButton}><Text style={styles.label}>Cancel</Text></Pressable></View> : null}
        {resetMessage ? <Text accessibilityLiveRegion="polite" style={styles.description}>{resetMessage}</Text> : null}
      </> : null}
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
