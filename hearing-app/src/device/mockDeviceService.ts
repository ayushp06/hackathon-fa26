import { mockCalibrate } from '../state/mockCalibration.ts';
import type { DeviceAcknowledgment, DeviceService, DeviceStatus, HearingDevice } from './types';

const mockDevice: HearingDevice = { id: 'mock-device', name: 'Mock device' };

export class MockDeviceTransport implements DeviceService {
  private sequence = 0;
  private status: DeviceStatus = {
    simulated: true,
    connected: false,
    volume: 50,
    noiseReduction: 50,
    reduceLoudSounds: 0,
    spatialFocus: 50,
    speechAmplification: 50,
    bass: 0,
    mid: 0,
    treble: 0,
    eq250: 0,
    eq500: 0,
    eq2000: 0,
    eq4000: 0,
    calibrationStatus: 'idle',
  };

  async scan() { return [mockDevice]; }

  async connect(id = mockDevice.id) {
    if (id !== mockDevice.id) throw new Error('Device not found');
    this.status.connected = true;
    return mockDevice;
  }

  async disconnect() { this.status.connected = false; }

  private async acknowledge(): Promise<DeviceAcknowledgment> {
    const sequence = ++this.sequence;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { accepted: true, simulated: true, sequence };
  }

  private assertPercent(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100) throw new RangeError('Control must be an integer from 0 to 100');
  }

  private assertEqGain(value: number) {
    if (!Number.isInteger(value) || value < -12 || value > 12) throw new RangeError('EQ gain must be an integer from -12 to +12 dB');
  }

  // The mock accepts commands without a connection so the app works without hardware.
  async setVolume(value: number) {
    this.assertPercent(value);
    this.status.volume = value;
    return this.acknowledge();
  }

  async setNoiseReduction(value: number) {
    this.assertPercent(value);
    this.status.noiseReduction = value;
    return this.acknowledge();
  }

  async setSpatialFocus(value: number) {
    this.assertPercent(value);
    this.status.spatialFocus = value;
    return this.acknowledge();
  }

  async setReduceLoudSounds(value: number) {
    this.assertPercent(value);
    this.status.reduceLoudSounds = value;
    return this.acknowledge();
  }

  async setSpeechAmplification(value: number) {
    this.assertPercent(value);
    this.status.speechAmplification = value;
    return this.acknowledge();
  }

  async setBass(value: number) {
    this.assertEqGain(value);
    this.status.bass = value;
    return this.acknowledge();
  }

  async setMid(value: number) {
    this.assertEqGain(value);
    this.status.mid = value;
    return this.acknowledge();
  }

  async setTreble(value: number) {
    this.assertEqGain(value);
    this.status.treble = value;
    return this.acknowledge();
  }

  async setFineEq(frequency: 250 | 500 | 2000 | 4000, value: number) {
    if (![250, 500, 2000, 4000].includes(frequency)) throw new RangeError('Unsupported EQ frequency');
    this.assertEqGain(value);
    this.status[`eq${frequency}`] = value;
    return this.acknowledge();
  }

  async startCalibration(volume: number) {
    this.status.calibrationStatus = 'loading';
    try {
      const result = await mockCalibrate(volume);
      this.status.calibrationStatus = 'complete';
      return result;
    } catch (error) {
      this.status.calibrationStatus = 'error';
      throw error;
    }
  }

  async getStatus() { return { ...this.status }; }
}

export const mockDeviceService = new MockDeviceTransport();
