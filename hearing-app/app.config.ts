import type { ExpoConfig } from 'expo/config';

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
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  plugins: [
    'expo-router',
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
  ],
  experiments: { typedRoutes: true },
  ios: { bundleIdentifier: identity.applicationId },
  android: { package: identity.applicationId },
} satisfies ExpoConfig;
