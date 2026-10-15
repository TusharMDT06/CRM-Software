import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  PieChart,
} from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { ErrorState } from '../../../src/components/ErrorState';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { Stagger } from '../../../src/animations/Stagger';
import { PressableScale } from '../../../src/animations/PressableScale';
import { LineChart, LineChartPoint } from '../../../src/animations/LineChart';
import { Donut } from '../../../src/animations/Donut';
import { Skeleton } from '../../../src/animations/Skeleton';
import { fetchSalesTrend, fetchStageAnalysis, fetchKpis } from '../../../src/api/reports';
import { queryKeys } from '../../../src/api/queryKeys';
import { TimeRange } from '@flowdesk/shared';

const RANGES: { key: TimeRange; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const STAGE_COLORS: Record<string, string> = {
  qualified: theme.colors.blue,
  proposal: theme.colors.orange,
  negotiation: theme.colors.purple,
  won: theme.colors.green,
  lost: '#94A3B8',
};

const STAGE_LABELS: Record<string, string> = {
  qualified: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Closed Won',
  lost: 'Closed Lost',
};

function ReportsSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <Skeleton width="100%" height={260} style={{ borderRadius: theme.radii.card, marginBottom: 16 }} />
      <Skeleton width="100%" height={250} style={{ borderRadius: theme.radii.card, marginBottom: 16 }} />
      <View style={styles.kpiRow}>
        <Skeleton width="31%" height={90} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="31%" height={90} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="31%" height={90} style={{ borderRadius: theme.radii.card }} />
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(280, Math.min(windowWidth - 60, 600));
  const [range, setRange] = useState<TimeRange>('month');
  const [rangeSheetVisible, setRangeSheetVisible] = useState(false);

  // 1. Sales Trend
  const {
    data: salesTrend,
    isLoading: trendLoading,
    isError: trendError,
    refetch: refetchTrend,
    isRefetching: trendRefetching,
  } = useQuery({
    queryKey: queryKeys.reports.salesTrend(range),
    queryFn: () => fetchSalesTrend(range),
  });

  // 2. Stage Analysis
  const {
    data: stageAnalysis,
    isLoading: stageLoading,
    isError: stageError,
    refetch: refetchStage,
    isRefetching: stageRefetching,
  } = useQuery({
    queryKey: queryKeys.reports.stageAnalysis(),
    queryFn: fetchStageAnalysis,
  });

  // 3. KPIs
  const {
    data: kpis,
    isLoading: kpisLoading,
    isError: kpisError,
    refetch: refetchKpis,
    isRefetching: kpisRefetching,
  } = useQuery({
    queryKey: queryKeys.reports.kpis(range),
    queryFn: () => fetchKpis(range),
  });

  const isLoading = trendLoading || stageLoading || kpisLoading;
  const isError = trendError || stageError || kpisError;
  const isRefetching = trendRefetching || stageRefetching || kpisRefetching;

  const handleRefetchAll = () => {
    refetchTrend();
    refetchStage();
    refetchKpis();
  };

  // Prepare line chart points
  const lineChartData: LineChartPoint[] = useMemo(() => {
    if (!salesTrend?.trend || salesTrend.trend.length === 0) {
      return [
        { x: '1', y: 0 },
        { x: '2', y: 0 },
      ];
    }
    return salesTrend.trend.map((pt) => ({
      x: pt.label,
      y: pt.amount,
    }));
  }, [salesTrend]);

  // Prepare donut segments
  const donutData = useMemo(() => {
    if (!stageAnalysis?.stages) return [];
    return stageAnalysis.stages
      .filter((s) => s.count > 0)
      .map((s) => ({
        label: STAGE_LABELS[s.stage] || s.stage,
        value: s.count,
        color: STAGE_COLORS[s.stage] || theme.colors.blue,
      }));
  }, [stageAnalysis]);

  const activeRangeLabel = RANGES.find((r) => r.key === range)?.label || 'This Month';
  const isPositiveDelta = (salesTrend?.changePercent ?? 0) >= 0;

  return (
    <View style={styles.container}>
      {/* App Bar with Period Selector */}
      <AppBar
        title="Reports"
        backgroundColor={theme.colors.appBar.reports}
        showBack
        rightAction={
          <PressableScale
            onPress={() => setRangeSheetVisible(true)}
            style={styles.periodPill}
            accessibilityLabel={`Select period: ${activeRangeLabel}`}
          >
            <Text style={styles.periodPillText}>{activeRangeLabel}</Text>
            <ChevronDown size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </PressableScale>
        }
      />

      <ScreenEntrance style={styles.content}>
        {isLoading ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ReportsSkeleton />
          </ScrollView>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load reports"
              message="Could not retrieve the analytics data. Please verify your connection."
              onRetry={handleRefetchAll}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefetchAll}
                tintColor={theme.colors.orange}
              />
            }
          >
            {/* 1. SALES TREND CARD */}
            <Stagger index={0}>
              <Card style={styles.chartCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardEyebrow}>Sales Trend</Text>
                    <Text style={styles.revenueValue}>
                      {theme.helpers.formatINR(salesTrend?.totalRevenue ?? 0)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.deltaBadge,
                      {
                        backgroundColor: isPositiveDelta
                          ? 'rgba(34, 160, 107, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}
                  >
                    {isPositiveDelta ? (
                      <TrendingUp size={13} color={theme.colors.green} style={{ marginRight: 3 }} />
                    ) : (
                      <TrendingDown size={13} color={theme.colors.ratings.hot.text} style={{ marginRight: 3 }} />
                    )}
                    <Text
                      style={[
                        styles.deltaText,
                        {
                          color: isPositiveDelta
                            ? theme.colors.green
                            : theme.colors.ratings.hot.text,
                        },
                      ]}
                    >
                      {isPositiveDelta ? `+${salesTrend?.changePercent}%` : `${salesTrend?.changePercent}%`}
                    </Text>
                  </View>
                </View>

                {/* Self-drawing line chart */}
                <View style={styles.lineChartWrapper}>
                  <LineChart
                    data={lineChartData}
                    width={chartWidth}
                    height={160}
                    color={theme.colors.blue}
                    gradientFrom={theme.colors.blueTint}
                  />

                  {/* X-axis labels */}
                  <View style={styles.xAxisRow}>
                    {salesTrend?.trend && salesTrend.trend.length > 0 && (() => {
                      const total = salesTrend.trend.length;
                      const indices = [
                        0,
                        Math.floor(total * 0.33),
                        Math.floor(total * 0.66),
                        total - 1,
                      ].filter((val, idx, self) => self.indexOf(val) === idx);

                      return indices.map((idx) => {
                        const pt = salesTrend.trend[idx];
                        return (
                          <Text
                            key={pt.date + idx}
                            style={styles.xLabel}
                            numberOfLines={1}
                          >
                            {pt.label}
                          </Text>
                        );
                      });
                    })()}
                  </View>
                </View>
              </Card>
            </Stagger>

            {/* 2. DEAL STAGE ANALYSIS */}
            <Stagger index={1}>
              <Card style={styles.donutCard}>
                <Text style={styles.sectionTitle}>Deal Stage Analysis</Text>

                <View style={styles.donutLayout}>
                  <View style={styles.donutWrapper}>
                    <Donut
                      data={donutData}
                      size={160}
                      strokeWidth={20}
                      centerLabel={String(stageAnalysis?.totalDeals ?? 0)}
                      centerSubLabel="Deals"
                    />
                  </View>

                  <View style={styles.legendCol}>
                    {stageAnalysis?.stages?.map((stageItem) => {
                      const color = STAGE_COLORS[stageItem.stage] || theme.colors.blue;
                      return (
                        <View key={stageItem.stage} style={styles.legendRow}>
                          <View style={styles.legendLeft}>
                            <View style={[styles.legendBox, { backgroundColor: color }]} />
                            <Text style={styles.legendName} numberOfLines={1}>
                              {STAGE_LABELS[stageItem.stage] || stageItem.stage}
                            </Text>
                          </View>
                          <Text style={styles.legendPct}>
                            {stageItem.percentage}%
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Card>
            </Stagger>

            {/* 3. THREE KPI TILES */}
            <Stagger index={2}>
              <View style={styles.kpiRow}>
                {/* Win Rate */}
                <Card style={styles.kpiTile}>
                  <Text style={styles.kpiTileTitle}>Win rate</Text>
                  <Text style={styles.kpiTileValue}>
                    {kpis?.winRate ?? 0}%
                  </Text>
                </Card>

                {/* Avg. Deal */}
                <Card style={styles.kpiTile}>
                  <Text style={styles.kpiTileTitle}>Avg. deal</Text>
                  <Text style={styles.kpiTileValue}>
                    {theme.helpers.formatCompactINR(kpis?.averageDealSize ?? 0)}
                  </Text>
                </Card>

                {/* Sales Cycle */}
                <Card style={styles.kpiTile}>
                  <Text style={styles.kpiTileTitle}>Sales cycle</Text>
                  <Text style={styles.kpiTileValue}>
                    {kpis?.salesCycleDays ?? 0} days
                  </Text>
                </Card>
              </View>
            </Stagger>
          </ScrollView>
        )}
      </ScreenEntrance>

      {/* Period Selection Bottom Sheet */}
      <BottomSheet
        visible={rangeSheetVisible}
        onClose={() => setRangeSheetVisible(false)}
        title="Select Reporting Period"
      >
        <View style={styles.sheetContent}>
          {RANGES.map((r) => {
            const isSelected = r.key === range;
            return (
              <PressableScale
                key={r.key}
                onPress={() => {
                  setRange(r.key);
                  setRangeSheetVisible(false);
                }}
                style={[
                  styles.rangeOption,
                  isSelected && styles.rangeOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.rangeOptionText,
                    isSelected && styles.rangeOptionTextSelected,
                  ]}
                >
                  {r.label}
                </Text>
                {isSelected && (
                  <View style={styles.selectedDot} />
                )}
              </PressableScale>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.screen,
    paddingBottom: 100,
    gap: 16,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  periodPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
  },
  skeletonContainer: {
    gap: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },
  chartCard: {
    padding: 16,
    borderRadius: theme.radii.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardEyebrow: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginBottom: 2,
  },
  revenueValue: {
    fontSize: 26,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.badge,
  },
  deltaText: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  lineChartWrapper: {
    marginTop: 4,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 10,
  },
  xLabel: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  donutCard: {
    padding: 16,
    borderRadius: theme.radii.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 14,
  },
  donutLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendCol: {
    flex: 1,
    marginLeft: 18,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginRight: 8,
  },
  legendName: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.ink,
    flex: 1,
  },
  legendPct: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginLeft: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  kpiTile: {
    flex: 1,
    padding: 14,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTileTitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiTileValue: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    textAlign: 'center',
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  rangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radii.input,
    backgroundColor: theme.colors.surfaceMuted,
  },
  rangeOptionSelected: {
    backgroundColor: theme.colors.blueTint,
  },
  rangeOptionText: {
    fontSize: 15,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.ink,
  },
  rangeOptionTextSelected: {
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.blueText,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.blue,
  },
});
