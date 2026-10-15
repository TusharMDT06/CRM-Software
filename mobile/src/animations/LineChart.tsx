import React, { useEffect } from 'react';
import { View, StyleProp, ViewStyle, Text } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { formatCompactINR } from '../theme/helpers';

export interface LineChartPoint {
  x: string | number;
  y: number;
}

export interface LineChartProps {
  data: LineChartPoint[];
  width?: number;
  height?: number;
  color?: string;
  lineColor?: string;
  gradientFrom?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 320,
  height = 180,
  color,
  lineColor,
  gradientFrom,
  fillColor,
  style,
}) => {
  const activeColor = lineColor || color || colors.blue;
  const activeGradient = fillColor || gradientFrom || colors.blueTint;
  const reducedMotion = useReducedMotion();
  const paddingX = 24;
  const paddingY = 28;

  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const dotScale = useSharedValue(reducedMotion ? 1 : 0);
  const dotOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    progress.value = withTiming(1, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });

    dotScale.value = withDelay(
      1800,
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    dotOpacity.value = withDelay(
      1800,
      withTiming(1, { duration: 300 })
    );
  }, [reducedMotion]);

  if (!data || data.length < 2) {
    return <View style={[{ width, height }, style]} />;
  }

  const maxY = Math.max(...data.map((d) => d.y), 1);
  const minY = Math.min(...data.map((d) => d.y), 0);
  const rangeY = maxY - minY || 1;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((d.y - minY) / rangeY) * (height - paddingY * 2);
    return { x, y, raw: d };
  });

  // Build SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Build area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  // Estimated path length
  const totalLength = width * 1.5;

  const animatedPathProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: totalLength * (1 - progress.value),
    };
  });

  // Highlight highest point or last point
  const peakPoint = points.reduce((max, p) => (p.raw.y > max.raw.y ? p : max), points[0]);
  const activeHighlightPoint = peakPoint.raw.y > 0 ? peakPoint : points[points.length - 1];

  const dotAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dotOpacity.value,
      transform: [{ scale: dotScale.value }],
    };
  });

  return (
    <View style={[{ width, height, position: 'relative' }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={activeGradient} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={activeGradient} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Horizontal reference grid lines */}
        {[0.33, 0.66].map((ratio, i) => {
          const y = height - paddingY - ratio * (height - paddingY * 2);
          return (
            <Line
              key={`hgrid-${i}`}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#E2E8F0"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Baseline (horizontal axis line) */}
        <Line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          stroke="#94A3B8"
          strokeWidth={1.5}
        />

        {/* Perpendicular vertical grid lines for each data point */}
        {points.map((pt, i) => (
          <Line
            key={`vgrid-${i}`}
            x1={pt.x}
            y1={paddingY}
            x2={pt.x}
            y2={height - paddingY}
            stroke="#CBD5E1"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        ))}

        {/* Active perpendicular drop line from highlighted point down to baseline */}
        <Line
          x1={activeHighlightPoint.x}
          y1={activeHighlightPoint.y}
          x2={activeHighlightPoint.x}
          y2={height - paddingY}
          stroke={activeColor}
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.95}
        />

        {/* Perpendicular anchor dot on baseline */}
        <Circle
          cx={activeHighlightPoint.x}
          cy={height - paddingY}
          r={3.5}
          fill={activeColor}
        />

        {/* Gradient area under the line */}
        <Path
          d={areaD}
          fill="url(#lineGrad)"
          opacity={0.35}
        />

        {/* Main trend line */}
        <AnimatedPath
          d={pathD}
          stroke={activeColor}
          strokeWidth={3}
          fill="none"
          strokeDasharray={totalLength}
          animatedProps={animatedPathProps}
          strokeLinecap="round"
        />

        {/* Node dots on all points */}
        {points.map((pt, i) => {
          const isHighlight = pt === activeHighlightPoint;
          return (
            <Circle
              key={`dot-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={isHighlight ? 5 : 3}
              fill={isHighlight ? colors.surface : activeColor}
              stroke={activeColor}
              strokeWidth={isHighlight ? 3 : 1.5}
            />
          );
        })}
      </Svg>

      {/* Floating end/peak value pop badge */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: Math.min(Math.max(activeHighlightPoint.x - 32, 10), width - 75),
            top: Math.max(activeHighlightPoint.y - 34, 4),
            backgroundColor: colors.ink,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
          },
          dotAnimatedStyle,
        ]}
      >
        <Text style={{ color: colors.surface, fontSize: 11, fontWeight: '800' }}>
          {formatCompactINR(activeHighlightPoint.raw.y)}
        </Text>
      </Animated.View>
    </View>
  );
};
