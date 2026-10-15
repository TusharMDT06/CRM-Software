import React, { useEffect } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

export interface SkeletonProps {
  width?: number | `${number}%` | 'auto';
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = radii.card,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    if (reducedMotion) return;

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 600 }),
        withTiming(0.45, { duration: 600 })
      ),
      -1,
      true
    );
  }, [reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const baseStyle: ViewStyle = {
    width: width as any,
    height,
    borderRadius,
    backgroundColor: colors.border,
  };

  if (reducedMotion) {
    return <View style={[baseStyle, { opacity: 0.6 }, style]} />;
  }

  return <Animated.View style={[baseStyle, animatedStyle, style]} />;
};
