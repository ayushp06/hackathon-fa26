import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

export function AutomaticCalibrationScreen() {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Automatic Calibration</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text },
});
