import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

export interface SegmentedMeterProps {
  percentage: number;
  color?: 'green' | 'orange' | 'blue' | 'purple';
  totalSegments?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const COLOR_MAP = {
  green: '#3FCB8A',
  orange: '#F07B2A',
  blue: '#3B5BDB',
  purple: '#8B7FE0',
};

const INACTIVE_COLOR = '#E2E8F0';

export const SegmentedMeter: React.FC<SegmentedMeterProps> = ({
  percentage,
  color = 'green',
  totalSegments = 22,
  height = 18,
  style,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledCount = Math.round((clamped / 100) * totalSegments);
  const activeColor = COLOR_MAP[color] || COLOR_MAP.green;

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: totalSegments }).map((_, index) => {
        const isFilled = index < filledCount;
        return (
          <View
            key={index}
            style={[
              styles.segment,
              {
                height,
                backgroundColor: isFilled ? activeColor : INACTIVE_COLOR,
                opacity: isFilled ? 1 : 0.65,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: '100%',
    paddingVertical: 2,
  },
  segment: {
    flex: 1,
    borderRadius: 3,
  },
});
