import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deviceService } from '../device/deviceService';
import type { CalibrationResult, CalibrationStatus, DeviceMode } from '../device/types';
import { type HearingTestDocument, restoreHearingTestDocument } from '../hearingTest/document';
import { type ToneTestResult, restoreToneTestResult } from '../hearingTest/toneTest';
import { type HearingPreferences, type PreliminaryAudioProfile, restoreHearingPreferences, toPreliminaryAudioProfile } from './hearingPreferences';
import { migrateLegacyState, shouldSkipOnboarding } from './legacyState';
import { isEqControl, migratePercentEqGain, normalizeEqGain, normalizeManualValue, restoreSharedVolume, type ManualControl } from './manualValues';

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
  onboardingCompleted: boolean;
  hearingTestFile: HearingTestDocument | null;
  hearingTestResponses: boolean[] | null;
  hearingTestResult: ToneTestResult | null;
  hearingPreferences: HearingPreferences | null;
  preliminaryAudioProfile: PreliminaryAudioProfile | null;
  setVolume: (value: number) => void;
  setValue: (control: ManualControl, value: number) => void;
  setActiveMode: (mode: DeviceMode) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setSoundFeedbackEnabled: (enabled: boolean) => void;
  recalibrate: () => Promise<boolean>;
  saveHearingTestFile: (file: HearingTestDocument) => void;
  clearHearingTestFile: () => void;
  saveHearingTestResult: (result: ToneTestResult) => void;
  completeOnboarding: (preferences: HearingPreferences) => void;
  restartOnboarding: () => void;
};

type SavedAppState = Pick<AppState, ManualControl | 'volume' | 'activeMode' | 'hapticsEnabled' | 'soundFeedbackEnabled' | 'lastResult' | 'onboardingCompleted' | 'hearingTestFile' | 'hearingTestResponses' | 'hearingTestResult' | 'hearingPreferences'>;

const storage = createJSONStorage<Partial<SavedAppState>>(() => ({
  getItem: async (name) => {
    const current = await AsyncStorage.getItem(name);
    if (current !== null) return current;
    const previous = await Promise.all([
      AsyncStorage.getItem('hearing-app-calibration'),
      AsyncStorage.getItem('hearing-app-manual'),
      AsyncStorage.getItem('hearing-app-feedback'),
    ]);
    return previous.some((value) => value !== null)
      ? JSON.stringify({ state: { ...migrateLegacyState(previous), onboardingCompleted: true }, version: 1 })
      : null;
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
      noiseReduction: 50,
      reduceLoudSounds: 0,
      spatialFocus: 0,
      speechAmplification: 50,
      bass: 0,
      mid: 0,
      treble: 0,
      eq250: 0,
      eq500: 0,
      eq2000: 0,
      eq4000: 0,
      activeMode: 'automatic',
      hapticsEnabled: true,
      soundFeedbackEnabled: true,
      calibrationStatus: 'idle',
      lastResult: null,
      transportError: null,
      hydrated: false,
      onboardingCompleted: false,
      hearingTestFile: null,
      hearingTestResponses: null,
      hearingTestResult: null,
      hearingPreferences: null,
      preliminaryAudioProfile: null,
      setVolume: (value) => {
        const volume = normalizeManualValue(value);
        if (volume === null) return;
        set({ volume, transportError: null });
        void deviceService.setVolume(volume).catch((error) => set({ transportError: errorMessage(error) }));
      },
      setValue: (control, value) => {
        const normalized = isEqControl(control) ? normalizeEqGain(value) : normalizeManualValue(value);
        if (normalized === null) return;
        set({ [control]: normalized, transportError: null });
        const command = control === 'noiseReduction' ? deviceService.setNoiseReduction(normalized)
          : control === 'reduceLoudSounds' ? deviceService.setReduceLoudSounds(normalized)
          : control === 'spatialFocus' ? deviceService.setSpatialFocus(normalized)
          : control === 'speechAmplification' ? deviceService.setSpeechAmplification(normalized)
          : control === 'bass' ? deviceService.setBass(normalized)
          : control === 'mid' ? deviceService.setMid(normalized)
          : control === 'treble' ? deviceService.setTreble(normalized)
          : deviceService.setFineEq(Number(control.slice(2)) as 250 | 500 | 2000 | 4000, normalized);
        void command.catch((error) => set({ transportError: errorMessage(error) }));
      },
      setActiveMode: (activeMode) => set({ activeMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundFeedbackEnabled: (soundFeedbackEnabled) => set({ soundFeedbackEnabled }),
      saveHearingTestFile: (hearingTestFile) => set({ hearingTestFile, hearingTestResponses: null, hearingTestResult: null }),
      clearHearingTestFile: () => set({ hearingTestFile: null }),
      saveHearingTestResult: (hearingTestResult) => set({ hearingTestResult, hearingTestResponses: null, hearingTestFile: null }),
      completeOnboarding: (hearingPreferences) => set({ hearingPreferences, preliminaryAudioProfile: toPreliminaryAudioProfile(hearingPreferences), onboardingCompleted: true }),
      restartOnboarding: () => set({ onboardingCompleted: false }),
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
      version: 4,
      storage,
      migrate: (persisted, version) => {
        const saved = persisted as Partial<SavedAppState>;
        if (version < 4) { saved.spatialFocus = 0; saved.reduceLoudSounds = 0; }
        return version < 2
          ? { ...saved, bass: migratePercentEqGain(saved.bass), mid: migratePercentEqGain(saved.mid), treble: migratePercentEqGain(saved.treble) }
          : saved;
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SavedAppState> & { baseVolume?: unknown };
        const hearingPreferences = restoreHearingPreferences(saved.hearingPreferences);
        const percent = (value: unknown, fallback: number) =>
          typeof value === 'number' ? normalizeManualValue(value) ?? fallback : fallback;
        return {
          ...current,
          volume: restoreSharedVolume(saved.volume, saved.baseVolume, current.volume),
          noiseReduction: percent(saved.noiseReduction, current.noiseReduction),
          reduceLoudSounds: percent(saved.reduceLoudSounds, current.reduceLoudSounds),
          spatialFocus: percent(saved.spatialFocus, current.spatialFocus),
          speechAmplification: percent(saved.speechAmplification, current.speechAmplification),
          bass: typeof saved.bass === 'number' ? normalizeEqGain(saved.bass) ?? current.bass : current.bass,
          mid: typeof saved.mid === 'number' ? normalizeEqGain(saved.mid) ?? current.mid : current.mid,
          treble: typeof saved.treble === 'number' ? normalizeEqGain(saved.treble) ?? current.treble : current.treble,
          eq250: typeof saved.eq250 === 'number' ? normalizeEqGain(saved.eq250) ?? 0 : 0,
          eq500: typeof saved.eq500 === 'number' ? normalizeEqGain(saved.eq500) ?? 0 : 0,
          eq2000: typeof saved.eq2000 === 'number' ? normalizeEqGain(saved.eq2000) ?? 0 : 0,
          eq4000: typeof saved.eq4000 === 'number' ? normalizeEqGain(saved.eq4000) ?? 0 : 0,
          activeMode: saved.activeMode === 'manual' ? 'manual' : 'automatic',
          hapticsEnabled: typeof saved.hapticsEnabled === 'boolean' ? saved.hapticsEnabled : current.hapticsEnabled,
          soundFeedbackEnabled: typeof saved.soundFeedbackEnabled === 'boolean' ? saved.soundFeedbackEnabled : current.soundFeedbackEnabled,
          lastResult: validResult(saved.lastResult) ? saved.lastResult : null,
          onboardingCompleted: shouldSkipOnboarding(saved, persisted !== undefined),
          hearingTestFile: restoreHearingTestDocument(saved.hearingTestFile),
          hearingTestResponses: Array.isArray(saved.hearingTestResponses) && saved.hearingTestResponses.every((value) => typeof value === 'boolean') ? saved.hearingTestResponses : null,
          hearingTestResult: restoreToneTestResult(saved.hearingTestResult),
          hearingPreferences,
          preliminaryAudioProfile: hearingPreferences ? toPreliminaryAudioProfile(hearingPreferences) : null,
        };
      },
      partialize: ({ volume, noiseReduction, reduceLoudSounds, spatialFocus, speechAmplification, bass, mid, treble, eq250, eq500, eq2000, eq4000, activeMode, hapticsEnabled, soundFeedbackEnabled, lastResult, onboardingCompleted, hearingTestFile, hearingTestResponses, hearingTestResult, hearingPreferences }) =>
        ({ volume, noiseReduction, reduceLoudSounds, spatialFocus, speechAmplification, bass, mid, treble, eq250, eq500, eq2000, eq4000, activeMode, hapticsEnabled, soundFeedbackEnabled, lastResult, onboardingCompleted, hearingTestFile, hearingTestResponses, hearingTestResult, hearingPreferences }),
      onRehydrateStorage: () => (state, error) => {
        if (state) {
          void Promise.all([
            deviceService.setVolume(state.volume),
            deviceService.setNoiseReduction(state.noiseReduction),
            deviceService.setReduceLoudSounds(state.reduceLoudSounds),
            deviceService.setSpatialFocus(state.spatialFocus),
            deviceService.setSpeechAmplification(state.speechAmplification),
            deviceService.setBass(state.bass),
            deviceService.setMid(state.mid),
            deviceService.setTreble(state.treble),
            deviceService.setFineEq(250, state.eq250),
            deviceService.setFineEq(500, state.eq500),
            deviceService.setFineEq(2000, state.eq2000),
            deviceService.setFineEq(4000, state.eq4000),
          ]).catch((commandError) => useAppStore.setState({ transportError: errorMessage(commandError) }));
        }
        useAppStore.setState({ hydrated: true, transportError: error ? errorMessage(error) : null });
      },
    },
  ),
);
