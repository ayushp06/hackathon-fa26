import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';
import { useCalibrationStore, VOLUME_MAX, VOLUME_MIN } from '../state/useCalibrationStore';

export function AutomaticCalibrationScreen() {
  const { width } = useWindowDimensions();
  const volume = useCalibrationStore((state) => state.volume);
  const status = useCalibrationStore((state) => state.status);
  const setVolume = useCalibrationStore((state) => state.setVolume);
  const recalibrate = useCalibrationStore((state) => state.recalibrate);
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const diameter = Math.max(56, Math.min(theme.sizing.calibrationDialMaxDiameter, width - theme.spacing.lg * 4));
  const loading = status === 'loading';

  const handleRecalibrate = async () => {
    haptics.selection();
    sound.tap();
    if (await recalibrate()) {
      haptics.success();
      sound.confirm();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
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
        accessibilityState={{ disabled: loading, busy: loading }}
        disabled={loading}
        onPress={() => void handleRecalibrate()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{loading ? 'Recalibrating…' : 'Recalibrate'}</Text>
      </Pressable>
      <View style={styles.status} accessibilityLiveRegion="polite">
        {status === 'complete' ? <Text style={styles.statusText}>Mock calibration complete</Text> : null}
        {status === 'error' ? <Text style={styles.statusText}>Calibration failed. Try again.</Text> : null}
      </View>
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
  status: { minHeight: theme.spacing.lg, justifyContent: 'center', marginTop: theme.spacing.md },
  statusText: { ...theme.typography.segment, color: theme.colors.secondaryText },
});
