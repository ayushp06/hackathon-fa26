import { mockDeviceService } from './mockDeviceService';
import type { DeviceService } from './types';

// Replace this binding when the STM32 BLE protocol and native transport are ready.
export const deviceService: DeviceService = mockDeviceService;
