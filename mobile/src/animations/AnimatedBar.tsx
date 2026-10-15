import React, { useEffect } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

export interface AnimatedBarProps {
  percentage: number; // 0 - 100
  color?: string;
  trackColor?: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedBar: React.FC<AnimatedBarProps> = ({
  percentage,
  color = colors.green,
  trackColor = colors.divider,
  height = 8,
  delay = 0,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, percentage));
  const progress = useSharedValue(reducedMotion ? clamped : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = clamped;
      return;
    }

    progress.value = withDelay(
      delay,
      withTiming(clamped, {
        duration: 1000,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );
  }, [clamped, delay, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
    };
  });

  return (
    <View
      style={[
        {
          height,
          backgroundColor: trackColor,
          borderRadius: radii.full,
          overflow: 'hidden',
          width: '100%',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: color,
            borderRadius: radii.full,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};
