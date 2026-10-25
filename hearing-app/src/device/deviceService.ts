import { mockDeviceService } from './mockDeviceService';
import type { DeviceService } from './types';
import { Platform } from 'react-native';
import { hardwareDeviceService } from './hardwareDeviceService';

export const hardwareMode = Platform.OS === 'web';
export const deviceService: DeviceService = hardwareMode ? hardwareDeviceService : mockDeviceService;
