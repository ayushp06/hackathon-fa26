import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { advancedDialDiameter, manualDialDiameter, theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import type { ManualControl } from '../state/manualValues';
import { useAppStore } from '../state/useAppStore';
import { manualWaveformPath } from './manualWaveform';

const primaryControls: [ManualControl, string][] = [
  ['baseVolume', 'Volume/Gain'],
  ['noiseReduction', 'Background Noise Reduction'],
  ['spatialFocus', 'Spatial Focus'],
  ['speechAmplification', 'Speech Amplification'],
];

const advancedControls: [ManualControl, string][] = [
  ['bass', 'Bass'], ['mid', 'Mid'], ['treble', 'Treble'],
];

export function ManualScreen() {
  const { width } = useWindowDimensions();
  const values = useAppStore();
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const [viewportHeight, setViewportHeight] = useState(Infinity);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const diameter = manualDialDiameter(width, viewportHeight);
  const advancedDiameter = advancedDialDiameter(width);
  const columnWidth = (Math.min(width, theme.sizing.contentMaxWidth) - theme.spacing.lg * 2 - theme.spacing.md) / 2;

  const toggleAdvanced = () => {
    haptics.selection();
    sound.tap();
    setAdvancedOpen((open) => !open);
  };

  const dial = ([control, label]: [ManualControl, string], size: number) => (
    <RotaryDial key={control} min={0} max={100} step={1} diameter={size} label={label} value={values[control]} valueSuffix="%" onValueChange={(value) => values.setValue(control, value)} />
  );

  return (
    <ScrollView bounces={false} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Manual</Text>
      <View style={styles.grid}>
        {primaryControls.map((item) => <View key={item[0]} style={[styles.column, { width: columnWidth }]}>{dial(item, diameter)}</View>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} onPress={toggleAdvanced} style={styles.advancedButton}>
        <Text style={styles.advancedText}>Advanced {advancedOpen ? '⌃' : '⌄'}</Text>
      </Pressable>
      {advancedOpen ? <View style={styles.advanced}>
        <View style={styles.advancedRow}>
          {advancedControls.map((item) => <View key={item[0]} style={styles.advancedColumn}>{dial(item, advancedDiameter)}</View>)}
        </View>
        <View accessible accessibilityLabel="Illustrative waveform preview based on Bass, Mid, and Treble settings" style={styles.waveform}>
          <Svg width="100%" height={100} viewBox="0 0 300 100">
            <Path d={manualWaveformPath(values.bass, values.mid, values.treble)} fill="none" stroke={theme.colors.text} strokeWidth={2} />
          </Svg>
        </View>
        <Text style={styles.waveformLabel}>Illustrative waveform preview</Text>
      </View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.xl, columnGap: theme.spacing.md, marginTop: theme.spacing.xl },
  column: { alignItems: 'center' },
  advancedButton: { minHeight: theme.sizing.minimumTouchTarget, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.text, marginTop: theme.spacing.xl },
  advancedText: { ...theme.typography.segment, color: theme.colors.text },
  advanced: { marginTop: theme.spacing.lg },
  advancedRow: { flexDirection: 'row', gap: theme.spacing.sm },
  advancedColumn: { flex: 1, alignItems: 'center' },
  waveform: { borderWidth: 1, borderColor: theme.colors.border, marginTop: theme.spacing.xl },
  waveformLabel: { ...theme.typography.segment, color: theme.colors.secondaryText, marginTop: theme.spacing.sm },
});
