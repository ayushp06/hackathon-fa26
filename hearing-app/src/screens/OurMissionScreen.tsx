import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';

export function OurMissionScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const sound = useSoundFeedback();
  const goHome = () => {
    haptics.selection();
    sound.tap();
    router.replace('/');
  };

  return (
    <View style={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={goHome} style={styles.backButton}>
        <Text style={styles.backText}>‹ Home</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>Our Mission</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: theme.spacing.sm },
  backButton: { alignSelf: 'flex-start', minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center' },
  backText: { ...theme.typography.segment, color: theme.colors.secondaryText },
  title: { ...theme.typography.title, color: theme.colors.text, marginTop: theme.spacing.sm },
});
