import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

export interface ChipOption {
  key: string;
  label: string;
  count?: number;
  badgeColor?: string;
}

export interface SegmentedChipsProps {
  chips: (ChipOption | string)[];
  activeKey?: string;
  selected?: string;
  onChipChange?: (key: string) => void;
  onSelect?: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

export const SegmentedChips: React.FC<SegmentedChipsProps> = ({
  chips,
  activeKey,
  selected,
  onChipChange,
  onSelect,
  style,
}) => {
  const currentKey = selected || activeKey || '';
  const handleSelect = (key: string) => {
    if (onSelect) onSelect(key);
    if (onChipChange) onChipChange(key);
  };

  const normalizedChips: ChipOption[] = chips.map((c) =>
    typeof c === 'string' ? { key: c, label: c } : c
  );

  const reducedMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const handleChipLayout = (key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [key]: { x, width } }));
  };

  useEffect(() => {
    const current = layouts[currentKey];
    if (current) {
      if (reducedMotion) {
        indicatorX.value = current.x;
        indicatorWidth.value = current.width;
      } else {
        indicatorX.value = withTiming(current.x, {
          duration: 250,
          easing: Easing.bezier(0.2, 0.75, 0.25, 1),
        });
        indicatorWidth.value = withTiming(current.width, {
          duration: 250,
          easing: Easing.bezier(0.2, 0.75, 0.25, 1),
        });
      }
    }
  }, [currentKey, layouts, reducedMotion, indicatorX, indicatorWidth]);

  const animatedPillStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorX.value }],
      width: indicatorWidth.value,
    };
  });

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.divider,
          borderRadius: radii.chip,
          padding: 3,
          position: 'relative',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {/* Sliding Pill Indicator */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 3,
            bottom: 3,
            backgroundColor: colors.ink,
            borderRadius: radii.chip - 2,
          },
          animatedPillStyle,
        ]}
      />

      {normalizedChips.map((chip) => {
        const isSelected = chip.key === currentKey;
        return (
          <Pressable
            key={chip.key}
            onLayout={(e) => handleChipLayout(chip.key, e)}
            onPress={() => handleSelect(chip.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radii.chip - 2,
              zIndex: 2,
              cursor: 'pointer',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: isSelected ? '800' : '600',
                color: isSelected ? '#FFFFFF' : colors.text2,
              }}
            >
              {chip.label}
            </Text>

            {chip.count !== undefined && (
              <View
                style={{
                  backgroundColor: isSelected
                    ? 'rgba(255, 255, 255, 0.25)'
                    : chip.badgeColor || colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  marginLeft: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: isSelected ? '#FFFFFF' : colors.ink,
                  }}
                >
                  {chip.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};
