import { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export interface TypographyToken extends TextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
  fontWeight?: TextStyle['fontWeight'];
  letterSpacing?: number;
}

export const typography = {
  families: fontFamilies,

  // Screen title 22/800 (letter-spacing -0.3)
  screenTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },

  // Section title 15/800
  sectionTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800' as const,
  },

  // Row title 14–15/800
  rowTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800' as const,
  },

  rowTitleSmall: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800' as const,
  },

  // Meta 12–13/500 muted
  meta: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },

  metaSmall: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },

  // KPI 30/800 (-0.5)
  kpi: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },

  // Big money 26/800
  bigMoney: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },

  // Tab label 11/600 (active 800)
  tabLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
  },

  tabLabelActive: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800' as const,
  },

  // Badges 11–12/800
  badge: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800' as const,
  },

  badgeMedium: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
  },

  // General body
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },

  bodyMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
} as const;
