import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { manualDialDiameter, theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';
import { useAppStore } from '../state/useAppStore';

export function ManualScreen() {
  const { width } = useWindowDimensions();
  const baseVolume = useAppStore((state) => state.baseVolume);
  const noiseReduction = useAppStore((state) => state.noiseReduction);
  const spatialFocus = useAppStore((state) => state.spatialFocus);
  const setValue = useAppStore((state) => state.setValue);
  const [viewportHeight, setViewportHeight] = useState(Infinity);
  const diameter = manualDialDiameter(width, viewportHeight);

  return (
    <ScrollView bounces={false} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Manual</Text>
      <View style={styles.row}>
        <View style={styles.column}>
          <RotaryDial min={0} max={100} step={1} diameter={diameter} label="Base Volume" value={baseVolume} valueSuffix="%" onValueChange={(value) => setValue('baseVolume', value)} />
        </View>
        <View style={styles.column}>
          <RotaryDial min={0} max={100} step={1} diameter={diameter} label="Background Noise Reduction" value={noiseReduction} valueSuffix="%" onValueChange={(value) => setValue('noiseReduction', value)} />
        </View>
      </View>
      <View style={styles.bottom}>
        <RotaryDial min={0} max={100} step={1} diameter={diameter} label="Spatial Focus" value={spatialFocus} valueSuffix="%" onValueChange={(value) => setValue('spatialFocus', value)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text },
  row: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xl },
  column: { flex: 1, alignItems: 'center' },
  bottom: { alignItems: 'center', marginTop: theme.spacing.xl },
});
