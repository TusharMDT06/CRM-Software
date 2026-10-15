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

export interface StaggerProps {
  index?: number;
  delayOffset?: number; // default 100ms
  staggerMs?: number; // default 70ms
  risePx?: number; // default 16px
  duration?: number; // default 600ms
  capIndex?: number; // default 8
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Stagger: React.FC<StaggerProps> = ({
  index = 0,
  delayOffset = 100,
  staggerMs = 70,
  risePx = 16,
  duration = 600,
  capIndex = 8,
  children,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const clampedIndex = Math.min(index, capIndex);
  const delay = delayOffset + clampedIndex * staggerMs;

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : risePx);

  useEffect(() => {
    if (reducedMotion) return;

    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );

    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );
  }, [delay, duration, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  if (reducedMotion) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};
