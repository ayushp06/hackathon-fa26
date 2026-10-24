import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { theme } from '../../constants/theme';
import { RotaryDial } from '../components/RotaryDial';

export function AutomaticCalibrationScreen() {
  const [value, setValue] = useState(50);
  const { width } = useWindowDimensions();

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Automatic Calibration</Text>
      <View style={styles.preview}>
        <RotaryDial min={0} max={100} step={1} diameter={Math.min(240, width - 96)} label="Volume" value={value} onValueChange={setValue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text },
  preview: { alignItems: 'center', marginTop: theme.spacing.xl },
});
