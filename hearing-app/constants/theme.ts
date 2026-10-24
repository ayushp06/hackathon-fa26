export const theme = {
  colors: {
    background: '#F5F0E6',
    text: '#171717',
    secondaryText: '#66635E',
    border: '#D8D1C5',
  },
  typography: {
    title: { fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: -0.8 },
    segment: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  sizing: {
    contentMaxWidth: 600,
    segmentHeight: 56,
    segmentRadius: 8,
    borderWidth: 1,
    dialRim: 8,
    dialTrackInset: 17,
    dialIndicatorWidth: 4,
    dialValueFontRatio: 0.2,
    calibrationDialMaxDiameter: 260,
    manualDialMaxDiameter: 180,
  },
} as const;

export function manualDialDiameter(windowWidth: number) {
  const contentWidth = Math.min(windowWidth, theme.sizing.contentMaxWidth) - theme.spacing.lg * 2;
  return Math.min(theme.sizing.manualDialMaxDiameter, (contentWidth - theme.spacing.md) / 2);
}
