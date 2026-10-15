import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

export interface FloatingLogoProps {
  children?: React.ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
  amplitude?: number; // default 6px
  duration?: number; // default 4500ms
}

export const FloatingLogo: React.FC<FloatingLogoProps> = ({
  children,
  size = 64,
  style,
  amplitude = 6,
  duration = 4500,
}) => {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    translateY.value = withRepeat(
      withSequence(
        withTiming(-amplitude, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(amplitude, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      true
    );
  }, [reducedMotion, amplitude, duration, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const fontSize = Math.round(size * 0.44);
  const lineHeight = Math.round(size * 0.5);

  const content = children || (
    <View
      style={[
        styles.defaultLogoBox,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
        },
      ]}
    >
      <View style={styles.letterRow}>
        <Text
          style={[
            styles.letterF,
            {
              fontSize,
              lineHeight,
            },
          ]}
        >
          F
        </Text>
        <Text
          style={[
            styles.letterD,
            {
              fontSize,
              lineHeight,
            },
          ]}
        >
          D
        </Text>
      </View>
    </View>
  );

  if (reducedMotion) {
    return <View style={style}>{content}</View>;
  }

  return <Animated.View style={[style, animatedStyle]}>{content}</Animated.View>;
};

const styles = StyleSheet.create({
  defaultLogoBox: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  letterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterF: {
    color: '#F07B2A',
    fontWeight: '900',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-black',
      default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }),
    marginRight: 1,
    includeFontPadding: false,
  },
  letterD: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-black',
      default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }),
    includeFontPadding: false,
  },
});
