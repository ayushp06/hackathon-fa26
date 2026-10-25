import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={goHome} style={styles.backButton}>
        <Text style={styles.backText}>‹ Home</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>Our Mission</Text>
      <Text style={styles.paragraph}>One of our teammates wears hearing aids. During our initial brainstorming session, he showed us the companion app he uses to configure them. It was filled with sliders, settings, and adjustments that he has to revisit whenever his surroundings change.</Text>
      <Text style={styles.paragraph}>That conversation changed the direction of our project.</Text>
      <Text style={styles.paragraph}>For most people, moving from a quiet room into a crowded restaurant or walking outside onto a busy street happens without a second thought. But for someone who depends on hearing assistance, those transitions can mean constantly reaching for their phone, finding the right settings, and manually readjusting how they hear the world.</Text>
      <Text style={styles.paragraph}>The technology is supposed to make everyday life easier. Instead, our teammate described having to repeatedly configure it just to feel comfortable in different environments.</Text>
      <Text style={styles.paragraph}>We started asking a different question: <Text style={styles.emphasis}>What if your hearing aid could learn how you prefer to hear, instead of making you teach it the same preferences over and over again?</Text></Text>
      <Text style={styles.paragraph}>That question became Wavelength.</Text>
      <Text style={styles.paragraph}>We wanted to explore hearing assistance as a continuously adapting system rather than a collection of static presets. A device that could observe changes in its acoustic environment, learn from occasional user corrections, and gradually reduce the need for manual adjustments.</Text>
      <Text style={styles.paragraph}>More importantly, we wanted that intelligence to live on the device itself. Not behind a cloud API, not dependent on an always-connected smartphone, but on a resource-constrained microcontroller processing real-world audio.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', minHeight: theme.sizing.minimumTouchTarget, justifyContent: 'center' },
  backText: { ...theme.typography.segment, color: theme.colors.secondaryText },
  title: { ...theme.typography.title, color: theme.colors.text, marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 25, color: theme.colors.text, marginBottom: theme.spacing.md },
  emphasis: { fontWeight: '600' },
});
