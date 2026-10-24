import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type FeedbackSettings = {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
};

export const useFeedbackSettings = create<FeedbackSettings>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      soundEnabled: false,
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: 'hearing-app-feedback',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hapticsEnabled, soundEnabled }) => ({ hapticsEnabled, soundEnabled }),
    },
  ),
);
