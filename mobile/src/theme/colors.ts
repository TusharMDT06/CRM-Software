export const colors = {
  // Core neutrals
  ink: '#14141A',
  ink2: '#2A2A32',
  bg: '#F6F6F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F6F3',
  border: '#E6E5DF',
  divider: '#EEEDE8',

  // Text hierarchy
  text: '#14141A',
  text2: '#3D3C38',
  muted: '#6B6A66',
  disabled: '#9A9993',
  inverseText: '#FFFFFF',

  // Brand accents & tints
  blue: '#2F6FED',
  blueText: '#1F55C7',
  blueTint: '#E7EEFB',
  blueTint2: '#DCE8FF',

  orange: '#F2711C',
  orangeText: '#A54708',
  orangeTint: '#FFEEDF',
  orangeTint2: '#FFE3D0',
  orangeAvatarText: '#9A3412',

  purple: '#7C5CFC',
  purpleText: '#5B3FD6',
  purpleTint: '#EFEBFF',
  purpleTint2: '#EBE5FF',
  purpleAvatarText: '#4C2FC0',

  green: '#22A06B',
  greenText: '#12724B',
  greenTint: '#E2F5EA',
  greenTint2: '#D5F0E1',

  // Lead Ratings
  ratings: {
    hot: { bg: '#FDE8E6', text: '#B42318', dot: '#B42318' },
    warm: { bg: '#FFEEDA', text: '#A54708', dot: '#A54708' },
    cold: { bg: '#E3ECFC', text: '#1D4ED8', dot: '#1D4ED8' },
  },

  // App bar colours per screen (white text on all)
  appBar: {
    home: '#14141A',
    leads: '#14141A',
    deals: '#14141A',
    contacts: '#14141A',
    reports: '#14141A',
    more: '#14141A',
    team: '#14141A',
    tasks: '#12724B',
    accounts: '#1F55C7',
    leadSources: '#C2410C',
    messages: '#5B3FD6',
    default: '#14141A',
  },

  // Chart category fixed sequence (blue, orange, purple, green)
  chartSequence: ['#2F6FED', '#F2711C', '#7C5CFC', '#22A06B'] as const,
} as const;

export type Colors = typeof colors;
