import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeManualValue, type ManualControl } from './manualValues';

type ManualState = Record<ManualControl, number> & {
  setValue: (control: ManualControl, value: number) => void;
};

export const useManualStore = create<ManualState>()(
  persist(
    (set) => ({
      baseVolume: 50,
      noiseReduction: 50,
      spatialFocus: 50,
      setValue: (control, value) => {
        const normalized = normalizeManualValue(value);
        if (normalized !== null) set((state) => ({ ...state, [control]: normalized }));
      },
    }),
    {
      name: 'hearing-app-manual',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ baseVolume, noiseReduction, spatialFocus }) => ({ baseVolume, noiseReduction, spatialFocus }),
    },
  ),
);
