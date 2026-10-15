import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../theme';

interface AvatarProps {
  name?: string;
  id?: string;
  sourceUri?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showOnlineDot?: boolean;
  isOnline?: boolean;
}

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export const Avatar: React.FC<AvatarProps> = ({
  name = '?',
  id,
  sourceUri,
  size = 'md',
  showOnlineDot = false,
  isOnline = false,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 40;
  const fontSize = Math.round(pixelSize * 0.4);
  const dotSize = Math.max(8, Math.round(pixelSize * 0.25));

  const initials = theme.helpers.getInitials(name);
  const color = theme.helpers.getAvatarColor(id || name);

  return (
    <View style={[styles.container, { width: pixelSize, height: pixelSize }]}>
      {sourceUri ? (
        <Image
          source={{ uri: sourceUri }}
          style={[
            styles.image,
            { width: pixelSize, height: pixelSize, borderRadius: pixelSize / 2 },
          ]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: pixelSize,
              height: pixelSize,
              borderRadius: pixelSize / 2,
              backgroundColor: color.bg,
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                color: color.text,
                fontSize,
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}

      {showOnlineDot && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: isOnline ? theme.colors.green : theme.colors.muted,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
});
