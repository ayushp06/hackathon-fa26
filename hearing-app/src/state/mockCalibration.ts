export type MockCalibrationResult = {
  simulated: true;
  completedAt: string;
  volumePercent: number;
};

export async function mockCalibrate(volumePercent: number): Promise<MockCalibrationResult> {
  if (!Number.isInteger(volumePercent) || volumePercent < 0 || volumePercent > 100) {
    throw new RangeError('Volume must be an integer from 0 to 100');
  }

  await new Promise((resolve) => setTimeout(resolve, 800));
  return { simulated: true, completedAt: new Date().toISOString(), volumePercent };
}
