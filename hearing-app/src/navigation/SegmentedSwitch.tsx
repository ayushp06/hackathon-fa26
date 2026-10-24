import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

const segments = [
  { label: 'Automatic Calibration', href: '/' },
  { label: 'Manual', href: '/manual' },
] as const;

export function SegmentedSwitch() {
  const pathname = usePathname();

  return (
    <View style={styles.track} accessibilityRole="tablist">
      {segments.map(({ label, href }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} replace asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.activeSegment]}
            >
              <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
            </Pressable>
          </Link>
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
