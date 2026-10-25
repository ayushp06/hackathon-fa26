import type { DeviceAcknowledgment } from './types';

export type NoiseLearningState = {
  phase: 'idle' | 'adjusting' | 'saving' | 'learned' | 'automatic' | 'paused' | 'resetting' | 'error';
  pendingValue: number | null;
  target: number | null;
  error: string | null;
  learnedAt: number | null;
};

export function noiseLearningMessage(state: NoiseLearningState, connected: boolean, now = Date.now()) {
  if (!connected) return 'Connect USB to learn your preferences.';
  if (state.phase === 'adjusting') return 'Adjusting';
  if (state.phase === 'saving') return 'Learning preference…';
  if (state.phase === 'learned') return state.learnedAt !== null && now - state.learnedAt < 4000
    ? 'Preference learned' : 'Automatic adaptation enabled.';
  if (state.phase === 'automatic') return 'Automatic adaptation enabled.';
  if (state.phase === 'resetting') return 'Resetting learning…';
  if (state.phase === 'error') return state.error || 'Could not learn this preference.';
  if (state.phase === 'paused') return 'Adjustment cancelled. Adjust again to teach your preference.';
  return 'Ready to learn · automatic mode unconfirmed.';
}

type Transport = {
  setNoiseReduction(value: number): Promise<DeviceAcknowledgment>;
  confirmNoiseReduction(value: number): Promise<DeviceAcknowledgment>;
  resetLearning(): Promise<unknown>;
  getStatus(): Promise<{ connected: boolean; noiseReduction: number }>;
};
type Adjustment = {
  value: number;
  dirty: boolean;
  finished: boolean;
  cancelled: boolean;
  epoch: number;
  wake?: () => void;
};

export class NoiseLearning {
  state: NoiseLearningState = { phase: 'idle', pendingValue: null, target: null, error: null, learnedAt: null };
  private connected = false;
  private epoch = 0;
  private active: Adjustment | null = null;
  private latest: Adjustment | null = null;
  private tail: Promise<void> = Promise.resolve();

  private device: Transport;
  private notify: (state: NoiseLearningState) => void;

  constructor(device: Transport, notify: (state: NoiseLearningState) => void) {
    this.device = device;
    this.notify = notify;
  }

  private update(patch: Partial<NoiseLearningState>) {
    this.state = { ...this.state, ...patch };
    this.notify(this.state);
  }

  observe(connected: boolean, target: number | null) {
    if (this.connected && !connected) {
      this.invalidate();
      this.update({ phase: 'error', pendingValue: null, error: 'Device disconnected. Reconnect before adjusting again.' });
    }
    if (!this.connected && connected) this.update({ phase: 'idle', pendingValue: null, error: null });
    this.connected = connected;
    this.update({ target: connected ? target : null,
      ...(this.state.phase === 'learned' ? { pendingValue: null } : {}) });
  }

  begin(value: number) {
    if (!this.connected || this.state.phase === 'resetting' || this.active) return;
    this.active = { value, dirty: false, finished: false, cancelled: false, epoch: this.epoch };
  }

  change(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100 || !this.connected || this.state.phase === 'resetting') return;
    this.begin(value);
    const adjustment = this.active!;
    adjustment.value = value;
    this.latest = adjustment;
    this.update({ phase: 'adjusting', pendingValue: value, error: null });
    if (!adjustment.dirty) {
      adjustment.dirty = true;
      this.tail = this.tail.then(() => this.apply(adjustment));
    }
    adjustment.wake?.();
  }

  finish(value: number) {
    const adjustment = this.active;
    if (!adjustment) return;
    if (adjustment.dirty && adjustment.value !== value) this.change(value);
    this.active = null;
    adjustment.finished = true;
    if (adjustment.dirty) this.update({ phase: 'saving', error: null });
    adjustment.wake?.();
  }

  cancel() {
    const adjustment = this.active;
    if (!adjustment) return;
    this.active = null;
    adjustment.cancelled = true;
    adjustment.wake?.();
    if (adjustment.dirty) this.update({ phase: 'paused', pendingValue: null, error: null });
  }

  private valid(adjustment: Adjustment) {
    return adjustment.epoch === this.epoch && !adjustment.cancelled;
  }

  private async apply(adjustment: Adjustment) {
    try {
      let acknowledged: number | null = null;
      while (this.valid(adjustment)) {
        const value = adjustment.value;
        if (acknowledged !== value) {
          const ack = await this.device.setNoiseReduction(value);
          if (!ack.accepted) throw new Error('The device did not acknowledge the noise adjustment.');
          acknowledged = value;
        }
        if (!this.valid(adjustment)) return;
        if (acknowledged !== adjustment.value) continue;
        if (adjustment.finished) {
          const ack = await this.device.confirmNoiseReduction(value);
          if (!ack.accepted) throw new Error('The device did not acknowledge the preference.');
          if (!this.valid(adjustment)) return;
          if (this.latest === adjustment) {
            // ID14's successful acknowledgment establishes learning. A separate
            // status read must not delay or erase that accepted event.
            this.update({ phase: 'learned', pendingValue: value, learnedAt: Date.now(), error: null });
          }
          try {
            const status = await this.device.getStatus();
            if (!status.connected) throw new Error('Device disconnected after learning the preference.');
            if (this.valid(adjustment) && this.latest === adjustment) {
              this.update({ target: status.noiseReduction, pendingValue: null });
            }
          } catch (failure) {
            if (this.valid(adjustment) && this.latest === adjustment) {
              this.update({ error: `Preference accepted; device target refresh failed: ${failure instanceof Error ? failure.message : 'Status unavailable.'}` });
            }
          }
          return;
        }
        await new Promise<void>((resolve) => { adjustment.wake = resolve; });
        adjustment.wake = undefined;
      }
    } catch (failure) {
      if (this.valid(adjustment) && this.latest === adjustment) {
        if (this.active === adjustment) this.active = null;
        adjustment.cancelled = true;
        this.update({ phase: 'error', pendingValue: null, error: failure instanceof Error ? failure.message : 'Could not learn this preference.' });
      }
    }
  }

  private invalidate() {
    ++this.epoch;
    this.active?.wake?.();
    this.active = null;
    this.latest = null;
  }

  async reset() {
    if (!this.connected || this.state.phase === 'resetting') throw new Error('Connect the device and wait for the current reset.');
    this.invalidate();
    const epoch = this.epoch;
    this.update({ phase: 'resetting', pendingValue: null, error: null });
    const reset = this.tail.then(async () => {
      await this.device.resetLearning();
      const status = await this.device.getStatus();
      if (epoch !== this.epoch || !status.connected) throw new Error('Device disconnected during Reset Learning.');
      this.update({ phase: 'automatic', target: status.noiseReduction, pendingValue: null, error: null });
    });
    this.tail = reset.catch(() => {});
    try { await reset; }
    catch (failure) {
      if (epoch === this.epoch) this.update({ phase: 'error', pendingValue: null, error: failure instanceof Error ? failure.message : 'Reset Learning failed.' });
      throw failure;
    }
  }

  settled() { return this.tail; }
}
