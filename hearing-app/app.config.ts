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
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
  ios: { bundleIdentifier: identity.applicationId },
  android: { package: identity.applicationId },
} satisfies ExpoConfig;
