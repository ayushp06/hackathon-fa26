export type HearingDevice = {
  id: string;
  name: string;
};

export interface DeviceService {
  scan(): Promise<HearingDevice[]>;
  connect(id: string): Promise<HearingDevice>;
  disconnect(): Promise<void>;
}
