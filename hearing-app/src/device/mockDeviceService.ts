import type { DeviceService, HearingDevice } from './types';

const mockDevice: HearingDevice = { id: 'mock-device', name: 'Mock device' };

export const mockDeviceService: DeviceService = {
  async scan() {
    return [mockDevice];
  },
  async connect(id) {
    if (id !== mockDevice.id) throw new Error('Device not found');
    return mockDevice;
  },
  async disconnect() {},
};
