import type { FeedbackSound } from './useSoundFeedback';

export function isReady(lastTime: number, now: number, interval: number) {
  return now - lastTime >= interval;
}

export function isSoundReady(sound: FeedbackSound, activeSound: FeedbackSound | null, busyUntil: number, now: number) {
  return sound === 'confirm' || now >= busyUntil || (sound === 'tap' && activeSound === 'tick');
}
