import type { FeedbackSound } from './useSoundFeedback';

let audioContext: AudioContext | null = null;

export function playWebFeedback(sound: FeedbackSound) {
  if (typeof AudioContext === 'undefined') return;
  const context = audioContext ??= new AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => {});

  const start = context.currentTime;
  const duration = sound === 'tick' ? 0.045 : sound === 'tap' ? 0.075 : 0.13;
  const frequency = sound === 'tick' ? 820 : sound === 'tap' ? 570 : 660;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(sound === 'tap' ? 0.14 : 0.1, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(start);
  oscillator.stop(start + duration);
}
