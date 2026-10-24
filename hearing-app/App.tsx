import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppTheme } from './src/theme/theme';

export default function App() {
  const theme = useAppTheme();

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="auto" />
      <AppNavigator />
    </NavigationContainer>
  );
}
