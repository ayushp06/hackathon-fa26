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
    calibrationDialMaxDiameter: 260,
    manualDialMaxDiameter: 180,
    minimumTouchTarget: 44,
    settingsRowHeight: 64,
  },
} as const;

export function manualDialDiameter(windowWidth: number, availableHeight = Infinity) {
  const contentWidth = Math.min(windowWidth, theme.sizing.contentMaxWidth) - theme.spacing.lg * 2;
  const otherHeight = theme.spacing.xl * 4 + theme.typography.title.lineHeight
    + theme.spacing.md * 2 + theme.typography.segment.lineHeight * 3;
  return Math.max(100, Math.min(theme.sizing.manualDialMaxDiameter, (contentWidth - theme.spacing.md) / 2, (availableHeight - otherHeight) / 2));
}

export function advancedDialDiameter(windowWidth: number) {
  const contentWidth = Math.min(windowWidth, theme.sizing.contentMaxWidth) - theme.spacing.lg * 2;
  return Math.max(56, Math.min(110, (contentWidth - theme.spacing.sm * 2) / 3));
}

export function calibrationDialDiameter(windowWidth: number, availableHeight = Infinity) {
  const otherHeight = theme.spacing.xl * 3 + theme.spacing.md * 2
    + theme.typography.segment.lineHeight + theme.sizing.segmentHeight + theme.spacing.lg
    + theme.typography.title.lineHeight + theme.spacing.lg;
  return Math.max(100, Math.min(theme.sizing.calibrationDialMaxDiameter, windowWidth - theme.spacing.lg * 4, availableHeight - otherHeight));
}
