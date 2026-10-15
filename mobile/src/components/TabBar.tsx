import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Filter as Funnel,
  Briefcase,
  User,
  LayoutGrid,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { PressableScale } from '../animations/PressableScale';

interface TabItemConfig {
  name: string;
  label: string;
  Icon: any;
}

const TABS: TabItemConfig[] = [
  { name: 'index', label: 'Home', Icon: Home },
  { name: 'leads', label: 'Leads', Icon: Funnel },
  { name: 'deals', label: 'Deals', Icon: Briefcase },
  { name: 'contacts', label: 'Contacts', Icon: User },
  { name: 'more', label: 'More', Icon: LayoutGrid },
];

export const TabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // Tab bar rises 40px + fades (550ms, delay 50ms)
  const translateY = useSharedValue(reducedMotion ? 0 : 40);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    translateY.value = withDelay(
      50,
      withTiming(0, {
        duration: 550,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );

    opacity.value = withDelay(
      50,
      withTiming(1, {
        duration: 550,
        easing: Easing.bezier(0.2, 0.75, 0.25, 1),
      })
    );
  }, [reducedMotion]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
        animatedContainerStyle,
      ]}
    >
      <View style={styles.bar}>
        {TABS.map((tab, index) => {
          // Match route
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const isFocused = state.index === (routeIndex !== -1 ? routeIndex : index);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[routeIndex !== -1 ? routeIndex : index]?.key || tab.name,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          const IconComponent = tab.Icon;

          return (
            <PressableScale
              key={tab.name}
              onPress={onPress}
              haptic={true}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={tab.label}
            >
              {/* Active 52x30 ink pill */}
              <View
                style={[
                  styles.pill,
                  isFocused && styles.activePill,
                ]}
              >
                <IconComponent
                  size={19}
                  color={isFocused ? '#FFFFFF' : colors.muted}
                  strokeWidth={isFocused ? 2.2 : 1.8}
                />
              </View>

              <Text
                style={[
                  isFocused ? typography.tabLabelActive : typography.tabLabel,
                  {
                    color: isFocused ? colors.ink : colors.muted,
                    marginTop: 2,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
  },
  pill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activePill: {
    backgroundColor: colors.ink,
  },
});
