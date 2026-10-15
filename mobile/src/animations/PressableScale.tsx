import React from 'react';
import {
  Pressable,
  TouchableOpacity,
  PressableProps,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export interface PressableScaleProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  children: React.ReactNode;
  accessibilityRole?: any;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  style,
  scaleTo = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  accessibilityRole,
  ...rest
}) => {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled && !reducedMotion) {
      scale.value = withSpring(scaleTo, { damping: 15, stiffness: 300 });
    }
    if (!disabled && haptic && Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (!disabled && !reducedMotion) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
    onPressOut?.(e);
  };

  const lastPressRef = React.useRef(0);

  if (Platform.OS === 'web') {
    const handleWebPress = (e: any) => {
      if (disabled) return;
      const now = Date.now();
      if (now - lastPressRef.current < 150) return;
      lastPressRef.current = now;
      onPress?.(e);
    };

    return (
      <TouchableOpacity
        style={[{ cursor: disabled ? 'default' : 'pointer', userSelect: 'none' } as any, style]}
        onPress={handleWebPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole={accessibilityRole}
        {...(rest as any)}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};
