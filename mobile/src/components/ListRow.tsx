import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';
import { useIsRowHighlighted } from '../realtime/highlightStore';

interface ListRowProps {
  id?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ListRow: React.FC<ListRowProps> = ({
  id,
  title,
  subtitle,
  meta,
  leftAccessory,
  rightAccessory,
  showChevron = true,
  onPress,
  style,
}) => {
  const isHighlighted = useIsRowHighlighted(id || '');
  const highlightProgress = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightProgress.value = 1;
      highlightProgress.value = withTiming(0, {
        duration: 1200,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [isHighlighted, highlightProgress]);

  const animatedHighlightStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.surface, 'rgba(59, 130, 246, 0.15)']
    );

    const borderColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.border, theme.colors.blue]
    );

    return {
      backgroundColor,
      borderColor,
    };
  });

  const rowContent = (
    <Animated.View style={[styles.container, animatedHighlightStyle, style]}>
      {leftAccessory && <View style={styles.leftContainer}>{leftAccessory}</View>}

      <View style={styles.centerContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {meta && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightAccessory}
        {showChevron && onPress && (
          <ChevronRight size={18} color={theme.colors.muted} style={styles.chevron} />
        )}
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress}>
        {rowContent}
      </PressableScale>
    );
  }

  return rowContent;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: theme.radii.listRow,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: theme.spacing.minTouchTarget + 10,
    marginBottom: theme.spacing.listRowGap,
  },
  leftContainer: {
    marginRight: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.rowTitle,
    color: theme.colors.ink,
    marginBottom: 2,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.text2,
    marginBottom: 2,
  },
  meta: {
    ...theme.typography.meta,
    color: theme.colors.muted,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  chevron: {
    marginLeft: 6,
  },
});
