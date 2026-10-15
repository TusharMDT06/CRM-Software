import React, { useEffect } from 'react';
import { Pressable, StyleProp, ViewStyle, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

export interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onToggle,
  size = 22,
  disabled = false,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(checked ? 1 : 0.9);
  const checkProgress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      checkProgress.value = checked ? 1 : 0;
      return;
    }

    if (checked) {
      scale.value = withSpring(1, { damping: 12, stiffness: 250 });
      checkProgress.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      checkProgress.value = withTiming(0, { duration: 150 });
    }
  }, [checked, reducedMotion]);

  const animatedCircleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: checked ? 0 : 2,
            borderColor: colors.muted,
            backgroundColor: checked ? colors.green : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedCircleStyle,
        ]}
      >
        {checked && (
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6L9 17L4 12"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </Animated.View>
    </Pressable>
  );
};
