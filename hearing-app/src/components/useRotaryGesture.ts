/* eslint-disable react-hooks/immutability -- Gesture worklets update Reanimated shared values on the UI thread. */
import { usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { angleToValue, clamp, pointerAngle, shortestAngleDelta, START_ANGLE, stepScale, SWEEP_ANGLE, valueToAngle } from './rotaryMath';

type Options = {
  value: number;
  min: number;
  max: number;
  step: number;
  diameter: number;
  onValueChange: (value: number) => void;
};

export function useRotaryGesture({ value, min, max, step, diameter, onValueChange }: Options) {
  const angle = useSharedValue(valueToAngle(value, min, max));
  const lastPointer = useSharedValue<number | null>(null);
  const lastValue = useSharedValue(clamp(value, min, max));
  const dragging = useSharedValue(false);
  const radius = diameter / 2;
  const scale = stepScale(min, step);

  useAnimatedReaction(
    () => clamp(value, min, max),
    (nextValue, previousValue) => {
      if (nextValue !== previousValue && !dragging.value) {
        angle.value = withTiming(valueToAngle(nextValue, min, max), { duration: 120 });
        lastValue.value = nextValue;
      }
    },
  );

  const gesture = usePanGesture({
    minDistance: 1,
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      dragging.value = true;
      const distance = Math.hypot(event.x - radius, event.y - radius);
      lastPointer.value = distance < radius * 0.22 ? null : pointerAngle(event.x, event.y, radius);
    },
    onUpdate: (event) => {
      'worklet';
      const distance = Math.hypot(event.x - radius, event.y - radius);
      if (distance < radius * 0.22) {
        lastPointer.value = null;
        return;
      }
      const currentPointer = pointerAngle(event.x, event.y, radius);
      if (lastPointer.value === null) {
        lastPointer.value = currentPointer;
        return;
      }
      angle.value = clamp(angle.value + shortestAngleDelta(lastPointer.value, currentPointer), START_ANGLE, START_ANGLE + SWEEP_ANGLE);
      lastPointer.value = currentPointer;
      const nextValue = angleToValue(angle.value, min, max, step, scale);
      if (nextValue !== lastValue.value) {
        lastValue.value = nextValue;
        scheduleOnRN(onValueChange, nextValue);
      }
    },
    onFinalize: () => {
      'worklet';
      dragging.value = false;
      lastPointer.value = null;
      angle.value = withTiming(valueToAngle(lastValue.value, min, max), { duration: 120 });
    },
  });

  return { angle, gesture };
}
