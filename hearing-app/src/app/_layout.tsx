import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { SoundFeedbackProvider } from '../feedback/SoundFeedbackProvider';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { SegmentedSwitch } from '../navigation/SegmentedSwitch';
import { useAppStore } from '../state/useAppStore';

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
  const hydrated = useAppStore((state) => state.hydrated);
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);
  const setActiveMode = useAppStore((state) => state.setActiveMode);
  const settings = pathname === '/settings';
  const onboarding = pathname === '/onboarding';
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!hydrated) return;
    if (!onboardingCompleted && !onboarding) { router.replace('/onboarding'); return; }
    if (onboardingCompleted && onboarding) { router.replace('/'); return; }
    if (pathname === '/' || pathname === '/manual') {
      setActiveMode(pathname === '/' ? 'automatic' : 'manual');
    }
  }, [hydrated, pathname, onboarding, onboardingCompleted, router, setActiveMode]);

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

  if (!hydrated) return null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          {onboardingCompleted && !onboarding ? <Pressable accessibilityRole="button" onPress={settings ? closeSettings : openSettings} style={styles.settingsLink}>
            <Text style={styles.settingsText}>{settings ? 'Done' : 'Settings'}</Text>
          </Pressable> : null}
          {onboardingCompleted && !settings && !onboarding ? <SegmentedSwitch /> : null}
          <View style={styles.screen}>
            <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'fade', animationDuration: 180, contentStyle: styles.safeArea }} />
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
