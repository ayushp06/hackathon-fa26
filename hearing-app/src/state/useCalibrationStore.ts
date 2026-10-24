import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mockCalibrate, type MockCalibrationResult } from './mockCalibration';

export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;

type CalibrationState = {
  volume: number;
  status: 'idle' | 'loading' | 'complete' | 'error';
  lastResult: MockCalibrationResult | null;
  setVolume: (volume: number) => void;
  recalibrate: () => Promise<boolean>;
};

export const useCalibrationStore = create<CalibrationState>()(
  persist(
    (set, get) => ({
      volume: 50,
      status: 'idle',
      lastResult: null,
      setVolume: (volume) => {
        if (Number.isFinite(volume)) set({ volume: Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, Math.round(volume))) });
      },
      recalibrate: async () => {
        if (get().status === 'loading') return false;
        set({ status: 'loading' });
        try {
          const lastResult = await mockCalibrate(get().volume);
          set({ lastResult, status: 'complete' });
          return true;
        } catch {
          set({ status: 'error' });
          return false;
        }
      },
    }),
    {
      name: 'hearing-app-calibration',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ volume, lastResult }) => ({ volume, lastResult }),
    },
  ),
);
