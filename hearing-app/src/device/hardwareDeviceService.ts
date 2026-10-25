import type { CalibrationResult, DeviceAcknowledgment, DeviceService, DeviceStatus, HearingDevice } from './types';

const address = 'http://127.0.0.1:8765/api';
type Control = 'volume' | 'noiseReduction' | 'reduceLoudSounds' | 'spatialFocus' | 'speechAmplification' | 'bass' | 'mid' | 'treble' | 'eq250' | 'eq500' | 'eq2000' | 'eq4000';
export type HardwareStatus = DeviceStatus & {
  streaming: boolean;
  error: string | null;
  primaryRms: number;
  referenceRms: number;
  outputRms: number;
  filter: string;
  referenceClock: boolean;
};

export class HardwareDeviceService implements DeviceService {
  private connected = false;
  private connecting = false;
  private desired = new Map<Control, number>();
  private waiting = new Map<Control, { value: number; resolve: (ack: DeviceAcknowledgment) => void; reject: (error: unknown) => void }[]>();
  private flushing = false;
  private noiseOperation = false;
  private acknowledgedNoiseReduction: number | null = null;

  private async request<T>(route: string, data?: object): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ['/relearn', '/restart', '/reset-learning'].includes(route) ? 7000 : 4500);
    try {
      const response = await fetch(address + route, {
        signal: controller.signal,
        ...(data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Hardware command failed');
      return result as T;
    } catch (failure) {
      if (failure instanceof TypeError || (failure instanceof Error && failure.name === 'AbortError')) {
        throw new Error('USB bridge unavailable. Run scripts/start-hardware-app.ps1 on this computer.');
      }
      throw failure;
    } finally { clearTimeout(timeout); }
  }

  async scan() { return this.request<HearingDevice[]>('/devices'); }
  async connect(id = 'stm32-usb') {
    this.connecting = true;
    try {
      const device = await this.request<HearingDevice>('/connect', { id });
      this.acknowledgedNoiseReduction = null;
      this.connected = true;
      return device;
    } catch (failure) {
      this.connected = false;
      await this.request('/disconnect', {}).catch(() => {});
      throw failure;
    } finally { this.connecting = false; }
  }
  async disconnect() {
    await this.request('/disconnect', {});
    this.connected = false;
  }
  async restart() {
    this.connected = false;
    await this.request('/restart', {});
    return this.connect();
  }

  private set(control: Control, value: number) {
    if (control === 'noiseReduction' && this.noiseOperation) return Promise.reject(new Error('Wait for the current learning action.'));
    const percent = control === 'volume' || control === 'noiseReduction' || control === 'speechAmplification' || control === 'reduceLoudSounds' || control === 'spatialFocus';
    if (!Number.isInteger(value) || value < (percent ? 0 : -12) || value > (percent ? 100 : 12)) {
      return Promise.reject(new RangeError('Control value outside its allowed range'));
    }
    this.desired.set(control, value);
    if (!this.connected) return Promise.resolve({ accepted: false, simulated: false, sequence: 0 });
    return new Promise<DeviceAcknowledgment>((resolve, reject) => {
      const previous = this.waiting.get(control) ?? [];
      previous.push({ value, resolve, reject });
      this.waiting.set(control, previous);
      if (!this.flushing) { this.flushing = true; setTimeout(() => void this.flush(), 60); }
    });
  }
  private async flush() {
    while (this.waiting.size) {
      const [control, requests] = this.waiting.entries().next().value!;
      this.waiting.delete(control);
      try {
        const ack = await this.request<DeviceAcknowledgment>('/control', { control, value: requests[requests.length - 1].value });
        if (control === 'noiseReduction' && ack.accepted) this.acknowledgedNoiseReduction = requests[requests.length - 1].value;
        for (const request of requests) request.resolve(ack);
      } catch (failure) {
        for (const request of requests) request.reject(failure);
      }
    }
    this.flushing = false;
  }
  setVolume(value: number) { return this.set('volume', value); }
  setNoiseReduction(value: number) { return this.set('noiseReduction', value); }
  async confirmNoiseReduction(value: number) {
    if (this.noiseOperation) throw new Error('Wait for the current learning action.');
    this.noiseOperation = true;
    try {
      while (this.flushing) await new Promise((resolve) => setTimeout(resolve, 10));
      if (!this.connected || this.desired.get('noiseReduction') !== value || this.acknowledgedNoiseReduction !== value) {
        throw new Error('Adjust the noise reduction dial before remembering a correction.');
      }
      const ack = await this.request<DeviceAcknowledgment>('/noise-feedback', { value });
      this.acknowledgedNoiseReduction = null;
      return ack;
    } finally { this.noiseOperation = false; }
  }
  setNoiseAdaptation(enabled: boolean) { return this.request<DeviceAcknowledgment>('/noise-adaptation', { enabled }); }
  clearNoisePreferences() { return this.request<DeviceAcknowledgment>('/noise-preferences', {}); }
  async resetLearning() {
    if (this.noiseOperation) throw new Error('Wait for the current learning action.');
    this.noiseOperation = true;
    try {
      while (this.flushing) await new Promise((resolve) => setTimeout(resolve, 10));
      this.acknowledgedNoiseReduction = null;
      return await this.request<HardwareStatus>('/reset-learning', {});
    } finally { this.noiseOperation = false; }
  }
  setReduceLoudSounds(value: number) { return this.set('reduceLoudSounds', value); }
  setSpeechAmplification(value: number) { return this.set('speechAmplification', value); }
  setBass(value: number) { return this.set('bass', value); }
  setMid(value: number) { return this.set('mid', value); }
  setTreble(value: number) { return this.set('treble', value); }
  setFineEq(frequency: 250 | 500 | 2000 | 4000, value: number) { return this.set(`eq${frequency}`, value); }
  setSpatialFocus(value: number) { return this.set('spatialFocus', value); }
  async startCalibration(_volume: number) { return this.request<CalibrationResult>('/relearn', {}); }
  async getStatus(): Promise<HardwareStatus> {
    const data = await this.request<HardwareStatus & { values?: Partial<DeviceStatus> }>('/status');
    if (!data.connected && !this.connecting) this.connected = false;
    return Object.assign({
      volume: 0, noiseReduction: 0, reduceLoudSounds: 0, spatialFocus: 0, speechAmplification: 0,
      bass: 0, mid: 0, treble: 0, eq250: 0, eq500: 0, eq2000: 0, eq4000: 0,
    }, data, data.values);
  }
}

export const hardwareDeviceService = new HardwareDeviceService();
