export type HearingDevice = {
  id: string;
  name: string;
};

export type DeviceMode = 'automatic' | 'manual';
export type CalibrationStatus = 'idle' | 'loading' | 'complete' | 'error';
export type CalibrationResult = { simulated: boolean; completedAt: string; volumePercent: number };
export type DeviceAcknowledgment = { accepted: boolean; simulated: boolean; sequence: number };
export type DeviceStatus = {
  simulated: boolean;
  connected: boolean;
  volume: number;
  noiseReduction: number;
  reduceLoudSounds: number;
  spatialFocus: number;
  speechAmplification: number;
  // Signed EQ gains in dB; the transport reports whether DSP is simulated.
  bass: number;
  mid: number;
  treble: number;
  eq250: number;
  eq500: number;
  eq2000: number;
  eq4000: number;
  calibrationStatus: CalibrationStatus;
};

export interface DeviceTransport {
  connect(id?: string): Promise<HearingDevice>;
  disconnect(): Promise<void>;
  setVolume(value: number): Promise<DeviceAcknowledgment>;
  setNoiseReduction(value: number): Promise<DeviceAcknowledgment>;
  setReduceLoudSounds(value: number): Promise<DeviceAcknowledgment>;
  setSpatialFocus(value: number): Promise<DeviceAcknowledgment>;
  setSpeechAmplification(value: number): Promise<DeviceAcknowledgment>;
  setBass(value: number): Promise<DeviceAcknowledgment>;
  setMid(value: number): Promise<DeviceAcknowledgment>;
  setTreble(value: number): Promise<DeviceAcknowledgment>;
  setFineEq(frequency: 250 | 500 | 2000 | 4000, value: number): Promise<DeviceAcknowledgment>;
  startCalibration(volume: number): Promise<CalibrationResult>;
  getStatus(): Promise<DeviceStatus>;
}

export interface DeviceService extends DeviceTransport {
  scan(): Promise<HearingDevice[]>;
}
