import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, ChevronRight } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { SearchInput } from '../../../src/components/SearchInput';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { SourceChip } from '../../../src/components/SourceChip';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { SwipeableRow } from '../../../src/components/SwipeableRow';
import { PressableScale } from '../../../src/animations/PressableScale';
import { SegmentedChips } from '../../../src/animations/SegmentedChips';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { useCan } from '../../../src/auth/useCan';
import { fetchLeads } from '../../../src/api/leads';
import { queryKeys } from '../../../src/api/queryKeys';
import { useIsRowHighlighted } from '../../../src/realtime/highlightStore';
import { Lead } from '@flowdesk/shared';

function LeadItemRow({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const isHighlighted = useIsRowHighlighted(lead._id);
  const highlightProgress = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightProgress.value = 1;
      highlightProgress.value = withTiming(0, {
        duration: 1200,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [isHighlighted, highlightProgress]);

  const animatedHighlightStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.surface, 'rgba(47, 111, 237, 0.12)']
    );
    const borderColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.border, theme.colors.blue]
    );
    return {
      backgroundColor,
      borderColor,
    };
  });

  const ratingVariant =
    lead.rating === 'hot' ? 'hot' : lead.rating === 'warm' ? 'warm' : 'cold';

  return (
    <SwipeableRow phone={lead.phone}>
      <PressableScale onPress={onPress}>
        <Animated.View style={[styles.leadRow, animatedHighlightStyle]}>
          <Avatar name={lead.name} size={42} />

          <View style={styles.leadCenter}>
            <View style={styles.leadHeaderLine}>
              <Text style={styles.leadName} numberOfLines={1}>
                {lead.name}
              </Text>
            </View>

            <Text style={styles.leadCompany} numberOfLines={1}>
              {lead.company || 'No Company'}
            </Text>

            <View style={styles.leadMetaLine}>
              <SourceChip source={lead.source} />
              <Text style={styles.leadTime}>
                · {theme.helpers.relativeTime(lead.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.leadRight}>
            <Badge label={lead.rating || 'warm'} variant={ratingVariant} />
          </View>
        </Animated.View>
      </PressableScale>
    </SwipeableRow>
  );
}

function LeadsSkeletonList() {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={42} height={42} style={{ borderRadius: 21 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="50%" height={16} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="35%" height={12} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="40%" height={10} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={50} height={22} style={{ borderRadius: 6 }} />
        </View>
      ))}
    </View>
  );
}

export default function LeadsScreen() {
  const router = useRouter();
  const canCreate = useCan('lead:create');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: queryKeys.leads.list({
      search: debouncedSearch,
      rating: ratingFilter === 'all' ? undefined : ratingFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
    }),
    queryFn: ({ pageParam }) =>
      fetchLeads({
        cursor: pageParam as string | undefined,
        limit: 15,
        search: debouncedSearch || undefined,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
  });

  const leads = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) || [];
  }, [data]);

  // Compute counts for chips from loaded data
  const ratingCounts = useMemo(() => {
    const counts = { all: leads.length, hot: 0, warm: 0, cold: 0 };
    leads.forEach((l) => {
      if (l.rating === 'hot') counts.hot++;
      else if (l.rating === 'warm') counts.warm++;
      else if (l.rating === 'cold') counts.cold++;
    });
    return counts;
  }, [leads]);

  const chips = [
    { key: 'all', label: 'All', count: ratingCounts.all },
    { key: 'hot', label: 'Hot', count: ratingCounts.hot, badgeColor: theme.colors.ratings.hot.bg },
    { key: 'warm', label: 'Warm', count: ratingCounts.warm, badgeColor: theme.colors.ratings.warm.bg },
    { key: 'cold', label: 'Cold', count: ratingCounts.cold, badgeColor: theme.colors.ratings.cold.bg },
  ];

  return (
    <View style={styles.container}>
      <AppBar
        title="Leads"
        backgroundColor={theme.colors.appBar.leads}
        rightAction={
          canCreate ? (
            <PressableScale
              onPress={() => router.push('/(tabs)/leads/new')}
              accessibilityLabel="Create Lead"
              style={styles.addBtn}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
            </PressableScale>
          ) : null
        }
      />

      <ScreenEntrance style={styles.content}>
        {/* Search & Filter Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <SearchInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search leads by name, company..."
            />
          </View>
          <PressableScale
            onPress={() => setFilterSheetVisible(true)}
            style={[
              styles.filterBtn,
              (statusFilter !== 'all' || sourceFilter !== 'all') && styles.filterBtnActive,
            ]}
            accessibilityLabel="Filter Leads"
          >
            <SlidersHorizontal
              size={18}
              color={
                statusFilter !== 'all' || sourceFilter !== 'all'
                  ? theme.colors.blue
                  : theme.colors.ink
              }
            />
          </PressableScale>
        </View>

        {/* Rating Filter Chips (All / Hot / Warm / Cold with counts) */}
        <View style={styles.chipsContainer}>
          <SegmentedChips
            chips={chips}
            selected={ratingFilter}
            onSelect={(k) => setRatingFilter(k as any)}
          />
        </View>

        {/* Main List */}
        {isLoading ? (
          <LeadsSkeletonList />
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load leads"
              message={(error as Error)?.message || 'Please check your connection.'}
              onRetry={() => refetch()}
            />
          </View>
        ) : leads.length === 0 ? (
          <EmptyState
            title="No leads found"
            description={
              search || ratingFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search query or filter criteria.'
                : 'Get started by creating your first sales lead.'
            }
            actionLabel={canCreate ? 'Create Lead' : undefined}
            onAction={canCreate ? () => router.push('/(tabs)/leads/new') : undefined}
          />
        ) : (
          <FlashList
            data={leads}
            keyExtractor={(item) => item._id}
            estimatedItemSize={84}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <LeadItemRow
                lead={item}
                onPress={() => router.push(`/(tabs)/leads/${item._id}`)}
              />
            )}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => refetch()}
                tintColor={theme.colors.orange}
                colors={[theme.colors.orange]}
              />
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={theme.colors.orange} />
                </View>
              ) : null
            }
          />
        )}
      </ScreenEntrance>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        title="Filter Leads"
      >
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {/* Status Filter */}
          <Text style={styles.sheetSectionTitle}>Status</Text>
          <View style={styles.sheetPillsRow}>
            {['all', 'new', 'contacted', 'qualified', 'converted', 'lost'].map((st) => (
              <PressableScale
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[
                  styles.sheetPill,
                  statusFilter === st && styles.sheetPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.sheetPillText,
                    statusFilter === st && styles.sheetPillTextActive,
                  ]}
                >
                  {st.toUpperCase()}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Source Filter */}
          <Text style={[styles.sheetSectionTitle, { marginTop: 18 }]}>Source</Text>
          <View style={styles.sheetPillsRow}>
            {['all', 'website', 'referral', 'social', 'email', 'event', 'other'].map((sc) => (
              <PressableScale
                key={sc}
                onPress={() => setSourceFilter(sc)}
                style={[
                  styles.sheetPill,
                  sourceFilter === sc && styles.sheetPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.sheetPillText,
                    sourceFilter === sc && styles.sheetPillTextActive,
                  ]}
                >
                  {sc.toUpperCase()}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Reset Filters Button */}
          <PressableScale
            onPress={() => {
              setStatusFilter('all');
              setSourceFilter('all');
              setRatingFilter('all');
              setFilterSheetVisible(false);
            }}
            style={styles.sheetResetBtn}
          >
            <Text style={styles.sheetResetText}>Reset All Filters</Text>
          </PressableScale>
        </ScrollView>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 12,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.input,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: theme.colors.blue,
    backgroundColor: 'rgba(47, 111, 237, 0.08)',
  },
  chipsContainer: {
    paddingHorizontal: theme.spacing.screen,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: 90,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.radii.listRow,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.listRowGap,
  },
  leadCenter: {
    flex: 1,
    marginLeft: 12,
  },
  leadHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  leadName: {
    fontSize: theme.typography.rowTitle.fontSize,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: theme.typography.rowTitle.fontWeight,
    color: theme.colors.ink,
  },
  leadCompany: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginBottom: 4,
  },
  leadMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadTime: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    marginLeft: 4,
  },
  leadRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },
  skeletonContainer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 8,
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.radii.listRow,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetScroll: {
    maxHeight: 380,
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sheetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  sheetPillActive: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.ink,
  },
  sheetPillText: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.text2,
  },
  sheetPillTextActive: {
    color: '#FFFFFF',
  },
  sheetResetBtn: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  sheetResetText: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ratings.hot.text,
  },
});
