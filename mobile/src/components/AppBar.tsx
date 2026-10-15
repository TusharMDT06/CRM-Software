import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleProp,
  ViewStyle,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { PressableScale } from '../animations/PressableScale';

export interface AppBarProps {
  title: string;
  subtitle?: string;
  backgroundColor?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const AppBar: React.FC<AppBarProps> = ({
  title,
  subtitle,
  backgroundColor = colors.appBar.default,
  showBack = false,
  onBackPress,
  rightAction,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  // Entrance: slides down 24px + fades in (550ms)
  const translateY = useSharedValue(reducedMotion ? 0 : -24);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    translateY.value = withTiming(0, {
      duration: 550,
      easing: Easing.bezier(0.2, 0.75, 0.25, 1),
    });

    opacity.value = withTiming(1, {
      duration: 550,
      easing: Easing.bezier(0.2, 0.75, 0.25, 1),
    });
  }, [reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/more');
    }
  };

  const pt = insets.top + (Platform.OS === 'android' ? 6 : 0);

  return (
    <Animated.View
      style={[
        {
          backgroundColor,
          paddingTop: pt,
          paddingBottom: 14,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
        },
        animatedStyle,
        style,
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          {showBack && (
            <PressableScale
              onPress={handleBack}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft size={18} color="#FFFFFF" strokeWidth={2.2} />
            </PressableScale>
          )}

          <View style={{ flex: 1 }}>
            <Text
              style={[
                typography.screenTitle,
                { color: '#FFFFFF' },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 12,
                  fontWeight: '500',
                  marginTop: 1,
                }}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {rightAction}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
};
