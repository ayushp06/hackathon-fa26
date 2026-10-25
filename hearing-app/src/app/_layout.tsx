import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { SoundFeedbackProvider } from '../feedback/SoundFeedbackProvider';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useAppStore } from '../state/useAppStore';

export default function RootLayout() {
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= 700 && height >= 640;
  const app = (
    <GestureHandlerRootView style={styles.root}>
      <SoundFeedbackProvider>
        <AppContent framed={framed} />
      </SoundFeedbackProvider>
    </GestureHandlerRootView>
  );
  if (!framed) return app;
  return (
    <View style={styles.previewBackdrop}>
      <View style={[styles.phoneFrame, { height: Math.min(852, height - 32) }]}>
        <View style={styles.phoneScreen}>
          {app}
        </View>
        <View pointerEvents="none" style={styles.island} />
        <View pointerEvents="none" style={styles.homeIndicator} />
      </View>
    </View>
  );
}

function AppContent({ framed }: { framed: boolean }) {
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
        <View style={[styles.content, framed && styles.previewContent]}>
          {onboardingCompleted && !onboarding ? <Pressable accessibilityRole="button" accessibilityLabel={settings ? 'Done' : 'Settings'} onPress={settings ? closeSettings : openSettings} style={styles.settingsLink}>
            {settings ? <Text style={styles.settingsText}>Done</Text> : <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.secondaryText} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
              <Path d="M12 2.5 14 3l.6 2.1a7.4 7.4 0 0 1 1.5.9l2.1-.5 1.5 1.5-.5 2.1a7.4 7.4 0 0 1 .9 1.5l2.1.6v2l-2.1.6a7.4 7.4 0 0 1-.9 1.5l.5 2.1-1.5 1.5-2.1-.5a7.4 7.4 0 0 1-1.5.9L14 21.5h-2l-.6-2.1a7.4 7.4 0 0 1-1.5-.9l-2.1.5-1.5-1.5.5-2.1a7.4 7.4 0 0 1-.9-1.5L3.8 13v-2l2.1-.6a7.4 7.4 0 0 1 .9-1.5l-.5-2.1 1.5-1.5 2.1.5a7.4 7.4 0 0 1 1.5-.9L12 2.5Z" />
              <Circle cx={13} cy={12} r={3} />
            </Svg>}
          </Pressable> : null}
          <View style={styles.screen}>
            <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'fade', animationDuration: 180, contentStyle: styles.safeArea }} />
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E1D6', padding: theme.spacing.md },
  phoneFrame: { width: 414, borderRadius: 56, padding: 10, backgroundColor: '#171717', shadowColor: '#171717', shadowOffset: { width: 0, height: 22 }, shadowOpacity: 0.24, shadowRadius: 34, elevation: 18 },
  phoneScreen: { flex: 1, borderRadius: 46, overflow: 'hidden', backgroundColor: theme.colors.background },
  island: { position: 'absolute', alignSelf: 'center', top: 20, width: 108, height: 30, borderRadius: 18, backgroundColor: '#171717' },
  homeIndicator: { position: 'absolute', alignSelf: 'center', bottom: 19, width: 110, height: 4, borderRadius: 2, backgroundColor: '#171717' },
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
  previewContent: { paddingTop: theme.spacing.lg + 32, paddingBottom: theme.spacing.lg },
  screen: { flex: 1 },
  settingsLink: { alignSelf: 'flex-end', minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center' },
  settingsText: { ...theme.typography.segment, color: theme.colors.secondaryText },
});
