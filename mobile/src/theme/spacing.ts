export const spacing = {
  // Screen padding
  screen: 16,
  appBarHorizontal: 20,
  appBarVertical: 14,

  // Gaps
  cardGap: 12,
  listRowGap: 8,
  itemGap: 8,
  sectionGap: 20,

  // Touch accessibility
  minTouchTarget: 44,

  // Base scale
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type Spacing = typeof spacing;
