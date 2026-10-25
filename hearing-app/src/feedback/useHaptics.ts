import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useAppStore } from '../state/useAppStore';
import { isReady } from './feedbackTiming';

let lastDialAt = -Infinity;
let lastDetentAt = -Infinity;
let lastSelectionAt = -Infinity;
let lastSuccessAt = -Infinity;

export function useHaptics() {
  const enabled = useAppStore((state) => state.hapticsEnabled);
  const [reducedMotion, setReducedMotion] = useState(useReducedMotion());

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const dialStep = (value: number, min: number, max: number, landmark: boolean) => {
    if (!enabled || reducedMotion) return;
    const now = Date.now();
    const boundary = value === min || value === max;
    if (landmark) {
      if (!isReady(lastDetentAt, now, boundary ? 150 : 100)) return;
      lastDetentAt = now;
      lastDialAt = now;
      const result = Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
        : boundary ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) : Haptics.selectionAsync();
      void result.catch(() => {});
    } else {
      if (!isReady(lastDialAt, now, 80)) return;
      lastDialAt = now;
      const result = Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void result.catch(() => {});
    }
  };

  const selection = () => {
    if (!enabled || reducedMotion || !isReady(lastSelectionAt, Date.now(), 120)) return;
    lastSelectionAt = Date.now();
    const result = Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.selectionAsync();
    void result.catch(() => {});
  };

  const success = () => {
    if (!enabled || reducedMotion || !isReady(lastSuccessAt, Date.now(), 300)) return;
    lastSuccessAt = Date.now();
    const result = Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void result.catch(() => {});
  };

  return { dialStep, selection, success };
}
