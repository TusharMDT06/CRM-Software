import React, { useEffect, useState, useRef } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import {
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
} from 'react-native-reanimated';

export interface CountUpProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 900,
  formatter,
  style,
  prefix = '',
  suffix = '',
}) => {
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(() => (reducedMotion ? value : 0));
  const animatedProgress = useSharedValue(reducedMotion ? value : 0);
  const startValueRef = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startVal = startValueRef.current;
    startValueRef.current = value;
    animatedProgress.value = startVal;

    animatedProgress.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, reducedMotion]);

  useAnimatedReaction(
    () => animatedProgress.value,
    (current) => {
      runOnJS(setDisplayValue)(Math.round(current));
    },
    [animatedProgress]
  );

  const formatted = formatter ? formatter(displayValue) : displayValue.toLocaleString('en-IN');

  return (
    <Text style={style}>
      {prefix}
      {formatted}
      {suffix}
    </Text>
  );
};
