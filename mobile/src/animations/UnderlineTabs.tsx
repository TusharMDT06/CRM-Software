import React, { useState, useEffect } from 'react';
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

export interface TabOption {
  key: string;
  label: string;
  count?: number;
}

export interface UnderlineTabsProps {
  tabs: (TabOption | string)[];
  activeKey?: string;
  selected?: string;
  onTabChange?: (key: string) => void;
  onSelect?: (key: string) => void;
  onSelectTab?: (key: any) => void;
  onChange?: (key: any) => void;
  activeColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const UnderlineTabs: React.FC<UnderlineTabsProps> = ({
  tabs,
  activeKey,
  selected,
  onTabChange,
  onSelect,
  onSelectTab,
  onChange,
  activeColor,
  style,
}) => {
  const currentKey = selected || activeKey || '';
  const handleSelect = (key: string) => {
    if (onSelect) onSelect(key);
    if (onSelectTab) onSelectTab(key);
    if (onTabChange) onTabChange(key);
    if (onChange) onChange(key);
  };

  const normalizedTabs: TabOption[] = tabs.map((t) =>
    typeof t === 'string' ? { key: t, label: t } : t
  );

  const reducedMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const handleTabLayout = (key: string, event: LayoutChangeEvent) => {
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

  const animatedIndicatorStyle = useAnimatedStyle(() => {
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
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          position: 'relative',
        },
        style,
      ]}
    >
      {/* Sliding Underline Indicator */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: -1,
            height: 2.5,
            backgroundColor: activeColor || colors.ink,
            borderRadius: 1.5,
          },
          animatedIndicatorStyle,
        ]}
      />

      {normalizedTabs.map((tab) => {
        const isSelected = tab.key === currentKey;
        return (
          <Pressable
            key={tab.key}
            onLayout={(e) => handleTabLayout(tab.key, e)}
            onPress={() => handleSelect(tab.key)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: isSelected ? '800' : '600',
                color: isSelected ? (activeColor || colors.ink) : colors.muted,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
