type Callbacks = {
  start: () => void;
  change: (value: number) => void;
  finish: (value: number) => void;
  cancel: () => void;
};

export class DialInteraction {
  callbacks: Callbacks;
  value: number | null = null;
  private gesture = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(callbacks: Callbacks) { this.callbacks = callbacks; }
  updateCallbacks(callbacks: Callbacks) { this.callbacks = callbacks; }

  private clearTimer() { clearTimeout(this.timer); }

  begin(value: number) {
    this.clearTimer();
    if (this.value === null) this.callbacks.start();
    this.value = value;
    this.gesture = true;
  }

  change(value: number) {
    if (this.value === null) return;
    this.value = value;
    this.callbacks.change(value);
  }

  discrete(value: number, keyboard = false) {
    this.clearTimer();
    if (this.value === null) {
      this.callbacks.start();
      this.value = value;
    }
    this.change(value);
    if (!keyboard && !this.gesture) this.keyUp();
  }

  keyUp() {
    this.clearTimer();
    if (this.value !== null && !this.gesture) this.timer = setTimeout(() => this.finish(), 400);
  }

  finish(value = this.value) {
    this.clearTimer();
    const active = this.value !== null;
    this.value = null;
    this.gesture = false;
    if (active && value !== null) this.callbacks.finish(value);
  }

  cancel() {
    this.clearTimer();
    const active = this.value !== null;
    this.value = null;
    this.gesture = false;
    if (active) this.callbacks.cancel();
  }
}
