/* eslint-disable react-hooks/immutability -- Gesture worklets update Reanimated shared values on the UI thread. */
import { usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { angleToValue, clamp, magneticDialAngle, pointerAngle, shortestAngleDelta, START_ANGLE, stepScale, SWEEP_ANGLE, valueToAngle } from './rotaryMath';

type Options = {
  value: number;
  min: number;
  max: number;
  step: number;
  diameter: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  onInteractionStart: (value: number) => void;
  onInteractionEnd: (value: number, cancelled: boolean) => void;
};

export function useRotaryGesture({ value, min, max, step, diameter, disabled = false, onValueChange, onInteractionStart, onInteractionEnd }: Options) {
  const angle = useSharedValue(valueToAngle(value, min, max));
  const rawAngle = useSharedValue(valueToAngle(value, min, max));
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
        rawAngle.value = valueToAngle(nextValue, min, max);
        lastValue.value = nextValue;
      }
    },
  );

  const gesture = usePanGesture({
    enabled: !disabled,
    minDistance: 1,
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      dragging.value = true;
      scheduleOnRN(onInteractionStart, lastValue.value);
      rawAngle.value = valueToAngle(lastValue.value, min, max);
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
      rawAngle.value = clamp(rawAngle.value + shortestAngleDelta(lastPointer.value, currentPointer), START_ANGLE, START_ANGLE + SWEEP_ANGLE);
      angle.value = magneticDialAngle(rawAngle.value);
      lastPointer.value = currentPointer;
      const nextValue = angleToValue(angle.value, min, max, step, scale);
      if (nextValue !== lastValue.value) {
        lastValue.value = nextValue;
        scheduleOnRN(onValueChange, nextValue);
      }
    },
    onFinalize: (event) => {
      'worklet';
      dragging.value = false;
      lastPointer.value = null;
      rawAngle.value = valueToAngle(lastValue.value, min, max);
      angle.value = withTiming(valueToAngle(lastValue.value, min, max), { duration: 120 });
      scheduleOnRN(onInteractionEnd, lastValue.value, event.canceled);
    },
  });

  return { angle, gesture };
}
