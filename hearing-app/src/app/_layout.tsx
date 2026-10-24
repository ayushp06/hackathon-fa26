import { Slot, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../../constants/theme';
import { SoundFeedbackProvider } from '../feedback/SoundFeedbackProvider';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { SegmentedSwitch } from '../navigation/SegmentedSwitch';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SoundFeedbackProvider>
        <AppContent />
      </SoundFeedbackProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const pathname = usePathname();
  const router = useRouter();
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const settings = pathname === '/settings';

  const openSettings = () => {
    haptics.selection();
    sound.tap();
    router.push('/settings');
  };

  const closeSettings = () => {
    haptics.selection();
    sound.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <Pressable accessibilityRole="button" onPress={settings ? closeSettings : openSettings} style={styles.settingsLink}>
            <Text style={styles.settingsText}>{settings ? 'Done' : 'Settings'}</Text>
          </Pressable>
          {!settings ? <SegmentedSwitch /> : null}
          <View style={styles.screen}>
            <Slot />
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: theme.sizing.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  screen: { flex: 1 },
  settingsLink: { alignSelf: 'flex-end', minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center' },
  settingsText: { ...theme.typography.segment, color: theme.colors.secondaryText },
});
