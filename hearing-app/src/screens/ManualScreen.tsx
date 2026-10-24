import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

export function ManualScreen() {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Manual</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text },
});
