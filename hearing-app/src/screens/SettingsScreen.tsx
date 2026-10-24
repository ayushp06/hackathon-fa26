import { Text, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useDeviceStore } from '../state/useDeviceStore';

export function SettingsScreen() {
  const lastDeviceId = useDeviceStore((state) => state.lastDeviceId);
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ color: colors.text }}>Settings placeholder</Text>
      <Text style={{ color: colors.text }}>Last device: {lastDeviceId ?? 'None'}</Text>
    </View>
  );
}
