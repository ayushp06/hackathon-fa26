import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deviceService } from '../device/deviceService';
import type { HearingDevice } from '../device/types';

type DeviceState = {
  devices: HearingDevice[];
  connectedDevice: HearingDevice | null;
  lastDeviceId: string | null;
  error: string | null;
  scan: () => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
};

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      devices: [],
      connectedDevice: null,
      lastDeviceId: null,
      error: null,
      scan: async () => {
        try {
          set({ devices: await deviceService.scan(), error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Scan failed' });
        }
      },
      connect: async (id) => {
        try {
          const connectedDevice = await deviceService.connect(id);
          set({ connectedDevice, lastDeviceId: id, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Connection failed' });
        }
      },
      disconnect: async () => {
        try {
          await deviceService.disconnect();
          set({ connectedDevice: null, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Disconnect failed' });
        }
      },
    }),
    {
      name: 'hearing-app-device',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ lastDeviceId }) => ({ lastDeviceId }),
    },
  ),
);
