export function manualWaveformPath(bass: number, mid: number, treble: number, noiseReduction = 50, spatialFocus = 50, speechAmplification = 50) {
  'worklet';
  const points: string[] = [];
  const bassAmplitude = 2.6 * Math.pow(10, bass / 20);
  const midAmplitude = 2.6 * Math.pow(10, mid / 20) * (0.8 + speechAmplification / 100 * 0.7);
  const trebleAmplitude = 2.6 * Math.pow(10, treble / 20);
  const noiseAmplitude = 4 * (1 - noiseReduction / 100);
  const offAxisAmplitude = 3 * (1 - spatialFocus / 100);
  for (let index = 0; index <= 120; index += 1) {
    const position = index / 120;
    const envelope = Math.sin(Math.PI * position) ** 2;
    const wave = bassAmplitude * Math.sin(position * Math.PI * 4)
      + midAmplitude * Math.sin(position * Math.PI * 14)
      + trebleAmplitude * Math.sin(position * Math.PI * 34)
      + noiseAmplitude * Math.sin(position * Math.PI * 58)
      + offAxisAmplitude * Math.sin(position * Math.PI * 22);
    points.push(`${index === 0 ? 'M' : 'L'} ${index * 2.5} ${(50 - envelope * wave).toFixed(1)}`);
  }
  return points.join(' ');
}
