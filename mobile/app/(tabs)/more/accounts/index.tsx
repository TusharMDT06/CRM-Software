import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Building2,
  TrendingUp,
  MapPin,
  Globe,
  Briefcase,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';

import { theme } from '../../../../src/theme';
import { AppBar } from '../../../../src/components/AppBar';
import { Card } from '../../../../src/components/Card';
import { SearchInput } from '../../../../src/components/SearchInput';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { BottomSheet } from '../../../../src/components/BottomSheet';
import { showToast } from '../../../../src/components/Toast';
import { PressableScale } from '../../../../src/animations/PressableScale';
import { Skeleton } from '../../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../../src/animations/ScreenEntrance';
import { fetchAccounts, createAccount } from '../../../../src/api/accounts';
import { fetchDeals } from '../../../../src/api/deals';
import { queryKeys } from '../../../../src/api/queryKeys';
import { useIsRowHighlighted } from '../../../../src/realtime/highlightStore';
import { Account, AccountInput } from '@flowdesk/shared';

// Deterministic pastel tints for letter tile
const TILE_COLORS = [
  { bg: theme.colors.blueTint, text: theme.colors.blueText },
  { bg: theme.colors.purpleTint, text: theme.colors.purpleText },
  { bg: theme.colors.orangeTint, text: theme.colors.orangeText },
  { bg: theme.colors.greenTint, text: theme.colors.greenText },
  { bg: '#E0F2FE', text: '#0284C7' },
  { bg: '#F3E8FF', text: '#7E22CE' },
];

function getLetterTileStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TILE_COLORS.length;
  return TILE_COLORS[index];
}

function AccountRowItem({
  account,
  dealsCount,
  lifetimeValue,
  onPress,
}: {
  account: Account;
  dealsCount: number;
  lifetimeValue: number;
  onPress: () => void;
}) {
  const isHighlighted = useIsRowHighlighted(account._id);
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

  const letter = (account.name || 'A').trim().charAt(0).toUpperCase();
  const tileStyle = getLetterTileStyle(account.name);
  const subtitle = [account.industry, account.city].filter(Boolean).join(' · ');

  return (
    <PressableScale onPress={onPress}>
      <Animated.View style={[styles.accountRow, animatedHighlightStyle]}>
        {/* Letter Tile */}
        <View style={[styles.letterTile, { backgroundColor: tileStyle.bg }]}>
          <Text style={[styles.letterTileText, { color: tileStyle.text }]}>
            {letter}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.accountCenter}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.name}
          </Text>
          {subtitle ? (
            <Text style={styles.accountSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right: Revenue & Deals Count */}
        <View style={styles.accountRight}>
          <Text style={styles.accountRevenue}>
            {lifetimeValue > 0 ? theme.helpers.formatCompactINR(lifetimeValue) : '₹0'}
          </Text>
          <Text style={styles.accountDealsCount}>
            {dealsCount} {dealsCount === 1 ? 'deal' : 'deals'}
          </Text>
        </View>
      </Animated.View>
    </PressableScale>
  );
}

function AccountsSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.statRow}>
        <Skeleton width="48%" height={85} style={{ borderRadius: theme.radii.card }} />
        <Skeleton width="48%" height={85} style={{ borderRadius: theme.radii.card }} />
      </View>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={44} height={44} style={{ borderRadius: 14, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="55%" height={16} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="35%" height={12} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={60} height={26} style={{ borderRadius: 6 }} />
        </View>
      ))}
    </View>
  );
}

export default function AccountsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createSheetVisible, setCreateSheetVisible] = useState(false);

  // Form fields
  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // 1. Fetch Accounts
  const {
    data: accountsData,
    isLoading: accountsLoading,
    isError: accountsError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.accounts.list({ search, limit: 100 }),
    queryFn: () => fetchAccounts({ search, limit: 100 }),
  });

  // 2. Fetch Deals to calculate lifetime values per account
  const { data: dealsData } = useQuery({
    queryKey: queryKeys.deals.list({ limit: 200 }),
    queryFn: () => fetchDeals({ limit: 200 }),
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData]);
  const deals = useMemo(() => dealsData?.data || [], [dealsData]);

  // Aggregate deals per account
  const accountStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number }>();
    deals.forEach((d) => {
      const acctId = typeof d.account === 'object' && d.account ? (d.account as any)._id : d.account;
      if (acctId) {
        const idStr = String(acctId);
        const curr = map.get(idStr) || { count: 0, totalAmount: 0 };
        curr.count += 1;
        curr.totalAmount += d.amount || 0;
        map.set(idStr, curr);
      }
    });
    return map;
  }, [deals]);

  // Total Lifetime Value across all accounts
  const totalLifetimeValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [deals]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: AccountInput) => createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      setCreateSheetVisible(false);
      setNewName('');
      setNewIndustry('');
      setNewCity('');
      setNewWebsite('');
      setNewPhone('');
      showToast('Account created successfully', { type: 'success' });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to create account', { type: 'error' });
    },
  });

  const handleCreate = () => {
    if (!newName.trim()) {
      showToast('Please enter an account name', { type: 'error' });
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      industry: newIndustry.trim() || 'General',
      city: newCity.trim() || '',
      website: newWebsite.trim() || '',
      phone: newPhone.trim() || '',
      employees: 1,
      custom: {},
    });
  };

  return (
    <View style={styles.container}>
      {/* Blue App Bar */}
      <AppBar
        title="Accounts"
        backgroundColor={theme.colors.appBar.accounts}
        showBack
        rightAction={
          <PressableScale
            onPress={() => setCreateSheetVisible(true)}
            style={styles.addBtn}
            accessibilityLabel="Create account"
          >
            <Plus size={18} color={theme.colors.appBar.accounts} />
          </PressableScale>
        }
      />

      <ScreenEntrance style={styles.content}>
        {accountsLoading ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <AccountsSkeleton />
          </ScrollView>
        ) : accountsError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load accounts"
              message={(error as Error)?.message || 'Please check your connection.'}
              onRetry={() => refetch()}
            />
          </View>
        ) : (
          <View style={styles.listWrapper}>
            {/* 1. Stat Tiles matching image copy 8.png */}
            <View style={styles.statRow}>
              {/* Total accounts */}
              <View style={[styles.statTile, { backgroundColor: theme.colors.blueTint }]}>
                <Text style={styles.statTitle}>Total accounts</Text>
                <Text style={styles.statValue}>{accounts.length}</Text>
              </View>

              {/* Lifetime value */}
              <View style={[styles.statTile, { backgroundColor: theme.colors.greenTint }]}>
                <Text style={styles.statTitle}>Lifetime value</Text>
                <Text style={styles.statValue}>
                  {theme.helpers.formatCompactINR(totalLifetimeValue)}
                </Text>
              </View>
            </View>

            {/* 2. Search Bar */}
            <View style={styles.searchWrapper}>
              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search accounts..."
              />
            </View>

            {/* 3. FlashList of Accounts */}
            {accounts.length === 0 ? (
              <EmptyState
                title={search ? 'No accounts match' : 'No accounts yet'}
                description={
                  search
                    ? 'Try searching with another company name or industry.'
                    : 'Create your first B2B company account using the + button.'
                }
              />
            ) : (
              <FlashList
                data={accounts}
                keyExtractor={(item) => item._id}
                estimatedItemSize={76}
                contentContainerStyle={styles.flashListContent}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={() => refetch()}
                    tintColor={theme.colors.blue}
                  />
                }
                renderItem={({ item }) => {
                  const stats = accountStatsMap.get(item._id) || { count: 0, totalAmount: 0 };
                  return (
                    <AccountRowItem
                      account={item}
                      dealsCount={stats.count}
                      lifetimeValue={stats.totalAmount}
                      onPress={() => router.push(`/(tabs)/more/accounts/${item._id}`)}
                    />
                  );
                }}
              />
            )}
          </View>
        )}
      </ScreenEntrance>

      {/* Create Account Sheet */}
      <BottomSheet
        visible={createSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
        title="Add New Account"
      >
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.inputLabel}>Company Name *</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Acme Corporation"
            placeholderTextColor={theme.colors.muted}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>Industry</Text>
          <TextInput
            value={newIndustry}
            onChangeText={setNewIndustry}
            placeholder="e.g. Logistics, Fintech, Retail"
            placeholderTextColor={theme.colors.muted}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            value={newCity}
            onChangeText={setNewCity}
            placeholder="e.g. Bengaluru, Mumbai, Delhi"
            placeholderTextColor={theme.colors.muted}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>Website</Text>
          <TextInput
            value={newWebsite}
            onChangeText={setNewWebsite}
            placeholder="https://acme.com"
            placeholderTextColor={theme.colors.muted}
            keyboardType="url"
            autoCapitalize="none"
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="+91 98765 43210"
            placeholderTextColor={theme.colors.muted}
            keyboardType="phone-pad"
            style={styles.textInput}
          />

          <PressableScale
            onPress={handleCreate}
            style={styles.saveBtn}
            accessibilityLabel="Create Account"
          >
            <Text style={styles.saveBtnText}>Save Account</Text>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 12,
  },
  scrollContent: {
    padding: theme.spacing.screen,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  statTile: {
    flex: 1,
    padding: 16,
    borderRadius: theme.radii.card,
  },
  statTitle: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  searchWrapper: {
    marginBottom: 12,
  },
  flashListContent: {
    paddingBottom: 90,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.listRow,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  letterTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  letterTileText: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
  },
  accountCenter: {
    flex: 1,
    marginRight: 8,
  },
  accountName: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 3,
  },
  accountSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountRevenue: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 2,
  },
  accountDealsCount: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  skeletonContainer: {
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.listRow,
    padding: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.ink,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  saveBtn: {
    backgroundColor: theme.colors.blue,
    borderRadius: theme.radii.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
});
