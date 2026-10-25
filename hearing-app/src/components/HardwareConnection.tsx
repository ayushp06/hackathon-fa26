import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { hardwareMode } from '../device/deviceService';
import { hardwareDeviceService, type HardwareStatus } from '../device/hardwareDeviceService';
import { useDeviceStore } from '../state/useDeviceStore';
import { useAppStore } from '../state/useAppStore';

export function HardwareConnection() {
  const [status, setStatus] = useState<HardwareStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const device = useDeviceStore();
  const transportError = useAppStore((state) => state.transportError);
  const calibrationStatus = useAppStore((state) => state.calibrationStatus);
  const recalibrate = useAppStore((state) => state.recalibrate);
  useEffect(() => {
    if (!hardwareMode) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await hardwareDeviceService.getStatus();
        if (!stopped) {
          setStatus(next); setError(next.error);
          if (!next.connected) useDeviceStore.setState({ connectedDevice: null });
        }
      } catch (failure) {
        if (!stopped) {
          setStatus(null); setError(failure instanceof Error ? failure.message : 'USB bridge unavailable');
          useDeviceStore.setState({ connectedDevice: null });
        }
      }
      if (!stopped) timer = setTimeout(() => void poll(), 1000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  if (!hardwareMode) return <Text style={styles.note}>Preview mode: device controls are simulated.</Text>;
  const connected = !!device.connectedDevice && status?.connected;
  const toggle = async () => {
    setBusy(true);
    try {
      if (connected) await device.disconnect();
      else await device.connect('stm32-usb');
      setStatus(await hardwareDeviceService.getStatus());
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection failed'); }
    finally { setBusy(false); }
  };
  const restart = async () => {
    setBusy(true);
    try {
      const connectedDevice = await hardwareDeviceService.restart();
      useDeviceStore.setState({ connectedDevice, error: null });
      useAppStore.setState({ transportError: null });
      setStatus(await hardwareDeviceService.getStatus()); setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Restart failed'); }
    finally { setBusy(false); }
  };
  return <View style={styles.panel}>
    <View style={styles.row}>
      <Text style={styles.title}>{connected ? 'STM32 connected · AUX' : 'USB hardware'}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void toggle()} style={styles.button}>
        <Text style={styles.buttonText}>{busy ? 'Connecting…' : connected ? 'Disconnect' : 'Connect USB'}</Text>
      </Pressable>
    </View>
    {status && (!status.streaming || !status.referenceClock) ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void restart()} style={styles.button}><Text style={styles.buttonText}>Restart audio</Text></Pressable> : null}
    {connected ? <>
      <Text style={styles.note}>Voice {status.primaryRms} · Noise {status.referenceRms} · Output {status.outputRms}</Text>
      <View style={styles.row}>
        <Text style={styles.note}>{!status.referenceClock ? 'Noise clock missing: PB12 → A2' : status.filter === 'spatial' ? 'Spatial focus on; noise learning paused' : status.filter === 'no-reference' ? 'Noise mic has no signal' : status.filter === 'bypass' ? 'Noise reduction off' : 'Noise filtering on'}</Text>
        <Pressable accessibilityRole="button" disabled={!status.referenceClock || status.spatialFocus > 0 || calibrationStatus === 'loading'} onPress={() => void recalibrate()} style={styles.button}>
          <Text style={styles.buttonText}>{calibrationStatus === 'loading' ? 'Learning… stay quiet' : 'Relearn noise'}</Text>
        </Pressable>
      </View>
    </> : <Text style={styles.note}>Connect to apply your saved dial settings.</Text>}
    {error || device.error || transportError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error || device.error || transportError}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  note: { fontSize: 12, lineHeight: 17, color: theme.colors.secondaryText },
  button: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  buttonText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  error: { fontSize: 12, lineHeight: 17, color: '#9D2D20' },
});
