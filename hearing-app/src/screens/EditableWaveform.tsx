/* eslint-disable react-hooks/immutability -- Shared values drive the preview during dial and graph gestures. */
import { useEffect, useState } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { theme } from '../../constants/theme';
import type { EqControl } from '../state/manualValues';
import { frequencyResponsePath, manualWaveformPath, responseBandAtX, responseGainAtY, responseX, responseY } from './manualWaveform';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const ink = theme.colors.text;
const cream = theme.colors.background;
const muted = '#BFB9AE';
const grid = '#4A4946';

type Props = {
  bass: number;
  mid: number;
  treble: number;
  noiseReduction: number;
  spatialFocus: number;
  speechAmplification: number;
  onEqChange: (band: EqControl, value: number) => void;
};

export function EditableWaveform({ bass, mid, treble, noiseReduction, spatialFocus, speechAmplification, onEqChange }: Props) {
  const [width, setWidth] = useState(300);
  const animatedBass = useSharedValue(bass);
  const animatedMid = useSharedValue(mid);
  const animatedTreble = useSharedValue(treble);
  const animatedNoise = useSharedValue(noiseReduction);
  const animatedFocus = useSharedValue(spatialFocus);
  const animatedSpeech = useSharedValue(speechAmplification);
  const activeBand = useSharedValue<EqControl>('bass');
  const lastGain = useSharedValue(0);

  useEffect(() => { animatedBass.value = withTiming(bass, { duration: 150 }); }, [animatedBass, bass]);
  useEffect(() => { animatedMid.value = withTiming(mid, { duration: 150 }); }, [animatedMid, mid]);
  useEffect(() => { animatedTreble.value = withTiming(treble, { duration: 150 }); }, [animatedTreble, treble]);
  useEffect(() => { animatedNoise.value = withTiming(noiseReduction, { duration: 150 }); }, [animatedNoise, noiseReduction]);
  useEffect(() => { animatedFocus.value = withTiming(spatialFocus, { duration: 150 }); }, [animatedFocus, spatialFocus]);
  useEffect(() => { animatedSpeech.value = withTiming(speechAmplification, { duration: 150 }); }, [animatedSpeech, speechAmplification]);

  const responseProps = useAnimatedProps(() => ({ d: frequencyResponsePath(width, animatedBass.value, animatedMid.value, animatedTreble.value) }));
  const waveformProps = useAnimatedProps(() => ({ d: manualWaveformPath(animatedBass.value, animatedMid.value, animatedTreble.value, animatedNoise.value, animatedFocus.value, animatedSpeech.value) }));
  const bassNodeProps = useAnimatedProps(() => ({ cy: responseY(animatedBass.value) }));
  const midNodeProps = useAnimatedProps(() => ({ cy: responseY(animatedMid.value) }));
  const trebleNodeProps = useAnimatedProps(() => ({ cy: responseY(animatedTreble.value) }));

  const changeBand = (band: EqControl, value: number) => {
    if (band === 'bass') animatedBass.value = value;
    else if (band === 'mid') animatedMid.value = value;
    else animatedTreble.value = value;
    onEqChange(band, value);
  };

  const gesture = usePanGesture({
    minDistance: 1,
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      activeBand.value = responseBandAtX(event.x, width);
      lastGain.value = activeBand.value === 'bass' ? bass : activeBand.value === 'mid' ? mid : treble;
    },
    onUpdate: (event) => {
      'worklet';
      const gain = responseGainAtY(event.y);
      if (gain === lastGain.value) return;
      lastGain.value = gain;
      scheduleOnRN(changeBand, activeBand.value, gain);
    },
  });

  const nodes = [
    { control: 'bass', label: 'BASS', frequency: 125, animatedProps: bassNodeProps },
    { control: 'mid', label: 'MID', frequency: 1000, animatedProps: midNodeProps },
    { control: 'treble', label: 'TREBLE', frequency: 8000, animatedProps: trebleNodeProps },
  ] as const;

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Frequency response</Text>
        <Text style={styles.badge}>{width < 290 ? 'EQ' : 'EQ PREVIEW'}</Text>
      </View>
      <Text style={styles.instruction}>Drag a point up or down to adjust its dial.</Text>
      <GestureDetector gesture={gesture}>
        <View accessible accessibilityRole="image" accessibilityLabel="Illustrative frequency response editor. Drag Bass, Mid or Treble up or down. The dials above are accessible alternatives." onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.responseChart}>
          <Svg width={width} height={190} pointerEvents="none">
            {[-12, 0, 12].map((gain) => <Line key={gain} x1={38} x2={width - 16} y1={responseY(gain)} y2={responseY(gain)} stroke={grid} strokeWidth={gain === 0 ? 1.3 : 0.8} strokeDasharray={gain === 0 ? undefined : '3 4'} />)}
            {[125, 1000, 8000].map((frequency) => <Line key={frequency} x1={responseX(frequency, width)} x2={responseX(frequency, width)} y1={30} y2={150} stroke={grid} strokeWidth={0.8} strokeDasharray="3 4" />)}
            {[-12, 0, 12].map((gain) => <SvgText key={gain} x={4} y={responseY(gain) + 4} fill={muted} fontSize={10}>{gain > 0 ? `+${gain}` : gain} dB</SvgText>)}
            {(width < 340 ? [125, 1000, 8000] : [20, 125, 1000, 8000, 20000]).map((frequency) => <SvgText key={frequency} x={responseX(frequency, width)} y={176} fill={muted} fontSize={10} textAnchor={frequency === 20000 ? 'end' : 'middle'}>{frequency === 20 ? '20 Hz' : frequency === 20000 ? '20k Hz' : frequency >= 1000 ? `${frequency / 1000}k` : frequency}</SvgText>)}
            <AnimatedPath animatedProps={responseProps} fill="none" stroke={cream} strokeOpacity={0.14} strokeWidth={7} />
            <AnimatedPath animatedProps={responseProps} fill="none" stroke={cream} strokeWidth={2.2} />
            {nodes.map(({ control, label, frequency, animatedProps }) => <G key={control}>
              <SvgText x={responseX(frequency, width)} y={18} fill={muted} fontSize={10} fontWeight="700" textAnchor="middle">{label}</SvgText>
              <AnimatedCircle cx={responseX(frequency, width)} animatedProps={animatedProps} r={11} fill={ink} stroke={cream} strokeWidth={1.5} />
              <AnimatedCircle cx={responseX(frequency, width)} animatedProps={animatedProps} r={4} fill={cream} />
            </G>)}
          </Svg>
        </View>
      </GestureDetector>
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
  signalCard: { backgroundColor: cream, borderRadius: 8, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, marginTop: theme.spacing.sm },
  signalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  signalTitle: { color: ink, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  signalNote: { color: theme.colors.secondaryText, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7 },
  disclaimer: { color: muted, fontSize: 11, lineHeight: 16, marginTop: theme.spacing.sm },
});
