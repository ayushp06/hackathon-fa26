import { useEffect } from 'react';
import { Button, Text, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useDeviceStore } from '../state/useDeviceStore';

export function DeviceScreen() {
  const { devices, connectedDevice, error, scan, connect, disconnect } = useDeviceStore();
  const { colors } = useTheme();

  useEffect(() => {
    void scan();
  }, [scan]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ color: colors.text }}>Mock device connection</Text>
      <Text style={{ color: colors.text }}>{connectedDevice ? `Connected to ${connectedDevice.name}` : 'Not connected'}</Text>
      {error ? <Text style={{ color: colors.text }} accessibilityRole="alert">{error}</Text> : null}
      <Button title="Scan" onPress={() => void scan()} />
      {devices.map((device) => (
        <Button key={device.id} title={`Connect to ${device.name}`} onPress={() => void connect(device.id)} />
      ))}
      {connectedDevice ? <Button title="Disconnect" onPress={() => void disconnect()} /> : null}
    </View>
  );
}
