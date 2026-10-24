import type { ExpoConfig } from 'expo/config';
import { theme } from './constants/theme.ts';

const identity = {
  name: 'Hearing App',
  slug: 'hearing-app',
  applicationId: 'com.example.hearingapp',
};

export default {
  name: identity.name,
  slug: identity.slug,
  scheme: identity.slug,
  version: '1.0.0',
  platforms: ['ios', 'android', 'web'],
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: theme.colors.background,
  primaryColor: theme.colors.text,
  plugins: [
    'expo-router',
    'expo-system-ui',
    // A transparent pixel keeps the splash blank while applying the background on iOS.
    ['expo-splash-screen', { backgroundColor: theme.colors.background, image: './src/assets/blank-splash.png' }],
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
  ],
  experiments: { typedRoutes: true },
  ios: { bundleIdentifier: identity.applicationId },
  android: { package: identity.applicationId },
} satisfies ExpoConfig;
