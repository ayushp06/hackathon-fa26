import { Redirect } from 'expo-router';
import { AutomaticCalibrationScreen } from '../screens/AutomaticCalibrationScreen';
import { useAppStore } from '../state/useAppStore';

export default function Home() {
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);
  return onboardingCompleted ? <AutomaticCalibrationScreen /> : <Redirect href="/onboarding" />;
}
