export function isReady(lastTime: number, now: number, interval: number) {
  return now - lastTime >= interval;
}
