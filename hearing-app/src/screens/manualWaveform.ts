export function manualWaveformPath(bass: number, mid: number, treble: number) {
  const points: string[] = [];
  for (let index = 0; index <= 60; index += 1) {
    const position = index / 60;
    const envelope = Math.sin(Math.PI * position) ** 2;
    const wave = (bass / 100) * 8 * Math.sin(position * Math.PI * 4)
      + (mid / 100) * 12 * Math.sin(position * Math.PI * 12)
      + (treble / 100) * 8 * Math.sin(position * Math.PI * 28);
    points.push(`${index === 0 ? 'M' : 'L'} ${index * 5} ${(50 - envelope * wave).toFixed(1)}`);
  }
  return points.join(' ');
}
