import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deviceService } from '../device/deviceService';
import type { CalibrationResult, CalibrationStatus, DeviceMode } from '../device/types';
import { migrateLegacyState } from './legacyState';
import { normalizeManualValue, type ManualControl } from './manualValues';

export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;

type AppState = Record<ManualControl, number> & {
  volume: number;
  activeMode: DeviceMode;
  hapticsEnabled: boolean;
  soundFeedbackEnabled: boolean;
  calibrationStatus: CalibrationStatus;
  lastResult: CalibrationResult | null;
  transportError: string | null;
  hydrated: boolean;
  setVolume: (value: number) => void;
  setValue: (control: ManualControl, value: number) => void;
  setActiveMode: (mode: DeviceMode) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setSoundFeedbackEnabled: (enabled: boolean) => void;
  recalibrate: () => Promise<boolean>;
};

type SavedAppState = Pick<AppState, 'volume' | 'baseVolume' | 'noiseReduction' | 'spatialFocus' | 'activeMode' | 'hapticsEnabled' | 'soundFeedbackEnabled' | 'lastResult'>;

const storage = createJSONStorage<SavedAppState>(() => ({
  getItem: async (name) => {
    const current = await AsyncStorage.getItem(name);
    if (current !== null) return current;
    const previous = await Promise.all([
      AsyncStorage.getItem('hearing-app-calibration'),
      AsyncStorage.getItem('hearing-app-manual'),
      AsyncStorage.getItem('hearing-app-feedback'),
    ]);
    return JSON.stringify({ state: migrateLegacyState(previous), version: 1 });
  },
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
}));

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Device command failed';
}

function validResult(value: unknown): value is CalibrationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<CalibrationResult>;
  return typeof result.simulated === 'boolean'
    && typeof result.completedAt === 'string'
    && typeof result.volumePercent === 'number'
    && normalizeManualValue(result.volumePercent) === result.volumePercent;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      volume: 50,
      baseVolume: 50,
      noiseReduction: 50,
      spatialFocus: 50,
      activeMode: 'automatic',
      hapticsEnabled: true,
      soundFeedbackEnabled: false,
      calibrationStatus: 'idle',
      lastResult: null,
      transportError: null,
      hydrated: false,
      setVolume: (value) => {
        const volume = normalizeManualValue(value);
        if (volume === null) return;
        set({ volume, transportError: null });
        void deviceService.setVolume(volume, 'automatic').catch((error) => set({ transportError: errorMessage(error) }));
      },
      setValue: (control, value) => {
        const normalized = normalizeManualValue(value);
        if (normalized === null) return;
        set({ [control]: normalized, transportError: null });
        const command = control === 'baseVolume'
          ? deviceService.setVolume(normalized, 'manual')
          : control === 'noiseReduction'
            ? deviceService.setNoiseReduction(normalized)
            : deviceService.setSpatialFocus(normalized);
        void command.catch((error) => set({ transportError: errorMessage(error) }));
      },
      setActiveMode: (activeMode) => set({ activeMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundFeedbackEnabled: (soundFeedbackEnabled) => set({ soundFeedbackEnabled }),
      recalibrate: async () => {
        if (get().calibrationStatus === 'loading') return false;
        set({ calibrationStatus: 'loading', transportError: null });
        try {
          const lastResult = await deviceService.startCalibration(get().volume);
          set({ lastResult, calibrationStatus: 'complete' });
          return true;
        } catch (error) {
          set({ calibrationStatus: 'error', transportError: errorMessage(error) });
          return false;
        }
      },
    }),
    {
      name: 'hearing-app-state',
      version: 1,
      storage,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SavedAppState>;
        const percent = (value: unknown, fallback: number) =>
          typeof value === 'number' ? normalizeManualValue(value) ?? fallback : fallback;
        return {
          ...current,
          volume: percent(saved.volume, current.volume),
          baseVolume: percent(saved.baseVolume, current.baseVolume),
          noiseReduction: percent(saved.noiseReduction, current.noiseReduction),
          spatialFocus: percent(saved.spatialFocus, current.spatialFocus),
          activeMode: saved.activeMode === 'manual' ? 'manual' : 'automatic',
          hapticsEnabled: typeof saved.hapticsEnabled === 'boolean' ? saved.hapticsEnabled : current.hapticsEnabled,
          soundFeedbackEnabled: typeof saved.soundFeedbackEnabled === 'boolean' ? saved.soundFeedbackEnabled : current.soundFeedbackEnabled,
          lastResult: validResult(saved.lastResult) ? saved.lastResult : null,
        };
      },
      partialize: ({ volume, baseVolume, noiseReduction, spatialFocus, activeMode, hapticsEnabled, soundFeedbackEnabled, lastResult }) =>
        ({ volume, baseVolume, noiseReduction, spatialFocus, activeMode, hapticsEnabled, soundFeedbackEnabled, lastResult }),
      onRehydrateStorage: () => (state, error) => {
        if (state) {
          void Promise.all([
            deviceService.setVolume(state.volume, 'automatic'),
            deviceService.setVolume(state.baseVolume, 'manual'),
            deviceService.setNoiseReduction(state.noiseReduction),
            deviceService.setSpatialFocus(state.spatialFocus),
          ]).catch((commandError) => useAppStore.setState({ transportError: errorMessage(commandError) }));
        }
        useAppStore.setState({ hydrated: true, transportError: error ? errorMessage(error) : null });
      },
    },
  ),
);
