import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { theme } from '../theme';
import { formatCompactINR } from '../theme/helpers';
import { CountUp } from '../animations/CountUp';

interface KpiCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta?: number; // e.g. +14 for +14%, -5 for -5%
  deltaPeriod?: string; // e.g. "this month"
  badgeText?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  isCurrency?: boolean;
  formatter?: (val: number) => string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  prefix = '',
  suffix = '',
  delta,
  deltaPeriod = 'this month',
  badgeText,
  badgeBgColor,
  badgeTextColor,
  accentColor = theme.colors.blue,
  backgroundColor,
  isCurrency = false,
  formatter,
}) => {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  const cardBg = backgroundColor || theme.colors.surface;
  const hasTint = Boolean(backgroundColor && backgroundColor !== theme.colors.surface);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: hasTint ? 'transparent' : theme.colors.border,
        },
      ]}
    >
      {!hasTint && accentColor && (
        <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />
      )}

      <View style={styles.content}>
        <View style={styles.titleRow}>
          {hasTint && accentColor && (
            <View style={[styles.titleDot, { backgroundColor: accentColor }]} />
          )}
          <Text style={[styles.title, hasTint && styles.tintedTitle]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.valueRow}>
          <CountUp
            value={value}
            prefix={isCurrency ? '' : prefix}
            suffix={suffix}
            formatter={isCurrency ? (formatter || formatCompactINR) : formatter}
            style={styles.valueText}
          />
        </View>

        {badgeText ? (
          <View style={styles.deltaContainer}>
            <View
              style={[
                styles.customBadge,
                badgeBgColor ? { backgroundColor: badgeBgColor } : null,
              ]}
            >
              <Text
                style={[
                  styles.customBadgeText,
                  badgeTextColor ? { color: badgeTextColor } : null,
                ]}
                numberOfLines={1}
              >
                {badgeText}
              </Text>
            </View>
          </View>
        ) : delta !== undefined ? (
          <View style={styles.deltaContainer}>
            {hasTint ? (
              <View style={styles.inlineDeltaRow}>
                {isPositive ? (
                  <TrendingUp size={13} color={theme.colors.green} style={styles.inlineIcon} />
                ) : isNegative ? (
                  <TrendingDown size={13} color={theme.colors.ratings.hot.text} style={styles.inlineIcon} />
                ) : (
                  <Minus size={13} color={theme.colors.muted} style={styles.inlineIcon} />
                )}
                <Text
                  style={[
                    styles.inlineDeltaText,
                    {
                      color: isPositive
                        ? theme.colors.green
                        : isNegative
                        ? theme.colors.ratings.hot.text
                        : theme.colors.muted,
                    },
                  ]}
                >
                  {isPositive ? `${delta}%` : `${Math.abs(delta)}%`} {deltaPeriod}
                </Text>
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.deltaBadge,
                    {
                      backgroundColor: isPositive
                        ? 'rgba(16, 185, 129, 0.12)'
                        : isNegative
                        ? 'rgba(239, 68, 68, 0.12)'
                        : theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  {isPositive ? (
                    <TrendingUp size={12} color={theme.colors.green} style={styles.deltaIcon} />
                  ) : isNegative ? (
                    <TrendingDown size={12} color={theme.colors.ratings.hot.text} style={styles.deltaIcon} />
                  ) : (
                    <Minus size={12} color={theme.colors.muted} style={styles.deltaIcon} />
                  )}
                  <Text
                    style={[
                      styles.deltaText,
                      {
                        color: isPositive
                          ? theme.colors.green
                          : isNegative
                          ? theme.colors.ratings.hot.text
                          : theme.colors.muted,
                      },
                    ]}
                  >
                    {isPositive ? `+${delta}%` : `${delta}%`}
                  </Text>
                </View>

                <Text style={styles.periodText} numberOfLines={1}>
                  {deltaPeriod}
                </Text>
              </>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  accentStripe: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  title: {
    ...theme.typography.meta,
    color: theme.colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tintedTitle: {
    textTransform: 'none',
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
    letterSpacing: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  valueText: {
    ...theme.typography.kpi,
    color: theme.colors.ink,
  },
  deltaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineIcon: {
    marginRight: 3,
  },
  inlineDeltaText: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '600' as const,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.badge,
  },
  deltaIcon: {
    marginRight: 3,
  },
  deltaText: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
  },
  periodText: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignSelf: 'flex-start',
  },
  customBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
  },
});
