import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Phone,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Briefcase,
  Users,
  Building2,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react-native';

import { theme } from '../../src/theme';
import { AppBar } from '../../src/components/AppBar';
import { Card } from '../../src/components/Card';
import { Avatar } from '../../src/components/Avatar';
import { KpiCard } from '../../src/components/KpiCard';
import { Badge } from '../../src/components/Badge';
import { ErrorState } from '../../src/components/ErrorState';
import { NotificationModal } from '../../src/components/NotificationModal';
import { ScreenEntrance } from '../../src/animations/ScreenEntrance';
import { Stagger } from '../../src/animations/Stagger';
import { PulsingDot } from '../../src/animations/PulsingDot';
import { PressableScale } from '../../src/animations/PressableScale';
import { SegmentedChips } from '../../src/animations/SegmentedChips';
import { Donut } from '../../src/animations/Donut';
import { Skeleton } from '../../src/animations/Skeleton';
import { SegmentedMeter } from '../../src/components/SegmentedMeter';
import { useSessionStore } from '../../src/auth/sessionStore';
import { fetchDashboardSummary } from '../../src/api/dashboard';
import { fetchUsers } from '../../src/api/users';
import { fetchUnreadCount } from '../../src/api/notifications';
import { queryKeys } from '../../src/api/queryKeys';
import { CricbuzzScrollView } from '../../src/components/CricbuzzPullToRefresh';

const STAGE_COLORS: Record<string, string> = {
  qualified: theme.colors.blue,
  proposal: theme.colors.orange,
  negotiation: theme.colors.purple,
  won: theme.colors.green,
  lost: '#64748B',
};

const STAGE_LABELS: Record<string, string> = {
  qualified: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Closed Won',
  lost: 'Closed Lost',
};

const STAGE_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  qualified: { label: 'QUALIFIED', bg: '#DDF6E8', text: '#15803D' },
  proposal: { label: 'PROPOSAL', bg: '#FDEBDD', text: '#B45309' },
  negotiation: { label: 'PENDING', bg: '#E6EEFF', text: '#3B5BDB' },
  won: { label: 'WON', bg: '#DDF6E8', text: '#15803D' },
  lost: { label: 'LOST', bg: '#FEE2E2', text: '#DC2626' },
};

function formatDealDate(dateStr?: string | Date) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getGreeting(name?: string) {
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = name ? name.split(' ')[0] : 'there';
  return `${timeGreeting}, ${firstName} 👋`;
}

function DashboardSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <Skeleton width="60%" height={26} style={{ marginBottom: 8, borderRadius: 8 }} />
      <Skeleton width="40%" height={16} style={{ marginBottom: 20, borderRadius: 6 }} />

      <Skeleton width={180} height={36} style={{ marginBottom: 20, borderRadius: 18 }} />

      <View style={styles.kpiGrid}>
        <Skeleton width="48%" height={105} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={105} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={105} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={105} style={{ borderRadius: theme.radii.card }} />
      </View>

      <Skeleton width="100%" height={260} style={{ borderRadius: theme.radii.card, marginTop: 16 }} />

      <View style={[styles.healthGrid, { marginTop: 16 }]}>
        <Skeleton width="48%" height={140} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={140} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={140} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={140} style={{ borderRadius: theme.radii.card }} />
      </View>

      <Skeleton width="100%" height={130} style={{ borderRadius: theme.radii.card, marginTop: 16 }} />
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const canSeeTeam = user?.role === 'admin' || user?.role === 'manager';
  const [scope, setScope] = useState<'me' | 'team'>(() =>
    user?.role === 'admin' || user?.role === 'manager' ? 'team' : 'me'
  );
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  // Sync default scope when user switches role (manager/admin defaults to team, sales to me)
  React.useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      setScope('team');
    } else {
      setScope('me');
    }
    setSelectedOwner('');
  }, [user?.role]);

  const { data: usersList } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: fetchUsers,
    enabled: canSeeTeam,
  });

  const teamMembers = React.useMemo(() => {
    if (!usersList) return [];
    return usersList.filter((u) => u.role === 'manager' || u.role === 'sales');
  }, [usersList]);

  const activeOwner = scope === 'team' && selectedOwner ? selectedOwner : undefined;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.dashboard.summary(scope, 'month', activeOwner),
    queryFn: () => fetchDashboardSummary(scope, 'month', activeOwner),
  });

  const { data: unreadData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: fetchUnreadCount,
    refetchInterval: 15000,
  });

  const hasUnread = (unreadData?.unreadCount ?? 0) > 0;

  const chips = canSeeTeam
    ? [
        { key: 'team', label: 'Team' },
        { key: 'me', label: 'My Dashboard' },
      ]
    : [{ key: 'me', label: 'My Dashboard' }];

  const pipelineStages = data?.pipelineByStage || [];
  const totalPipelineDeals = pipelineStages.reduce((sum, s) => sum + s.count, 0);
  const totalPipelineAmount = pipelineStages.reduce((sum, s) => sum + s.amount, 0);

  const donutData = pipelineStages
    .filter((s) => s.count > 0)
    .map((s) => ({
      value: s.count,
      color: STAGE_COLORS[s.stage] || theme.colors.blue,
      label: STAGE_LABELS[s.stage] || s.stage,
    }));

  const upNextTask = data?.upNextTask;

  const totalOutstandingPaise = data?.receivables?.totalOutstandingPaise ?? 0;
  const totalOverduePaise = data?.receivables?.totalOverduePaise ?? 0;
  const overdueCount = data?.receivables?.overdueCount ?? 0;
  const overduePct = data?.receivables?.overduePct ?? (totalOutstandingPaise > 0 ? Math.min(100, Math.round((totalOverduePaise / totalOutstandingPaise) * 100)) : 0);

  return (
    <View style={styles.container}>
      <AppBar
        title="Dashboard"
        backgroundColor={theme.colors.appBar.home}
        rightAction={
          <View style={styles.appBarActions}>
            <PressableScale
              onPress={() => setNotifModalVisible(true)}
              accessibilityLabel="Notifications"
              style={styles.bellWrapper}
            >
              <Bell size={22} color="#FFFFFF" />
              {hasUnread && (
                <View style={styles.dotPosition}>
                  <PulsingDot size={8} color={theme.colors.orange} />
                </View>
              )}
            </PressableScale>

            <PressableScale
              onPress={() => router.push('/(tabs)/more')}
              accessibilityLabel="Account and Settings"
            >
              <Avatar name={user?.name || 'Agent'} size={34} />
            </PressableScale>
          </View>
        }
      />

      <ScreenEntrance style={styles.content}>
        {isLoading ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 90 },
            ]}
          >
            <DashboardSkeleton />
          </ScrollView>
        ) : isError ? (
          <View style={styles.errorWrapper}>
            <ErrorState
              title="Unable to load dashboard"
              message={(error as Error)?.message || 'Please check your connection and try again.'}
              onRetry={() => refetch()}
            />
          </View>
        ) : (
          <CricbuzzScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 90 },
            ]}
            onRefresh={() => refetch()}
            refreshing={isRefetching}
            refreshAll={true}
          >
            {/* 1. Greeting & Follow-up Counter */}
            <View style={styles.welcomeBanner}>
              <Text style={styles.greeting}>{getGreeting(user?.name)}</Text>
              <Text style={styles.subtitle}>
                {data?.taskStats?.open
                  ? `${data.taskStats.open} follow-ups due today`
                  : 'All caught up with today’s follow-ups'}
              </Text>
            </View>

            {/* 2. Scope Chips */}
            {canSeeTeam && (
              <View style={styles.chipsRow}>
                <SegmentedChips
                  chips={chips}
                  selected={scope}
                  onSelect={(k) => {
                    setScope(k as 'me' | 'team');
                    if (k === 'me') setSelectedOwner('');
                  }}
                />
              </View>
            )}

            {/* 2b. Team Member Filter (when viewing Team) */}
            {canSeeTeam && scope === 'team' && teamMembers.length > 0 && (
              <View style={styles.teamFilterContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.teamFilterScroll}
                >
                  <PressableScale
                    onPress={() => setSelectedOwner('')}
                    style={[
                      styles.memberPill,
                      selectedOwner === '' && styles.memberPillActive,
                    ]}
                  >
                    <Users
                      size={13}
                      color={selectedOwner === '' ? '#FFFFFF' : theme.colors.ink}
                    />
                    <Text
                      style={[
                        styles.memberPillText,
                        selectedOwner === '' && styles.memberPillTextActive,
                      ]}
                    >
                      All Team
                    </Text>
                  </PressableScale>

                  {teamMembers.map((member) => {
                    const isSelected = selectedOwner === member._id;
                    const roleLabel = member.role === 'manager' ? 'Manager' : 'Sales';
                    return (
                      <PressableScale
                        key={member._id}
                        onPress={() => setSelectedOwner(member._id)}
                        style={[
                          styles.memberPill,
                          isSelected && styles.memberPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.memberPillText,
                            isSelected && styles.memberPillTextActive,
                          ]}
                        >
                          {member.name}
                        </Text>
                        <Text
                          style={[
                            styles.memberRoleBadge,
                            isSelected && styles.memberRoleBadgeActive,
                          ]}
                        >
                          {roleLabel}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3. 4 KPI Cards (count-up + % change aligned with Web Dashboard) */}
            <View style={styles.kpiGrid}>
              <Stagger index={0} style={styles.kpiCol}>
                <KpiCard
                  title="Revenue"
                  value={data?.revenue?.value ?? 0}
                  isCurrency
                  delta={data?.revenue?.changePercent}
                  deltaPeriod="vs last month"
                  accentColor={theme.colors.green}
                  backgroundColor={theme.colors.greenTint}
                />
              </Stagger>
              <Stagger index={1} style={styles.kpiCol}>
                <KpiCard
                  title="Pipeline Value"
                  value={data?.pipelineValue ?? 0}
                  isCurrency
                  badgeText={`${data?.openDealCount ?? 0} active deals`}
                  badgeBgColor="#E6EEFF"
                  badgeTextColor="#3B5BDB"
                  accentColor={theme.colors.purple}
                  backgroundColor={theme.colors.purpleTint}
                />
              </Stagger>
              <Stagger index={2} style={styles.kpiCol}>
                <KpiCard
                  title="Deals Won"
                  value={data?.dealsWon ?? 0}
                  badgeText={`${data?.winRate ?? 0}% win rate`}
                  badgeBgColor="#DDF6E8"
                  badgeTextColor="#15803D"
                  accentColor={theme.colors.orange}
                  backgroundColor={theme.colors.orangeTint}
                />
              </Stagger>
              <Stagger index={3} style={styles.kpiCol}>
                <KpiCard
                  title="New Leads"
                  value={data?.newLeads ?? 0}
                  badgeText="waiting for first call"
                  badgeBgColor="#FDEBDD"
                  badgeTextColor="#B45309"
                  accentColor={theme.colors.blue}
                  backgroundColor={theme.colors.blueTint}
                />
              </Stagger>
            </View>

            {/* 4. Sales Pipeline Donut + Legend */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Sales Pipeline</Text>
                  <Text style={styles.cardSubtitle}>
                    {data?.openDealCount ?? 0} active deals · {theme.helpers.formatINR(data?.pipelineValue ?? totalPipelineAmount)}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => router.push('/(tabs)/deals')}
                  style={styles.cardActionBtn}
                >
                  <Text style={styles.cardActionText}>See all</Text>
                  <ChevronRight size={14} color={theme.colors.blue} />
                </PressableScale>
              </View>

              {donutData.length === 0 ? (
                <View style={styles.emptyDonut}>
                  <Briefcase size={36} color={theme.colors.muted} />
                  <Text style={styles.emptyDonutText}>No deals in pipeline yet</Text>
                </View>
              ) : (
                <View style={styles.pipelineContent}>
                  <View style={styles.donutWrapper}>
                    <Donut
                      data={donutData}
                      size={170}
                      strokeWidth={22}
                      centerLabel={String(data?.openDealCount ?? 0)}
                      centerSubLabel="Deals"
                    />
                  </View>

                  <View style={styles.stageLegendList}>
                    {pipelineStages.map((stageItem) => {
                      const color = STAGE_COLORS[stageItem.stage] || theme.colors.blue;
                      return (
                        <View key={stageItem.stage} style={styles.stageRow}>
                          <View style={styles.stageLabelGroup}>
                            <View style={[styles.stageDot, { backgroundColor: color }]} />
                            <Text style={styles.stageName}>
                              {STAGE_LABELS[stageItem.stage] || stageItem.stage}
                            </Text>
                          </View>

                          <View style={styles.stageMetrics}>
                            <Text style={styles.stageCount}>{stageItem.count} deals</Text>
                            <Text style={styles.stageAmount}>
                              {theme.helpers.formatCompactINR(stageItem.amount)}
                            </Text>
                            <View style={styles.stagePctBadge}>
                              <Text style={styles.stagePctText}>
                                {stageItem.percentage}%
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </Card>

            {/* 4b. Health & Financial Cards Grid (Pipeline Health, Deals at Risk, Tasks Status, Receivables) */}
            <View style={styles.healthGrid}>
              {/* Card 1: Pipeline Health */}
              <PressableScale
                style={styles.healthCol}
                onPress={() => router.push('/(tabs)/deals')}
                accessibilityLabel="Pipeline health"
              >
                <Card style={styles.healthCard}>
                  <View style={styles.healthCardHeader}>
                    <View style={styles.healthTitleContainer}>
                      <Text style={styles.healthTitle} numberOfLines={1}>Pipeline health</Text>
                      <Text style={styles.healthSubtitle} numberOfLines={1}>On-track open opportunities</Text>
                    </View>
                    <ArrowUpRight size={14} color={theme.colors.muted} />
                  </View>

                  <Text style={styles.healthMetric}>
                    {data?.pipelineHealth ?? 100}%
                  </Text>

                  <SegmentedMeter
                    percentage={data?.pipelineHealth ?? 100}
                    color="green"
                    totalSegments={18}
                    height={16}
                    style={styles.healthMeter}
                  />

                  <View style={styles.healthFooter}>
                    <Text style={styles.healthFooterText} numberOfLines={1}>
                      {data?.openDealCount ?? 0} active deals
                    </Text>
                    <Text style={styles.healthFooterText} numberOfLines={1}>
                      {data?.dealsAtRisk?.count ?? 0} flagged
                    </Text>
                  </View>
                </Card>
              </PressableScale>

              {/* Card 2: Deals at Risk */}
              <PressableScale
                style={styles.healthCol}
                onPress={() => router.push('/(tabs)/deals')}
                accessibilityLabel="Deals at risk"
              >
                <Card style={styles.healthCard}>
                  <View style={styles.healthCardHeader}>
                    <View style={styles.healthTitleContainer}>
                      <Text style={styles.healthTitle} numberOfLines={1}>Deals at risk</Text>
                      <Text style={styles.healthSubtitle} numberOfLines={1}>Overdue expected close</Text>
                    </View>
                    <ArrowUpRight size={14} color={theme.colors.muted} />
                  </View>

                  <Text style={styles.healthMetric}>
                    {data?.dealsAtRisk?.percentage ?? 0}%
                  </Text>

                  <SegmentedMeter
                    percentage={data?.dealsAtRisk?.percentage ?? 0}
                    color="orange"
                    totalSegments={18}
                    height={16}
                    style={styles.healthMeter}
                  />

                  <View style={styles.healthFooter}>
                    <Text style={styles.healthFooterText} numberOfLines={1}>
                      {data?.dealsAtRisk?.count ?? 0} deals need review
                    </Text>
                    <Text style={styles.healthFooterText} numberOfLines={1}>
                      {theme.helpers.formatCompactINR(data?.dealsAtRisk?.amount ?? 0)} at risk
                    </Text>
                  </View>
                </Card>
              </PressableScale>

              {/* Card 3: Tasks Status */}
              <PressableScale
                style={styles.healthCol}
                onPress={() => router.push('/(tabs)/more/tasks')}
                accessibilityLabel="Tasks status"
              >
                <Card style={styles.healthCard}>
                  <View style={styles.healthCardHeader}>
                    <View style={styles.healthTitleContainer}>
                      <Text style={styles.healthTitle} numberOfLines={1}>Tasks status</Text>
                      <Text style={styles.healthSubtitle} numberOfLines={1}>Action completion rate</Text>
                    </View>
                    <ArrowUpRight size={14} color={theme.colors.muted} />
                  </View>

                  <Text style={styles.healthMetric}>
                    {data?.taskStats?.doneRate ?? 0}%
                  </Text>

                  <SegmentedMeter
                    percentage={data?.taskStats?.doneRate ?? 0}
                    color="blue"
                    totalSegments={18}
                    height={16}
                    style={styles.healthMeter}
                  />

                  <View style={styles.healthFooter}>
                    <Text style={styles.healthFooterText} numberOfLines={1}>
                      {data?.taskStats?.open ?? 0} open
                    </Text>
                    <Text
                      style={[
                        styles.healthFooterText,
                        (data?.taskStats?.overdue ?? 0) > 0 && styles.healthFooterAlert,
                      ]}
                      numberOfLines={1}
                    >
                      {data?.taskStats?.overdue ?? 0} overdue
                    </Text>
                  </View>
                </Card>
              </PressableScale>

              {/* Card 4: Receivables */}
              <PressableScale
                style={styles.healthCol}
                onPress={() => router.push('/(tabs)/deals')}
                accessibilityLabel="Receivables"
              >
                <Card style={styles.healthCard}>
                  <View style={styles.healthCardHeader}>
                    <View style={styles.healthTitleContainer}>
                      <Text style={styles.healthTitle} numberOfLines={1}>Receivables</Text>
                      <Text style={styles.healthSubtitle} numberOfLines={1}>Outstanding receivables</Text>
                    </View>
                    <ArrowUpRight size={14} color={theme.colors.muted} />
                  </View>

                  <Text style={styles.healthMetric}>
                    {theme.helpers.formatCompactINR(totalOutstandingPaise / 100)}
                  </Text>

                  <SegmentedMeter
                    percentage={overduePct}
                    color={overduePct > 0 ? 'orange' : 'green'}
                    totalSegments={18}
                    height={16}
                    style={styles.healthMeter}
                  />

                  <View style={styles.healthFooter}>
                    <Text
                      style={[
                        styles.healthFooterText,
                        overdueCount > 0 && styles.healthFooterAlert,
                      ]}
                      numberOfLines={1}
                    >
                      {overdueCount} overdue
                    </Text>
                    <Text
                      style={[
                        styles.healthFooterText,
                        totalOverduePaise > 0 && styles.healthFooterAlert,
                      ]}
                      numberOfLines={1}
                    >
                      {theme.helpers.formatCompactINR(totalOverduePaise / 100)} overdue
                    </Text>
                  </View>
                </Card>
              </PressableScale>
            </View>

            {/* 4c. Active Deals Section (Key ongoing client transactions matching Web) */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Active deals</Text>
                  <Text style={styles.cardSubtitle}>Key ongoing client transactions</Text>
                </View>
                <PressableScale
                  onPress={() => router.push('/(tabs)/deals')}
                  style={styles.cardActionBtn}
                  accessibilityLabel="View all active deals"
                >
                  <Text style={styles.cardActionText}>View all</Text>
                  <ChevronRight size={14} color={theme.colors.blue} />
                </PressableScale>
              </View>

              {(!data?.recentDeals || data.recentDeals.length === 0) ? (
                <View style={styles.emptyRecentDeals}>
                  <Briefcase size={32} color={theme.colors.muted} />
                  <Text style={styles.emptyRecentDealsText}>No active deals right now</Text>
                </View>
              ) : (
                <View style={styles.activeDealsList}>
                  {data.recentDeals.map((deal: any, index: number) => {
                    const accountName =
                      typeof deal.account === 'object' && deal.account?.name
                        ? deal.account.name
                        : (typeof deal.account === 'string' && deal.account ? deal.account : 'General Account');
                    const badge = STAGE_BADGE_CONFIG[deal.stage] || {
                      label: (deal.stage || 'ACTIVE').toUpperCase(),
                      bg: '#E2E8F0',
                      text: '#475569',
                    };
                    const formattedDate = formatDealDate(deal.expectedClose || deal.expectedCloseDate);
                    const isOverdue =
                      deal.stage !== 'won' &&
                      deal.stage !== 'lost' &&
                      (deal.expectedClose || deal.expectedCloseDate) &&
                      new Date(deal.expectedClose || deal.expectedCloseDate) < new Date();

                    return (
                      <PressableScale
                        key={deal._id || index}
                        onPress={() => router.push(`/(tabs)/deals/${deal._id}`)}
                        style={[
                          styles.activeDealItem,
                          index === 0 && styles.activeDealItemFirst,
                        ]}
                      >
                        <View style={styles.activeDealHeaderRow}>
                          <View style={styles.activeDealAccountRow}>
                            <Building2 size={13} color={theme.colors.text2} style={{ marginRight: 5 }} />
                            <Text style={styles.activeDealAccountText} numberOfLines={1}>
                              {accountName}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.activeDealTitle} numberOfLines={1}>
                          {deal.title}
                        </Text>

                        <View style={styles.activeDealFooterRow}>
                          <View style={styles.activeDealDateRow}>
                            <Calendar
                              size={12}
                              color={isOverdue ? '#DC2626' : theme.colors.muted}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.activeDealDateText,
                                isOverdue && styles.activeDealDateOverdue,
                              ]}
                            >
                              {formattedDate}
                            </Text>
                          </View>
                          <Text style={styles.activeDealAmount}>
                            {theme.helpers.formatINR(deal.amount)}
                          </Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              )}
            </Card>

            {/* 5. Up-next Task Card */}
            {upNextTask ? (
              <PressableScale
                onPress={() => {
                  if (upNextTask.contactPhone) {
                    Linking.openURL(`tel:${upNextTask.contactPhone}`);
                  } else {
                    router.push('/(tabs)/more/tasks');
                  }
                }}
              >
                <Card style={styles.upNextCardCompact}>
                  <View style={styles.upNextRow}>
                    <View style={styles.upNextCircle}>
                      <Phone size={18} color={theme.colors.green} />
                    </View>
                    <View style={styles.upNextTextCol}>
                      <Text style={styles.upNextTaskTitle} numberOfLines={1}>
                        {upNextTask.title}
                      </Text>
                      <Text style={styles.upNextTaskSub} numberOfLines={1}>
                        {[upNextTask.deal?.title, theme.helpers.relativeTime(upNextTask.dueDate)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.upNextTag}>
                      <Text style={styles.upNextTagText}>Up next</Text>
                    </View>
                  </View>
                </Card>
              </PressableScale>
            ) : (
              <Card style={styles.sectionCard}>
                <View style={styles.noTasksContainer}>
                  <CheckCircle2 size={32} color={theme.colors.green} />
                  <Text style={styles.noTasksTitle}>No tasks waiting</Text>
                  <Text style={styles.noTasksDesc}>
                    You’re all caught up on follow-ups and customer activities!
                  </Text>
                </View>
              </Card>
            )}
          </CricbuzzScrollView>
        )}
      </ScreenEntrance>

      {/* Realtime Notifications Bottom Sheet / Modal */}
      <NotificationModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
      />
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
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellWrapper: {
    position: 'relative',
    padding: 4,
  },
  dotPosition: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  scrollContent: {
    padding: theme.spacing.screen,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  errorWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },
  welcomeBanner: {
    marginBottom: 16,
    paddingTop: 4,
  },
  greeting: {
    fontSize: theme.typography.screenTitle.fontSize,
    fontFamily: theme.typography.screenTitle.fontFamily,
    fontWeight: theme.typography.screenTitle.fontWeight,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: theme.typography.body.fontSize,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.text2,
    marginTop: 4,
  },
  chipsRow: {
    marginBottom: 12,
  },
  teamFilterContainer: {
    marginBottom: 16,
  },
  teamFilterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  memberPillActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  memberPillText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
  },
  memberPillTextActive: {
    color: '#FFFFFF',
  },
  memberRoleBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    color: theme.colors.muted,
  },
  memberRoleBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCol: {
    width: '48%',
    flexGrow: 1,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: theme.typography.sectionTitle.fontSize,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: theme.typography.sectionTitle.fontWeight,
    color: theme.colors.ink,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginTop: 2,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cardActionText: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.blue,
    marginRight: 2,
  },
  pipelineContent: {
    alignItems: 'center',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyDonut: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDonutText: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginTop: 8,
  },
  stageLegendList: {
    width: '100%',
    marginTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 12,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  stageLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stageName: {
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  stageMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageCount: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  stageAmount: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  stagePctBadge: {
    backgroundColor: theme.colors.bg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stagePctText: {
    fontSize: 11,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.text2,
  },
  upNextBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upNextIconPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 160, 107, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upNextContent: {
    paddingTop: 4,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskDueDate: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.orange,
  },
  taskRelated: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  taskActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radii.input,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  openTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  openTaskText: {
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    color: theme.colors.ink,
    marginRight: 4,
  },
  noTasksContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTasksTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 8,
  },
  noTasksDesc: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 240,
  },
  upNextCardCompact: {
    borderRadius: theme.radii.card,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upNextCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.greenTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upNextTextCol: {
    flex: 1,
  },
  upNextTaskTitle: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
    marginBottom: 2,
  },
  upNextTaskSub: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  upNextTag: {
    paddingLeft: 8,
  },
  upNextTagText: {
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
    color: theme.colors.blue,
  },
  emptyRecentDeals: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentDealsText: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginTop: 8,
  },
  activeDealsList: {
    gap: 10,
    marginTop: 4,
  },
  activeDealItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.radii.input,
    padding: 12,
  },
  activeDealItemFirst: {
    marginTop: 2,
  },
  activeDealHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  activeDealAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  activeDealAccountText: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
    color: theme.colors.text2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  activeDealTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
    marginBottom: 8,
  },
  activeDealFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  activeDealDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDealDateText: {
    fontSize: 11,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  activeDealDateOverdue: {
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  activeDealAmount: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  healthCol: {
    width: '48%',
    flexGrow: 1,
  },
  healthCard: {
    padding: 13,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    justifyContent: 'space-between',
    minHeight: 142,
  },
  healthCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  healthTitleContainer: {
    flex: 1,
    marginRight: 4,
  },
  healthTitle: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
  },
  healthSubtitle: {
    fontSize: 10,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    marginTop: 1,
  },
  healthMetric: {
    fontSize: 22,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
    color: theme.colors.ink,
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  healthMeter: {
    marginVertical: 6,
  },
  healthFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 2,
    gap: 4,
  },
  healthFooterText: {
    fontSize: 10.5,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  healthFooterAlert: {
    color: '#DC2626',
    fontWeight: '600' as const,
  },
});
