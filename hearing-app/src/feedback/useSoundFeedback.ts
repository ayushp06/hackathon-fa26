import { createContext, useContext } from 'react';

export type FeedbackSound = 'tick' | 'tap' | 'confirm';
export const SoundFeedbackContext = createContext<(sound: FeedbackSound) => void>(() => {});

export function useSoundFeedback() {
  const play = useContext(SoundFeedbackContext);
  return {
    tick: () => play('tick'),
    tap: () => play('tap'),
    confirm: () => play('confirm'),
  };
}
