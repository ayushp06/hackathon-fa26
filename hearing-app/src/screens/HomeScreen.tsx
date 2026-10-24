import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useDeviceStore } from '../state/useDeviceStore';

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const connectedDevice = useDeviceStore((state) => state.connectedDevice);
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ color: colors.text }}>Device: {connectedDevice?.name ?? 'Not connected'}</Text>
      <Button title="Device" onPress={() => navigation.navigate('Device')} />
      <Button title="Settings" onPress={() => navigation.navigate('Settings')} />
    </View>
  );
}
