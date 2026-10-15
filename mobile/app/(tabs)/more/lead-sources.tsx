import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Globe,
  Plus,
} from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { ErrorState } from '../../../src/components/ErrorState';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { Stagger } from '../../../src/animations/Stagger';
import { PressableScale } from '../../../src/animations/PressableScale';
import { AnimatedBar } from '../../../src/animations/AnimatedBar';
import { Skeleton } from '../../../src/animations/Skeleton';
import { fetchLeadSourcesSummary } from '../../../src/api/leadSources';
import { queryKeys } from '../../../src/api/queryKeys';
import { TimeRange } from '@flowdesk/shared';

const RANGES: { key: TimeRange; label: string; title: string }[] = [
  { key: 'week', label: 'This Week', title: 'New leads this week' },
  { key: 'month', label: 'This Month', title: 'New leads this month' },
  { key: 'quarter', label: 'This Quarter', title: 'New leads this quarter' },
  { key: 'year', label: 'This Year', title: 'New leads this year' },
];

function LeadSourcesSkeleton() {
  return (
    <View style={{ gap: theme.spacing.cardGap }}>
      {/* Top Card Skeleton */}
      <Card style={[styles.topCard, { backgroundColor: '#FBEFE7', borderColor: '#F5DAC8' }]}>
        <Skeleton width={130} height={14} borderRadius={4} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Skeleton width={80} height={36} borderRadius={8} />
          <Skeleton width={110} height={26} borderRadius={13} />
        </View>
      </Card>

      {/* Sources Card Skeleton */}
      <Card style={styles.sectionCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <Skeleton width={120} height={18} borderRadius={4} />
          <Skeleton width={60} height={16} borderRadius={4} />
        </View>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Skeleton width={80} height={16} borderRadius={4} />
            <Skeleton width="55%" height={8} borderRadius={4} style={{ marginHorizontal: 12 }} />
            <Skeleton width={24} height={16} borderRadius={4} />
          </View>
        ))}
      </Card>

      {/* Connected Channels Skeleton */}
      <Card style={styles.sectionCard}>
        <Skeleton width={150} height={18} borderRadius={4} style={{ marginBottom: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Skeleton width={38} height={38} borderRadius={12} />
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginLeft: 12 }} />
            <View style={{ flex: 1 }} />
            <Skeleton width={80} height={16} borderRadius={4} />
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function LeadSourcesScreen() {
  const [range, setRange] = useState<TimeRange>('month');
  const [rangeSheetVisible, setRangeSheetVisible] = useState(false);

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.leadSources.summary(range),
    queryFn: () => fetchLeadSourcesSummary(range),
  });

  const activeRangeObj = RANGES.find((r) => r.key === range) || RANGES[1];
  const isPositiveDelta = (summary?.newLeadsDeltaPercent ?? 0) >= 0;

  // Calculate highest count for relative bar width
  const maxSourceCount = useMemo(() => {
    if (!summary?.bySource || summary.bySource.length === 0) return 1;
    return Math.max(...summary.bySource.map((s) => s.count), 1);
  }, [summary]);

  const handleOpenChannelSetup = (channelName?: string) => {
    Alert.alert(
      'Finish setup on web',
      `Connecting and editing lead channels like ${
        channelName || 'Google Ads, Meta & Web forms'
      } requires webhook tokens managed in the FlowDesk web app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Web App',
          onPress: () => {
            const clientUrl = 'http://localhost:5173/settings';
            Linking.openURL(clientUrl).catch(() => {
              Alert.alert('Cannot open URL', `Please visit ${clientUrl} on your browser.`);
            });
          },
        },
      ]
    );
  };

  // Deterministic icon/badge renderer for channel rows
  const renderChannelIcon = (name: string, channel: string) => {
    const lower = (name + ' ' + channel).toLowerCase();
    if (lower.includes('google')) {
      return (
        <View style={[styles.channelIconBox, { backgroundColor: '#E7EEFB' }]}>
          <Text style={[styles.channelIconText, { color: theme.colors.blue }]}>G</Text>
        </View>
      );
    }
    if (lower.includes('facebook') || lower.includes('meta')) {
      return (
        <View style={[styles.channelIconBox, { backgroundColor: '#E7EEFB' }]}>
          <Text style={[styles.channelIconText, { color: theme.colors.blue }]}>f</Text>
        </View>
      );
    }
    if (lower.includes('instagram')) {
      return (
        <View style={[styles.channelIconBox, { backgroundColor: '#EFEBFF' }]}>
          <Text style={[styles.channelIconText, { color: theme.colors.purple }]}>Ig</Text>
        </View>
      );
    }
    return (
      <View style={[styles.channelIconBox, { backgroundColor: '#FFEEDF' }]}>
        <Globe size={18} color={theme.colors.orange} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* App Bar: Orange background (#C2410C) */}
      <AppBar
        title="Lead Sources"
        showBack
        backgroundColor={theme.colors.appBar.leadSources}
        rightAction={
          <PressableScale
            onPress={() => setRangeSheetVisible(true)}
            style={styles.periodPill}
            accessibilityLabel={`Select period: ${activeRangeObj.label}`}
          >
            <Text style={styles.periodPillText}>{activeRangeObj.label}</Text>
            <ChevronDown size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </PressableScale>
        }
      />

      <ScreenEntrance style={styles.content}>
        {isLoading ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <LeadSourcesSkeleton />
          </ScrollView>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load lead sources"
              message="Could not retrieve lead channel analytics. Please check your connection."
              onRetry={refetch}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.orange}
              />
            }
          >
            {/* 1. TOP STAT CARD: New leads this period + delta badge */}
            <Stagger index={0}>
              <Card style={styles.topCard}>
                <View style={styles.topCardHeader}>
                  <Text style={styles.topCardLabel}>{activeRangeObj.title}</Text>
                  <View style={styles.deltaBadge}>
                    {isPositiveDelta ? (
                      <TrendingUp size={12} color="#12724B" style={{ marginRight: 3 }} />
                    ) : (
                      <TrendingDown size={12} color={theme.colors.ratings.hot.text} style={{ marginRight: 3 }} />
                    )}
                    <Text
                      style={[
                        styles.deltaText,
                        { color: isPositiveDelta ? '#12724B' : theme.colors.ratings.hot.text },
                      ]}
                    >
                      {isPositiveDelta ? '↑' : '↓'}{' '}
                      {Math.abs(summary?.newLeadsDeltaPercent ?? 0)}% vs last{' '}
                      {range === 'quarter' ? 'quarter' : range === 'year' ? 'year' : range === 'month' ? 'month' : 'week'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.topCardValue}>
                  {summary?.newLeadsThisWeek ?? 0}
                </Text>
              </Card>
            </Stagger>

            {/* 2. LEADS BY SOURCE HORIZONTAL BARS */}
            <Stagger index={1}>
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Leads by source</Text>
                  <Text style={styles.totalBadge}>
                    {(summary?.totalLeads ?? 0)} total
                  </Text>
                </View>

                {(!summary?.bySource || summary.bySource.length === 0) ? (
                  <Text style={styles.emptyText}>No lead sources recorded yet.</Text>
                ) : (
                  <View style={styles.sourceList}>
                    {summary.bySource.map((item, idx) => {
                      const percentageOfMax = Math.round((item.count / maxSourceCount) * 100);
                      const displayTitle =
                        item.source.charAt(0).toUpperCase() + item.source.slice(1).replace(/_/g, ' ');

                      return (
                        <View key={item.source || idx} style={styles.sourceRow}>
                          <Text style={styles.sourceName} numberOfLines={1}>
                            {displayTitle}
                          </Text>
                          <View style={styles.barContainer}>
                            <AnimatedBar
                              percentage={percentageOfMax}
                              color={theme.colors.blue}
                              trackColor="#F0EFEA"
                              height={8}
                              delay={idx * 100}
                            />
                          </View>
                          <Text style={styles.sourceCount}>{item.count}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            </Stagger>

            {/* 3. CONNECTED CHANNELS CARD */}
            <Stagger index={2}>
              <Card style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>
                  Connected channels
                </Text>

                <View style={styles.channelsList}>
                  {(summary?.connectedChannels ?? []).map((ch) => {
                    const isConnected = ch.status === 'connected';
                    return (
                      <PressableScale
                        key={ch.id}
                        onPress={() => handleOpenChannelSetup(ch.name)}
                        style={styles.channelRow}
                      >
                        {renderChannelIcon(ch.name, ch.channel)}
                        <Text style={styles.channelName} numberOfLines={1}>
                          {ch.name}
                        </Text>
                        <View style={styles.statusPill}>
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor: isConnected
                                  ? theme.colors.green
                                  : theme.colors.orange,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              {
                                color: isConnected
                                  ? '#12724B'
                                  : '#A54708',
                              },
                            ]}
                          >
                            {isConnected ? 'Connected' : 'Setup needed'}
                          </Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>

                {/* + Add Channel CTA */}
                <PressableScale
                  onPress={() => handleOpenChannelSetup()}
                  style={styles.addChannelButton}
                >
                  <Plus size={16} color={theme.colors.ink} style={{ marginRight: 6 }} />
                  <Text style={styles.addChannelText}>+ Add channel</Text>
                </PressableScale>
              </Card>
            </Stagger>
          </ScrollView>
        )}
      </ScreenEntrance>

      {/* Range Selection Bottom Sheet */}
      <BottomSheet
        visible={rangeSheetVisible}
        onClose={() => setRangeSheetVisible(false)}
        title="Select Period"
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
    paddingBottom: 40,
    gap: theme.spacing.cardGap,
  },
  errorContainer: {
    flex: 1,
    padding: theme.spacing.screen,
    justifyContent: 'center',
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
  },
  periodPillText: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 1. Top Card
  topCard: {
    backgroundColor: '#FFEEDF',
    borderColor: '#F9DEC8',
    borderWidth: 1,
    borderRadius: theme.radii.card,
    padding: 18,
  },
  topCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topCardLabel: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '600',
    color: theme.colors.text2,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.badge,
  },
  deltaText: {
    fontSize: 11,
    fontFamily: theme.typography.badge.fontFamily,
    fontWeight: '700',
  },
  topCardValue: {
    fontSize: 34,
    fontFamily: theme.typography.kpi.fontFamily,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.colors.ink,
    marginTop: 8,
  },

  // 2. Sections
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: theme.typography.sectionTitle.fontSize,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  totalBadge: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
    paddingVertical: 12,
    textAlign: 'center',
  },

  // Source Row
  sourceList: {
    gap: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceName: {
    width: 95,
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  barContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  sourceCount: {
    width: 28,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },

  // Channels
  channelsList: {
    gap: 12,
    marginBottom: 16,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  channelIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  channelIconText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: theme.typography.sectionTitle.fontFamily,
  },
  channelName: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
  },

  // Add Channel Button
  addChannelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    paddingVertical: 12,
    marginTop: 4,
    backgroundColor: '#FAFAF8',
  },
  addChannelText: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },

  // Bottom Sheet
  sheetContent: {
    paddingBottom: 24,
    gap: 8,
  },
  rangeOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radii.input,
    backgroundColor: theme.colors.bg,
  },
  rangeOptionSelected: {
    backgroundColor: theme.colors.ink,
  },
  rangeOptionText: {
    fontSize: 14,
    fontFamily: theme.typography.body.fontFamily,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  rangeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
