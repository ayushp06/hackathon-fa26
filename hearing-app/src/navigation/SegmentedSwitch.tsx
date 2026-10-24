import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { useHaptics } from '../feedback/useHaptics';
import { useSoundFeedback } from '../feedback/useSoundFeedback';

const segments = [
  { label: 'Automatic Calibration', href: '/' },
  { label: 'Manual', href: '/manual' },
] as const;

export function SegmentedSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const haptics = useHaptics();
  const sound = useSoundFeedback();

  return (
    <View style={styles.track} accessibilityRole="tablist">
      {segments.map(({ label, href }) => {
        const active = pathname === href;
        return (
          <Pressable
            key={href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              haptics.selection();
              sound.tap();
              router.replace(href);
            }}
            style={[styles.segment, active && styles.activeSegment]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: theme.spacing.xs,
    borderWidth: theme.sizing.borderWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.sizing.segmentRadius,
  },
  segment: {
    flex: 1,
    minHeight: theme.sizing.segmentHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.sizing.segmentRadius - theme.spacing.xs,
  },
  activeSegment: { backgroundColor: theme.colors.text },
  label: { ...theme.typography.segment, color: theme.colors.text, textAlign: 'center' },
  activeLabel: { color: theme.colors.background },
});
