import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Briefcase,
  ChevronRight,
  TrendingUp,
  MoveRight,
  Calendar,
  AlertTriangle,
} from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';
import { SearchInput } from '../../../src/components/SearchInput';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { UnderlineTabs } from '../../../src/animations/UnderlineTabs';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { useCan } from '../../../src/auth/useCan';
import { fetchDeals, updateDeal } from '../../../src/api/deals';
import { queryKeys } from '../../../src/api/queryKeys';
import { enqueueOfflineMutation } from '../../../src/offline/mutationQueue';
import { useIsRowHighlighted } from '../../../src/realtime/highlightStore';
import { Deal, DealStage } from '@flowdesk/shared';
import { CricbuzzScrollView } from '../../../src/components/CricbuzzPullToRefresh';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = Math.max(280, Math.min(SCREEN_WIDTH * 0.82, 330));

const STAGES: {
  key: DealStage;
  label: string;
  color: string;
  textColor: string;
  tintBg: string;
  probability: number;
}[] = [
  {
    key: 'qualified',
    label: 'Qualification',
    color: theme.colors.blue,
    textColor: theme.colors.blueText,
    tintBg: theme.colors.blueTint,
    probability: 0.2,
  },
  {
    key: 'proposal',
    label: 'Proposal',
    color: theme.colors.orange,
    textColor: theme.colors.orangeText,
    tintBg: theme.colors.orangeTint,
    probability: 0.5,
  },
  {
    key: 'negotiation',
    label: 'Negotiation',
    color: theme.colors.purple,
    textColor: theme.colors.purpleText,
    tintBg: theme.colors.purpleTint,
    probability: 0.8,
  },
  {
    key: 'won',
    label: 'Closed Won',
    color: theme.colors.green,
    textColor: theme.colors.greenText,
    tintBg: theme.colors.greenTint,
    probability: 1.0,
  },
  {
    key: 'lost',
    label: 'Closed Lost',
    color: '#94A3B8',
    textColor: '#475569',
    tintBg: '#F1F5F9',
    probability: 0.0,
  },
];

function DealCardItem({
  deal,
  onPress,
  onMoveStage,
}: {
  deal: Deal;
  onPress: () => void;
  onMoveStage: () => void;
}) {
  const isHighlighted = useIsRowHighlighted(deal._id);

  const accountName =
    typeof deal.account === 'object' && deal.account ? deal.account.name : 'Unknown Account';
  const contactName =
    typeof deal.contact === 'object' && deal.contact
      ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim()
      : null;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onMoveStage}
      accessibilityRole="none"
      style={[
        styles.dealCard,
        isHighlighted && styles.dealCardHighlighted,
      ]}
    >
      <Text style={styles.dealTitle} numberOfLines={1}>
        {accountName !== 'Unknown Account' ? accountName : deal.title}
      </Text>

      <Text style={styles.dealAmount}>
        {theme.helpers.formatINR(deal.amount)}
      </Text>

      {contactName ? (
        <Text style={styles.dealContact} numberOfLines={1}>
          {contactName}
        </Text>
      ) : (
        <Text style={styles.dealContact} numberOfLines={1}>
          {deal.title}
        </Text>
      )}

      <View style={styles.dealFooter}>
        <View style={styles.closeDateRow}>
          <Calendar size={13} color={theme.colors.muted} style={{ marginRight: 4 }} />
          <Text style={styles.closeDateText}>
            {deal.expectedClose
              ? new Date(deal.expectedClose).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })
              : 'No date'}
          </Text>
        </View>

        <PressableScale
          onPress={(e) => {
            e?.stopPropagation?.();
            onMoveStage();
          }}
          style={styles.moveStageBtn}
          accessibilityLabel="Change stage"
          accessibilityRole="button"
        >
          <MoveRight size={13} color={theme.colors.blue} />
          <Text style={styles.moveStageText}>Move</Text>
        </PressableScale>
      </View>

      {deal.aiRisk && deal.aiRisk.level === 'high' && (
        <View style={styles.riskBanner}>
          <AlertTriangle size={11} color={theme.colors.ratings.hot.text} />
          <Text style={styles.riskText}>High Risk Deal</Text>
        </View>
      )}
    </PressableScale>
  );
}

export default function DealsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canCreate = useCan('deal:create');
  const canUpdate = useCan('deal:update');

  const [activeTab, setActiveTab] = useState<'pipeline' | 'list' | 'forecast'>('pipeline');
  const [listSearch, setListSearch] = useState('');
  const [movingDeal, setMovingDeal] = useState<Deal | null>(null);

  // Fetch all deals
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.deals.list({ limit: 100 }),
    queryFn: () => fetchDeals({ limit: 100 }),
  });

  const deals = useMemo(() => data?.data || [], [data]);

  // Optimistic Stage PATCH Mutation
  const stageMutation = useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: DealStage }) =>
      updateDeal(dealId, { stage }),
    onMutate: async ({ dealId, stage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.deals.all });
      const previousDeals = queryClient.getQueryData<any>(queryKeys.deals.list({ limit: 100 }));

      if (previousDeals) {
        queryClient.setQueryData(queryKeys.deals.list({ limit: 100 }), {
          ...previousDeals,
          data: previousDeals.data.map((d: Deal) =>
            d._id === dealId ? { ...d, stage } : d
          ),
        });
      }
      return { previousDeals };
    },
    onError: async (err: any, vars, context) => {
      // If network failure / offline, queue mutation for background sync
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'MOVE_DEAL_STAGE',
          endpoint: `/deals/${vars.dealId}`,
          method: 'PATCH',
          payload: { stage: vars.stage },
          entityType: 'deal',
          entityId: vars.dealId,
          description: `Deal moved to ${vars.stage}`,
        });
        return;
      }
      if (context?.previousDeals) {
        queryClient.setQueryData(queryKeys.deals.list({ limit: 100 }), context.previousDeals);
      }
      if (err?.response?.status === 409 || err?.status === 409) {
        showToast('Updated on web — review', { type: 'warning' });
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      } else {
        showToast('Stage update failed. Rolled back.', { type: 'error' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      showToast('Deal stage updated', { type: 'success' });
    },
  });

  const handleSelectNewStage = (newStage: DealStage) => {
    if (!movingDeal) return;
    const dealId = movingDeal._id;
    setMovingDeal(null);
    stageMutation.mutate({ dealId, stage: newStage });
  };

  // Group deals by stage
  const stageColumns = useMemo(() => {
    return STAGES.map((stageObj) => {
      const dealsInStage = deals.filter((d) => d.stage === stageObj.key);
      const totalAmount = dealsInStage.reduce((sum, d) => sum + d.amount, 0);
      return {
        ...stageObj,
        deals: dealsInStage,
        totalAmount,
        count: dealsInStage.length,
      };
    });
  }, [deals]);

  // Forecast metrics
  const forecastMetrics = useMemo(() => {
    const totalPipelineAmount = deals.reduce((sum, d) => sum + d.amount, 0);
    const weightedForecastAmount = STAGES.reduce((sum, stageObj) => {
      const stageDeals = deals.filter((d) => d.stage === stageObj.key);
      const stageSum = stageDeals.reduce((s, d) => s + d.amount, 0);
      return sum + stageSum * stageObj.probability;
    }, 0);

    const wonDeals = deals.filter((d) => d.stage === 'won');
    const lostDeals = deals.filter((d) => d.stage === 'lost');
    const closedCount = wonDeals.length + lostDeals.length;
    const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

    return {
      totalPipelineAmount,
      weightedForecastAmount,
      winRate,
    };
  }, [deals]);

  // Filtered deals for List tab
  const filteredListDeals = useMemo(() => {
    if (!listSearch.trim()) return deals;
    const q = listSearch.toLowerCase();
    return deals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (typeof d.account === 'object' && d.account?.name?.toLowerCase().includes(q))
    );
  }, [deals, listSearch]);

  const tabs = [
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'list', label: 'List' },
    { key: 'forecast', label: 'Forecast' },
  ];

  return (
    <View style={styles.container}>
      <AppBar
        title="Deals"
        backgroundColor={theme.colors.appBar.deals}
        rightAction={
          canCreate ? (
            <PressableScale
              onPress={() => router.push('/(tabs)/deals/new')}
              accessibilityLabel="Create Deal"
              style={styles.addBtn}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
            </PressableScale>
          ) : null
        }
      />

      <ScreenEntrance style={styles.content}>
        {/* Underline Tabs */}
        <UnderlineTabs
          tabs={tabs}
          selected={activeTab}
          onSelect={(k) => setActiveTab(k as any)}
        />

        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.colors.orange} />
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Unable to load deals"
              message={(error as Error)?.message || 'Please check your connection.'}
              onRetry={() => refetch()}
            />
          </View>
        ) : (
          <>
            {/* 1. PIPELINE VIEW (Horizontally Paged Stage Columns) */}
            {activeTab === 'pipeline' && (
              <ScrollView
                horizontal
                pagingEnabled={false}
                snapToInterval={COLUMN_WIDTH + 14}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pipelineScroll}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={() => refetch()}
                    tintColor={theme.colors.orange}
                  />
                }
              >
                {stageColumns.map((col) => (
                  <View key={col.key} style={[styles.columnWrapper, { width: COLUMN_WIDTH }]}>
                    {/* Stage Header Box matching prototype design */}
                    <View style={[styles.columnHeaderBox, { backgroundColor: col.tintBg }]}>
                      <Text style={[styles.columnTitle, { color: col.textColor }]}>
                        {col.label}
                      </Text>
                      <Text style={styles.columnTotals}>
                        {theme.helpers.formatCompactINR(col.totalAmount)} · {col.count} {col.count === 1 ? 'deal' : 'deals'}
                      </Text>
                    </View>

                    {/* Cards in Stage */}
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.columnCardsList}
                    >
                      {col.deals.length === 0 ? (
                        <View style={styles.emptyColumn}>
                          <Text style={styles.emptyColumnText}>No deals in {col.label}</Text>
                        </View>
                      ) : (
                        col.deals.map((deal) => (
                          <DealCardItem
                            key={deal._id}
                            deal={deal}
                            onPress={() => router.push(`/(tabs)/deals/${deal._id}`)}
                            onMoveStage={() => canUpdate && setMovingDeal(deal)}
                          />
                        ))
                      )}
                    </ScrollView>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* 2. LIST VIEW (Flat searchable rows) */}
            {activeTab === 'list' && (
              <View style={styles.listTabContainer}>
                <View style={styles.searchWrapper}>
                  <SearchInput
                    value={listSearch}
                    onChangeText={setListSearch}
                    placeholder="Search deals by title or account..."
                  />
                </View>

                {filteredListDeals.length === 0 ? (
                  <EmptyState
                    title="No deals found"
                    description="Try searching with a different term."
                  />
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.listTabScroll}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => refetch()}
                        tintColor={theme.colors.orange}
                      />
                    }
                  >
                    {filteredListDeals.map((deal) => {
                      const stageObj = STAGES.find((s) => s.key === deal.stage);
                      return (
                        <PressableScale
                          key={deal._id}
                          onPress={() => router.push(`/(tabs)/deals/${deal._id}`)}
                          style={styles.dealListRow}
                        >
                          <View style={styles.dealListLeft}>
                            <Text style={styles.dealListTitle} numberOfLines={1}>
                              {deal.title}
                            </Text>
                            <Text style={styles.dealListSubtitle} numberOfLines={1}>
                              {typeof deal.account === 'object' && deal.account
                                ? deal.account.name
                                : 'No Account'}
                            </Text>
                          </View>

                          <View style={styles.dealListRight}>
                            <Text style={styles.dealListAmount}>
                              {theme.helpers.formatINR(deal.amount)}
                            </Text>
                            <Badge
                              label={stageObj?.label || deal.stage}
                              variant={
                                deal.stage === 'won'
                                  ? 'success'
                                  : deal.stage === 'lost'
                                  ? 'danger'
                                  : 'neutral'
                              }
                            />
                          </View>
                          <ChevronRight size={16} color={theme.colors.muted} />
                        </PressableScale>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* 3. FORECAST VIEW (Weighted probability breakdown) */}
            {activeTab === 'forecast' && (
              <CricbuzzScrollView
                contentContainerStyle={styles.forecastScroll}
                onRefresh={() => refetch()}
                refreshing={isRefetching}
                refreshAll={true}
              >
                {/* Summary Tiles */}
                <Card style={styles.forecastSummaryCard}>
                  <Text style={styles.forecastSectionTitle}>Revenue Forecast</Text>
                  <View style={styles.forecastTilesRow}>
                    <View style={styles.forecastTile}>
                      <Text style={styles.forecastTileLabel}>Total Pipeline</Text>
                      <Text style={styles.forecastTileValue}>
                        {theme.helpers.formatINR(forecastMetrics.totalPipelineAmount)}
                      </Text>
                    </View>
                    <View style={styles.forecastTile}>
                      <Text style={styles.forecastTileLabel}>Weighted Forecast</Text>
                      <Text style={[styles.forecastTileValue, { color: theme.colors.green }]}>
                        {theme.helpers.formatINR(forecastMetrics.weightedForecastAmount)}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Stage Breakdown Cards */}
                <Card style={styles.forecastBreakdownCard}>
                  <Text style={styles.forecastSectionTitle}>Stage Probability Analysis</Text>

                  <View style={styles.stageBreakdownList}>
                    {stageColumns.map((col) => {
                      const weighted = col.totalAmount * col.probability;
                      const progressPct =
                        forecastMetrics.totalPipelineAmount > 0
                          ? Math.round(
                              (col.totalAmount / forecastMetrics.totalPipelineAmount) * 100
                            )
                          : 0;

                      return (
                        <View key={col.key} style={styles.forecastStageItem}>
                          <View style={styles.forecastStageTop}>
                            <View style={styles.stageLabelGroup}>
                              <View style={[styles.stageDot, { backgroundColor: col.color }]} />
                              <Text style={styles.forecastStageName}>{col.label}</Text>
                              <Text style={styles.forecastStageProb}>
                                ({Math.round(col.probability * 100)}% prob)
                              </Text>
                            </View>
                            <Text style={styles.forecastStageAmount}>
                              {theme.helpers.formatCompactINR(col.totalAmount)}
                            </Text>
                          </View>

                          <ProgressBar
                            progress={progressPct}
                            color={col.color}
                            style={{ marginVertical: 6 }}
                          />

                          <View style={styles.forecastStageBottom}>
                            <Text style={styles.forecastStageDeals}>
                              {col.count} deals · {progressPct}% of pipeline
                            </Text>
                            <Text style={styles.forecastStageWeighted}>
                              Weighted: {theme.helpers.formatCompactINR(weighted)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </CricbuzzScrollView>
            )}
          </>
        )}
      </ScreenEntrance>

      {/* Move Deal Stage Bottom Sheet */}
      <BottomSheet
        visible={Boolean(movingDeal)}
        onClose={() => setMovingDeal(null)}
        title="Move Deal Stage"
      >
        <View style={styles.moveStageSheet}>
          <Text style={styles.moveDealTargetTitle}>
            {movingDeal?.title}
          </Text>
          <Text style={styles.moveDealTargetSubtitle}>
            Current Stage: {movingDeal?.stage?.toUpperCase()}
          </Text>

          <View style={styles.stageOptionsList}>
            {STAGES.map((s) => (
              <PressableScale
                key={s.key}
                onPress={() => handleSelectNewStage(s.key)}
                style={[
                  styles.stageOptionBtn,
                  movingDeal?.stage === s.key && styles.stageOptionBtnCurrent,
                ]}
              >
                <View style={[styles.stageDot, { backgroundColor: s.color }]} />
                <Text style={styles.stageOptionText}>{s.label}</Text>
                {movingDeal?.stage === s.key && (
                  <Text style={styles.stageOptionCurrentBadge}>Current</Text>
                )}
              </PressableScale>
            ))}
          </View>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },
  pipelineScroll: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 14,
    paddingBottom: 90,
    gap: 14,
  },
  columnWrapper: {
    backgroundColor: 'transparent',
    borderRadius: theme.radii.card,
    maxHeight: '94%',
  },
  columnHeaderBox: {
    borderRadius: theme.radii.input,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  columnTitle: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  columnTotals: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
  },
  columnCardsList: {
    gap: 10,
    paddingBottom: 10,
  },
  emptyColumn: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyColumnText: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  dealCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dealCardHighlighted: {
    borderColor: theme.colors.blue,
    backgroundColor: 'rgba(47, 111, 237, 0.08)',
  },
  dealTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  dealAmount: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800' as const,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  dealContact: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginBottom: 10,
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 8,
    marginTop: 4,
  },
  closeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeDateText: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  moveStageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceMuted,
  },
  moveStageText: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    color: theme.colors.blue,
    marginLeft: 3,
  },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.ratings.hot.bg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
    gap: 4,
  },
  riskText: {
    fontSize: 10,
    fontFamily: theme.typography.families.bold,
    color: theme.colors.ratings.hot.text,
  },
  listTabContainer: {
    flex: 1,
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.screen,
    paddingVertical: 12,
  },
  listTabScroll: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: 90,
  },
  dealListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: theme.radii.listRow,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.listRowGap,
  },
  dealListLeft: {
    flex: 1,
  },
  dealListTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 2,
  },
  dealListSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  dealListRight: {
    alignItems: 'flex-end',
    marginRight: 8,
    gap: 4,
  },
  dealListAmount: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  forecastScroll: {
    padding: theme.spacing.screen,
    paddingBottom: 90,
  },
  forecastSummaryCard: {
    padding: 16,
    marginBottom: 14,
  },
  forecastSectionTitle: {
    fontSize: theme.typography.sectionTitle.fontSize,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: theme.typography.sectionTitle.fontWeight,
    color: theme.colors.ink,
    marginBottom: 12,
  },
  forecastTilesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  forecastTile: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    padding: 12,
  },
  forecastTileLabel: {
    fontSize: 11,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  forecastTileValue: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  forecastBreakdownCard: {
    padding: 16,
  },
  stageBreakdownList: {
    gap: 16,
  },
  forecastStageItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: 12,
  },
  forecastStageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  forecastStageName: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginRight: 6,
  },
  forecastStageProb: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  forecastStageAmount: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  forecastStageBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forecastStageDeals: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  forecastStageWeighted: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.green,
  },
  moveStageSheet: {
    gap: 12,
  },
  moveDealTargetTitle: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  moveDealTargetSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginBottom: 6,
  },
  stageOptionsList: {
    gap: 8,
  },
  stageOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  stageOptionBtnCurrent: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },
  stageOptionText: {
    fontSize: 14,
    fontFamily: theme.typography.families.semiBold,
    color: theme.colors.ink,
    flex: 1,
  },
  stageOptionCurrentBadge: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    color: theme.colors.muted,
  },
});
