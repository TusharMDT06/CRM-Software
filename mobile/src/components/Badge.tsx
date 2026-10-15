import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export type BadgeVariant =
  | 'hot'
  | 'warm'
  | 'cold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'role';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  showDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  showDot = false,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'hot':
        return {
          bg: theme.colors.ratings.hot.bg,
          text: theme.colors.ratings.hot.text,
          dot: theme.colors.ratings.hot.dot,
        };
      case 'warm':
        return {
          bg: theme.colors.ratings.warm.bg,
          text: theme.colors.ratings.warm.text,
          dot: theme.colors.ratings.warm.dot,
        };
      case 'cold':
        return {
          bg: theme.colors.ratings.cold.bg,
          text: theme.colors.ratings.cold.text,
          dot: theme.colors.ratings.cold.dot,
        };
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.14)',
          text: theme.colors.green,
          dot: theme.colors.green,
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.14)',
          text: theme.colors.orange,
          dot: theme.colors.orange,
        };
      case 'danger':
        return {
          bg: 'rgba(239, 68, 68, 0.14)',
          text: theme.colors.ratings.hot.text,
          dot: theme.colors.ratings.hot.dot,
        };
      case 'info':
        return {
          bg: 'rgba(37, 99, 235, 0.12)',
          text: theme.colors.blue,
          dot: theme.colors.blue,
        };
      case 'role':
        return {
          bg: 'rgba(124, 58, 237, 0.12)',
          text: theme.colors.purple,
          dot: theme.colors.purple,
        };
      case 'neutral':
      default:
        return {
          bg: theme.colors.surfaceMuted,
          text: theme.colors.text2,
          dot: theme.colors.muted,
        };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {showDot && <View style={[styles.dot, { backgroundColor: colors.dot }]} />}
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.badge,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: theme.typography.badge.fontSize,
    fontFamily: theme.typography.badge.fontFamily,
    fontWeight: theme.typography.badge.fontWeight,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
