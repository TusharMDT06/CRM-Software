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

export interface ScreenEntranceProps {
  children: React.ReactNode;
  isReady?: boolean; // plays once after real data arrives
  style?: StyleProp<ViewStyle>;
}

export const ScreenEntrance: React.FC<ScreenEntranceProps> = ({
  children,
  isReady = true,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 16);

  useEffect(() => {
    if (!isReady || reducedMotion) {
      if (isReady && reducedMotion) {
        opacity.value = 1;
        translateY.value = 0;
      }
      return;
    }

    opacity.value = withDelay(
      100,
      withTiming(1, {
        duration: 600,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );

    translateY.value = withDelay(
      100,
      withTiming(0, {
        duration: 600,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );
  }, [isReady, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  if (reducedMotion || !isReady) {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};
