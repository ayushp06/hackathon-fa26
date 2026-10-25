import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { advancedDialDiameter, manualDialDiameter, theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';
import { isDialLandmark } from '../components/rotaryMath';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import type { EqControl, ManualControl } from '../state/manualValues';
import { useAppStore } from '../state/useAppStore';
import { EditableWaveform } from './EditableWaveform';

type DialControl = ManualControl | 'volume';

const primaryControls: [DialControl, string][] = [
  ['volume', 'Volume/Gain'],
  ['noiseReduction', 'Background Noise Reduction'],
  ['spatialFocus', 'Spatial Focus'],
  ['speechAmplification', 'Speech Amplification'],
];

const advancedControls: [DialControl, string][] = [
  ['bass', 'Bass'], ['mid', 'Mid'], ['treble', 'Treble'],
];
export function ManualScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const values = useAppStore();
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const [viewport, setViewport] = useState({ width: windowWidth, height: Infinity });
  const width = Math.min(windowWidth, viewport.width);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedHeight = useSharedValue(0);
  const advancedStyle = useAnimatedStyle(() => ({
    height: withTiming(advancedOpen ? advancedHeight.value : 0, { duration: 260 }),
    opacity: withTiming(advancedOpen ? 1 : 0, { duration: 220 }),
  }));
  const diameter = manualDialDiameter(width, viewport.height);
  const advancedDiameter = advancedDialDiameter(width);
  const columnWidth = (Math.min(width, theme.sizing.contentMaxWidth) - theme.spacing.lg * 2 - theme.spacing.md) / 2;

  const toggleAdvanced = () => {
    haptics.selection();
    sound.tap();
    setAdvancedOpen((open) => !open);
  };

  const goHome = () => {
    haptics.selection();
    sound.tap();
    router.replace('/');
  };

  const dial = ([control, label]: [DialControl, string], size: number) => {
    const eq = control === 'bass' || control === 'mid' || control === 'treble';
    return <RotaryDial key={control} min={eq ? -12 : 0} max={eq ? 12 : 100} step={1} diameter={size} label={label} value={values[control]} valueSuffix={eq ? ' dB' : '%'} onValueChange={(value) => control === 'volume' ? values.setVolume(value) : values.setValue(control, value)} />;
  };

  const changeEqFromGraph = (band: EqControl, value: number) => {
    values.setValue(band, value);
    const landmark = isDialLandmark(value, -12, 12);
    haptics.dialStep(value, -12, 12, landmark);
    if (landmark) sound.tap();
    else sound.tick();
  };

  return (
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} onLayout={(event) => setViewport({ width: event.nativeEvent.layout.width + theme.spacing.lg * 2, height: event.nativeEvent.layout.height })} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={goHome} style={styles.backButton}><Text style={styles.backText}>‹ Home</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Manual Recalibration</Text>
      <Text style={styles.description}>Adjust each dial to shape your sound. Changes save automatically.</Text>
      <View style={styles.grid}>
        {primaryControls.map((item) => <View key={item[0]} style={[styles.column, { width: columnWidth }]}>{dial(item, diameter)}</View>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} onPress={toggleAdvanced} style={styles.advancedButton}>
        <Text style={styles.advancedText}>Advanced</Text>
        <Svg width={16} height={16} viewBox="0 0 16 16" pointerEvents="none"><Path d={advancedOpen ? 'M 2 11 L 8 5 L 14 11' : 'M 2 5 L 8 11 L 14 5'} fill="none" stroke={theme.colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      </Pressable>
      <Animated.View style={[styles.advancedClip, advancedStyle]} pointerEvents={advancedOpen ? 'auto' : 'none'} importantForAccessibility={advancedOpen ? 'auto' : 'no-hide-descendants'} aria-hidden={!advancedOpen}>
        <View onLayout={(event) => { advancedHeight.value = event.nativeEvent.layout.height; }} style={styles.advanced}>
          <View style={styles.advancedRow}>
            {advancedControls.map((item) => <View key={item[0]} style={styles.advancedColumn}>{dial(item, advancedDiameter)}</View>)}
          </View>
          <EditableWaveform bass={values.bass} mid={values.mid} treble={values.treble} noiseReduction={values.noiseReduction} spatialFocus={values.spatialFocus} speechAmplification={values.speechAmplification} onEqChange={changeEqFromGraph} />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center' },
  backText: { ...theme.typography.segment, color: theme.colors.secondaryText },
  title: { ...theme.typography.title, color: theme.colors.text, marginTop: theme.spacing.sm },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.secondaryText, marginTop: theme.spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.lg, columnGap: theme.spacing.md, marginTop: theme.spacing.xl },
  column: { alignItems: 'center' },
  advancedButton: { minHeight: theme.sizing.minimumTouchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.text, borderRadius: theme.sizing.segmentRadius, marginTop: theme.spacing.xl },
  advancedText: { ...theme.typography.segment, color: theme.colors.text },
  advancedClip: { overflow: 'hidden' },
  advanced: { paddingTop: theme.spacing.lg },
  advancedRow: { flexDirection: 'row', gap: theme.spacing.sm },
  advancedColumn: { flex: 1, alignItems: 'center' },
});
