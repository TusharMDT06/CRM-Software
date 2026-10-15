import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

export interface DonutProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  delay?: number;
  centerComponent?: React.ReactNode;
  centerLabel?: string;
  centerSubLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const Donut: React.FC<DonutProps> = ({
  data,
  size = 180,
  strokeWidth = 24,
  delay = 450,
  centerComponent,
  centerLabel,
  centerSubLabel,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(reducedMotion ? 0 : -150);
  const scale = useSharedValue(reducedMotion ? 1 : 0.5);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    // Spec 4 #3: rotates in from -150deg and scale 0.5->1 with fade (1000ms, delay 450ms)
    rotation.value = withDelay(
      delay,
      withTiming(0, {
        duration: 1000,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );

    scale.value = withDelay(
      delay,
      withTiming(1, {
        duration: 1000,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );

    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 1000,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );
  }, [reducedMotion, delay, rotation, scale, opacity]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View style={[{ width: size, height: size }, animatedContainerStyle]}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            {/* Background empty track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={colors.divider}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {data.map((item, index) => {
              const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
              const strokeDashoffset = -currentOffset;
              currentOffset += (item.value / total) * circumference;

              return (
                <Circle
                  key={`donut-seg-${index}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              );
            })}
          </G>
        </Svg>
      </Animated.View>

      {(centerComponent || centerLabel) && (
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {centerComponent ? (
            centerComponent
          ) : (
            <>
              {centerLabel && (
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '800',
                    color: colors.ink,
                  }}
                >
                  {centerLabel}
                </Text>
              )}
              {centerSubLabel && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '500',
                    color: colors.muted,
                    marginTop: 2,
                  }}
                >
                  {centerSubLabel}
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};
