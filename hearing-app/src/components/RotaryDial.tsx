import { useId } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { angleToValue, clamp, stepScale, valueToAngle } from './rotaryMath';
import { useRotaryGesture } from './useRotaryGesture';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  min: number;
  max: number;
  step: number;
  diameter: number;
  label: string;
  value: number;
  valueSuffix?: string;
  onValueChange: (value: number) => void;
};

export function RotaryDial({ min, max, step, diameter, label, value, valueSuffix = '', onValueChange }: Props) {
  if (![min, max, step, diameter, value].every(Number.isFinite) || max <= min || step <= 0 || diameter < 56) {
    throw new Error('RotaryDial requires finite values, max > min, step > 0, and diameter >= 56');
  }

  const radius = diameter / 2;
  const faceId = `dial-face-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const currentValue = clamp(value, min, max);
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const handleValueChange = (nextValue: number) => {
    onValueChange(nextValue);
    haptics.dialStep(nextValue, min, max);
    sound.tick();
  };
  const { angle, gesture } = useRotaryGesture({ value: currentValue, min, max, step, diameter, onValueChange: handleValueChange });
  const marks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4);
  const ticks = Array.from({ length: 9 }, (_, index) => min + (max - min) * index / 8);
  const readout = `${valueSuffix.trim() === 'dB' && currentValue > 0 ? '+' : ''}${currentValue}${valueSuffix}`;
  const indicator = useAnimatedProps(() => {
    const radians = angle.value * Math.PI / 180;
    const alongX = Math.cos(radians);
    const alongY = Math.sin(radians);
    const halfWidth = Math.max(4, radius * 0.055);
    const acrossX = -alongY * halfWidth;
    const acrossY = alongX * halfWidth;
    const baseX = radius + alongX * radius * 0.34;
    const baseY = radius + alongY * radius * 0.34;
    return { d: `M ${radius + alongX * radius * 0.49} ${radius + alongY * radius * 0.49} L ${baseX + acrossX} ${baseY + acrossY} L ${baseX - acrossX} ${baseY - acrossY} Z` };
  });

  const changeBy = (direction: number) => {
    const nextAngle = valueToAngle(clamp(currentValue + direction * step, min, max), min, max);
    const nextValue = angleToValue(nextAngle, min, max, step, stepScale(min, step));
    if (nextValue !== currentValue) handleValueChange(nextValue);
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: currentValue, text: readout }}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          aria-valuetext={readout}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') changeBy(1);
            if (event.nativeEvent.actionName === 'decrement') changeBy(-1);
          }}
          style={[styles.dialSurface, { width: diameter, height: diameter, borderRadius: radius }]}
        >
          <Svg width={diameter} height={diameter} pointerEvents="none">
            <Defs>
              <RadialGradient id={faceId} cx="35%" cy="25%" r="80%">
                <Stop offset="0%" stopColor="#303030" />
                <Stop offset="58%" stopColor="#202020" />
                <Stop offset="100%" stopColor="#101010" />
              </RadialGradient>
            </Defs>
            <Circle cx={radius} cy={radius} r={radius - 1} fill={theme.colors.background} stroke={theme.colors.text} strokeWidth={2} />
            <Circle cx={radius} cy={radius} r={radius - 5} fill="#0B0B0B" />
            <Circle cx={radius} cy={radius} r={radius - 8} fill={`url(#${faceId})`} />
            {ticks.map((tick, index) => {
              const radians = valueToAngle(tick, min, max) * Math.PI / 180;
              const inner = radius * (index % 2 === 0 ? 0.87 : 0.9);
              const outer = radius * 0.95;
              return <Line key={index} x1={radius + Math.cos(radians) * inner} y1={radius + Math.sin(radians) * inner} x2={radius + Math.cos(radians) * outer} y2={radius + Math.sin(radians) * outer} stroke={theme.colors.background} strokeOpacity={index % 2 === 0 ? 0.9 : 0.5} strokeWidth={index % 2 === 0 ? 1.5 : 1} />;
            })}
            {marks.map((mark) => {
              const radians = valueToAngle(mark, min, max) * Math.PI / 180;
              return <SvgText key={mark} x={radius + Math.cos(radians) * radius * 0.7} y={radius + Math.sin(radians) * radius * 0.7} fill={theme.colors.background} fontSize={Math.max(9, diameter * 0.07)} fontWeight="600" textAnchor="middle" alignmentBaseline="central">{mark}</SvgText>;
            })}
            <Circle cx={radius} cy={radius} r={radius * 0.31} fill="#1B1B1B" stroke="#666666" strokeOpacity={0.7} strokeWidth={1.2} />
            <Circle cx={radius} cy={radius} r={radius * 0.285} fill="#171717" />
            <AnimatedPath animatedProps={indicator} fill={theme.colors.background} />
          </Svg>
        </View>
      </GestureDetector>
      <View style={[styles.caption, { width: diameter }]}>
        <Text style={[styles.label, diameter >= 200 && styles.largeLabel]}>{label}</Text>
        <Text style={[styles.readout, diameter >= 200 && styles.largeReadout]}>{readout}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: theme.spacing.sm },
  dialSurface: { backgroundColor: theme.colors.background, shadowColor: theme.colors.text, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 7 },
  caption: { alignItems: 'center', gap: theme.spacing.xs },
  label: { ...theme.typography.segment, color: theme.colors.text, textAlign: 'center' },
  largeLabel: { fontSize: 17, lineHeight: 22 },
  readout: { fontSize: 16, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'], color: theme.colors.text },
  largeReadout: { fontSize: 19, lineHeight: 25 },
});
