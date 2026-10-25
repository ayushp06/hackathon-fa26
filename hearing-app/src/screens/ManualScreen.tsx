import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { advancedDialDiameter, manualDialDiameter, theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import type { ManualControl } from '../state/manualValues';
import { useAppStore } from '../state/useAppStore';
import { manualWaveformPath } from './manualWaveform';

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
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function ManualScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const values = useAppStore();
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const [viewportHeight, setViewportHeight] = useState(Infinity);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedHeight = useSharedValue(0);
  const animatedBass = useSharedValue(values.bass);
  const animatedMid = useSharedValue(values.mid);
  const animatedTreble = useSharedValue(values.treble);
  const animatedNoise = useSharedValue(values.noiseReduction);
  const animatedFocus = useSharedValue(values.spatialFocus);
  const animatedSpeech = useSharedValue(values.speechAmplification);
  useEffect(() => { animatedBass.value = withTiming(values.bass, { duration: 180 }); }, [animatedBass, values.bass]);
  useEffect(() => { animatedMid.value = withTiming(values.mid, { duration: 180 }); }, [animatedMid, values.mid]);
  useEffect(() => { animatedTreble.value = withTiming(values.treble, { duration: 180 }); }, [animatedTreble, values.treble]);
  useEffect(() => { animatedNoise.value = withTiming(values.noiseReduction, { duration: 180 }); }, [animatedNoise, values.noiseReduction]);
  useEffect(() => { animatedFocus.value = withTiming(values.spatialFocus, { duration: 180 }); }, [animatedFocus, values.spatialFocus]);
  useEffect(() => { animatedSpeech.value = withTiming(values.speechAmplification, { duration: 180 }); }, [animatedSpeech, values.speechAmplification]);
  const waveformProps = useAnimatedProps(() => ({ d: manualWaveformPath(animatedBass.value, animatedMid.value, animatedTreble.value, animatedNoise.value, animatedFocus.value, animatedSpeech.value) }));
  const advancedStyle = useAnimatedStyle(() => ({
    height: withTiming(advancedOpen ? advancedHeight.value : 0, { duration: 260 }),
    opacity: withTiming(advancedOpen ? 1 : 0, { duration: 220 }),
  }));
  const diameter = manualDialDiameter(width, viewportHeight);
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

  return (
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} contentContainerStyle={styles.content}>
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
          <View accessible accessibilityLabel="Synthetic sound waveform preview; no microphone audio" style={styles.waveform}>
            <Svg width="100%" height={180} viewBox="0 0 300 100">
              <AnimatedPath animatedProps={waveformProps} fill="none" stroke={theme.colors.text} strokeWidth={2} />
            </Svg>
          </View>
          <Text style={styles.waveformLabel}>Synthetic sound preview · no microphone audio</Text>
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
  waveform: { borderWidth: 1, borderColor: theme.colors.border, marginTop: theme.spacing.xl },
  waveformLabel: { ...theme.typography.segment, color: theme.colors.secondaryText, marginTop: theme.spacing.sm },
});
