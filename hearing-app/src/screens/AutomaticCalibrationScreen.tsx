import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { calibrationDialDiameter, theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useAppStore, VOLUME_MAX, VOLUME_MIN } from '../state/useAppStore';

export function AutomaticCalibrationScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const volume = useAppStore((state) => state.volume);
  const setVolume = useAppStore((state) => state.setVolume);
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const [viewportHeight, setViewportHeight] = useState(Infinity);
  const diameter = calibrationDialDiameter(width, viewportHeight);
  const openManual = () => {
    haptics.selection();
    sound.tap();
    router.push('/manual');
  };
  const openMission = () => {
    haptics.selection();
    sound.tap();
    router.push('/mission');
  };

  return (
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Wavelength, Our Mission" accessibilityHint="Opens the Our Mission page" onPress={openMission} style={({ pressed }) => [styles.titleLink, pressed && styles.pressed]}>
        <Text style={styles.title}>Wavelength</Text>
      </Pressable>
      <RotaryDial
        min={VOLUME_MIN}
        max={VOLUME_MAX}
        step={1}
        diameter={diameter}
        label="Volume"
        value={volume}
        valueSuffix="%"
        onValueChange={setVolume}
      />
      <Pressable
        accessibilityRole="button"
        onPress={openManual}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Manual Recalibration</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  titleLink: { minHeight: theme.sizing.minimumTouchTarget, marginBottom: theme.spacing.xl, justifyContent: 'center' },
  title: { ...theme.typography.title, fontSize: 40, lineHeight: 48, letterSpacing: -1, color: theme.colors.text, textAlign: 'center' },
  button: {
    width: '100%',
    maxWidth: theme.sizing.calibrationDialMaxDiameter,
    minHeight: theme.sizing.segmentHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
    borderWidth: theme.sizing.borderWidth,
    borderColor: theme.colors.text,
  },
  pressed: { opacity: 0.7 },
  buttonText: { ...theme.typography.segment, color: theme.colors.text },
});
