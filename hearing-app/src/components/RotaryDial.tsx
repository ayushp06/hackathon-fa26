import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { angleToValue, clamp, START_ANGLE, stepScale, SWEEP_ANGLE, valueToAngle } from './rotaryMath';
import { useRotaryGesture } from './useRotaryGesture';

const AnimatedLine = Animated.createAnimatedComponent(Line);

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
  const currentValue = clamp(value, min, max);
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const handleValueChange = (nextValue: number) => {
    onValueChange(nextValue);
    haptics.dialStep(nextValue, min, max);
    sound.tick();
  };
  const { angle, gesture } = useRotaryGesture({ value: currentValue, min, max, step, diameter, onValueChange: handleValueChange });
  const trackRadius = radius - theme.sizing.dialTrackInset;
  const start = valueToAngle(min, min, max) * Math.PI / 180;
  const end = (START_ANGLE + SWEEP_ANGLE) * Math.PI / 180;
  const track = `M ${radius + Math.cos(start) * trackRadius} ${radius + Math.sin(start) * trackRadius} A ${trackRadius} ${trackRadius} 0 1 1 ${radius + Math.cos(end) * trackRadius} ${radius + Math.sin(end) * trackRadius}`;
  const indicator = useAnimatedProps(() => {
    const radians = angle.value * Math.PI / 180;
    return {
      x1: radius + Math.cos(radians) * (trackRadius - 10),
      y1: radius + Math.sin(radians) * (trackRadius - 10),
      x2: radius + Math.cos(radians) * (trackRadius + 2),
      y2: radius + Math.sin(radians) * (trackRadius + 2),
    };
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
          accessibilityValue={{ min, max, now: currentValue, text: `${currentValue}${valueSuffix}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') changeBy(1);
            if (event.nativeEvent.actionName === 'decrement') changeBy(-1);
          }}
          style={{ width: diameter, height: diameter }}
        >
          <Svg width={diameter} height={diameter} pointerEvents="none">
            <Circle cx={radius} cy={radius} r={radius - 1} fill={theme.colors.background} stroke={theme.colors.text} strokeWidth={2} />
            <Circle cx={radius} cy={radius} r={radius - theme.sizing.dialRim} fill={theme.colors.text} />
            <Path d={track} fill="none" stroke={theme.colors.background} strokeOpacity={0.45} strokeWidth={1} />
            <AnimatedLine animatedProps={indicator} stroke={theme.colors.background} strokeWidth={theme.sizing.dialIndicatorWidth} strokeLinecap="round" />
          </Svg>
          <View pointerEvents="none" style={styles.valueOverlay}>
            <Text style={[styles.value, { fontSize: diameter * theme.sizing.dialValueFontRatio }]}>{currentValue}{valueSuffix}</Text>
          </View>
        </View>
      </GestureDetector>
      <Text style={[styles.label, { width: diameter }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: theme.spacing.md },
  valueOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  value: { color: theme.colors.background, fontWeight: '500', fontVariant: ['tabular-nums'] },
  label: { ...theme.typography.segment, color: theme.colors.secondaryText, textAlign: 'center' },
});
