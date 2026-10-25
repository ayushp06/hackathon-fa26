/* eslint-disable react-hooks/immutability -- Shared values drive the preview during dial and graph gestures. */
import { useEffect, useState } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { eqBands, type EqControl } from '../state/manualValues';
import { frequencyResponsePath, manualWaveformPath, responseBandAtX, responseGainAtY, responseX, responseY } from './manualWaveform';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ink = theme.colors.text;
const cream = theme.colors.background;
const muted = '#BFB9AE';
const grid = '#4A4946';

type Props = {
  gains: number[];
  noiseReduction: number;
  spatialFocus: number;
  speechAmplification: number;
  onEqChange: (band: EqControl, value: number) => void;
};

export function EditableWaveform({ gains, noiseReduction, spatialFocus, speechAmplification, onEqChange }: Props) {
  const [width, setWidth] = useState(300);
  const animatedBass = useSharedValue(gains[0]);
  const animatedMid = useSharedValue(gains[3]);
  const animatedTreble = useSharedValue(gains[6]);
  const animatedNoise = useSharedValue(noiseReduction);
  const animatedFocus = useSharedValue(spatialFocus);
  const animatedSpeech = useSharedValue(speechAmplification);
  const activeBand = useSharedValue<EqControl>('bass');
  const lastGain = useSharedValue(0);

  useEffect(() => { animatedBass.value = withTiming(gains[0], { duration: 150 }); }, [animatedBass, gains]);
  useEffect(() => { animatedMid.value = withTiming(gains[3], { duration: 150 }); }, [animatedMid, gains]);
  useEffect(() => { animatedTreble.value = withTiming(gains[6], { duration: 150 }); }, [animatedTreble, gains]);
  useEffect(() => { animatedNoise.value = withTiming(noiseReduction, { duration: 150 }); }, [animatedNoise, noiseReduction]);
  useEffect(() => { animatedFocus.value = withTiming(spatialFocus, { duration: 150 }); }, [animatedFocus, spatialFocus]);
  useEffect(() => { animatedSpeech.value = withTiming(speechAmplification, { duration: 150 }); }, [animatedSpeech, speechAmplification]);

  const waveformProps = useAnimatedProps(() => ({ d: manualWaveformPath(animatedBass.value, animatedMid.value, animatedTreble.value, animatedNoise.value, animatedFocus.value, animatedSpeech.value, gains[1], gains[2], gains[4], gains[5]) }));

  const changeBand = (band: EqControl, value: number) => {
    if (band === 'bass') animatedBass.value = value;
    else if (band === 'mid') animatedMid.value = value;
    else if (band === 'treble') animatedTreble.value = value;
    onEqChange(band, value);
  };

  const gesture = usePanGesture({
    minDistance: 1,
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      activeBand.value = responseBandAtX(event.x, width);
      lastGain.value = gains[eqBands.findIndex((band) => band.control === activeBand.value)];
    },
    onUpdate: (event) => {
      'worklet';
      const gain = responseGainAtY(event.y);
      if (gain === lastGain.value) return;
      lastGain.value = gain;
      scheduleOnRN(changeBand, activeBand.value, gain);
    },
  });
  const responsePath = frequencyResponsePath(width, gains);

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Frequency response</Text>
        <Text style={styles.badge}>{width < 290 ? 'EQ' : 'EQ PREVIEW'}</Text>
      </View>
      <Text style={styles.instruction}>Drag any frequency point to fine tune its gain.</Text>
      <GestureDetector gesture={gesture}>
        <View accessible accessibilityRole="image" accessibilityLabel="Illustrative seven band frequency response editor. Drag a point up or down. Buttons below provide accessible fine adjustments." onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.responseChart}>
          <Svg width={width} height={190} pointerEvents="none">
            {[-12, 0, 12].map((gain) => <Line key={gain} x1={38} x2={width - 16} y1={responseY(gain)} y2={responseY(gain)} stroke={grid} strokeWidth={gain === 0 ? 1.3 : 0.8} strokeDasharray={gain === 0 ? undefined : '3 4'} />)}
            {eqBands.map(({ frequency }) => <Line key={frequency} x1={responseX(frequency, width)} x2={responseX(frequency, width)} y1={30} y2={150} stroke={grid} strokeWidth={0.8} strokeDasharray="3 4" />)}
            {[-12, 0, 12].map((gain) => <SvgText key={gain} x={4} y={responseY(gain) + 4} fill={muted} fontSize={10}>{gain > 0 ? `+${gain}` : gain} dB</SvgText>)}
            {eqBands.map(({ frequency }) => <SvgText key={frequency} x={responseX(frequency, width)} y={176} fill={muted} fontSize={9} textAnchor="middle">{frequency >= 1000 ? `${frequency / 1000}k` : frequency}</SvgText>)}
            <Path d={responsePath} fill="none" stroke={cream} strokeOpacity={0.14} strokeWidth={7} />
            <Path d={responsePath} fill="none" stroke={cream} strokeWidth={2.2} />
            {eqBands.map(({ control, frequency }, index) => <G key={control}>
              <Circle cx={responseX(frequency, width)} cy={responseY(gains[index])} r={9} fill={ink} stroke={cream} strokeWidth={1.5} />
              <Circle cx={responseX(frequency, width)} cy={responseY(gains[index])} r={3} fill={cream} />
            </G>)}
          </Svg>
        </View>
      </GestureDetector>
      <View style={styles.fineControls}>
        {eqBands.filter(({ control }) => control.startsWith('eq')).map(({ control, frequency }) => {
          const value = gains[eqBands.findIndex((band) => band.control === control)];
          return <View key={control} style={styles.fineRow}>
            <Text style={styles.fineLabel}>{frequency >= 1000 ? `${frequency / 1000}k` : frequency} Hz</Text>
            <Text style={styles.fineValue}>{value > 0 ? '+' : ''}{value} dB</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${frequency} hertz gain`} disabled={value <= -12} onPress={() => onEqChange(control, value - 1)} style={styles.fineButton}><Text style={styles.fineButtonText}>−</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${frequency} hertz gain`} disabled={value >= 12} onPress={() => onEqChange(control, value + 1)} style={styles.fineButton}><Text style={styles.fineButtonText}>+</Text></Pressable>
          </View>;
        })}
      </View>
      <View style={styles.signalCard}>
        <View style={styles.signalHeader}>
          <Text style={styles.signalTitle}>Synthetic waveform</Text>
          <Text style={styles.signalNote}>{width < 290 ? '10 ms' : 'RELATIVE · 10 ms'}</Text>
        </View>
        <Svg width="100%" height={112} viewBox="0 0 300 112" preserveAspectRatio="none" pointerEvents="none">
          {[25, 50, 75].map((y) => <Line key={y} x1={0} x2={300} y1={y} y2={y} stroke={theme.colors.border} strokeWidth={y === 50 ? 1.2 : 0.7} />)}
          {[0, 150, 300].map((x) => <Line key={x} x1={x} x2={x} y1={10} y2={90} stroke={theme.colors.border} strokeWidth={0.7} />)}
          <AnimatedPath animatedProps={waveformProps} fill="none" stroke={ink} strokeWidth={1.35} />
          <SvgText x={0} y={108} fill={theme.colors.secondaryText} fontSize={10}>0</SvgText>
          <SvgText x={150} y={108} fill={theme.colors.secondaryText} fontSize={10} textAnchor="middle">5</SvgText>
          <SvgText x={300} y={108} fill={theme.colors.secondaryText} fontSize={10} textAnchor="end">10 ms</SvgText>
        </Svg>
      </View>
      <Text style={styles.disclaimer}>Relative level · illustrative signal, no live microphone or measured device output</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: ink, borderRadius: 12, padding: theme.spacing.md, marginTop: theme.spacing.xl, shadowColor: ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  heading: { color: cream, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  badge: { color: muted, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1 },
  instruction: { color: muted, fontSize: 13, lineHeight: 18, marginTop: theme.spacing.xs },
  responseChart: { marginTop: theme.spacing.sm, minHeight: 190, cursor: 'ns-resize' },
  fineControls: { marginTop: theme.spacing.sm },
  fineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderTopWidth: 1, borderTopColor: grid },
  fineLabel: { color: cream, flex: 1, fontSize: 13 },
  fineValue: { color: muted, width: 58, textAlign: 'right', marginRight: theme.spacing.sm, fontSize: 12 },
  fineButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fineButtonText: { color: cream, fontSize: 22 },
  signalCard: { backgroundColor: cream, borderRadius: 8, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, marginTop: theme.spacing.sm },
  signalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  signalTitle: { color: ink, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  signalNote: { color: theme.colors.secondaryText, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7 },
  disclaimer: { color: muted, fontSize: 11, lineHeight: 16, marginTop: theme.spacing.sm },
});
