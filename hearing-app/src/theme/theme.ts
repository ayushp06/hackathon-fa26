import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

// Native navigation defaults are the placeholder theme until visual specifications arrive.
export function useAppTheme() {
  return useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
}
