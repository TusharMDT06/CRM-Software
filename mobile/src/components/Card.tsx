import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  padded = true,
}) => {
  const containerStyle = [
    styles.card,
    padded && styles.padded,
    style,
  ];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={containerStyle}>
        {children}
      </PressableScale>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: theme.spacing.screen,
  },
});
