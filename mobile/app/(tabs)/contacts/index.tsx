import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Linking,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, Phone, ChevronRight, User } from 'lucide-react-native';
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
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { PressableScale } from '../../../src/animations/PressableScale';
import { SegmentedChips } from '../../../src/animations/SegmentedChips';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { useCan } from '../../../src/auth/useCan';
import { fetchContacts } from '../../../src/api/contacts';
import { queryKeys } from '../../../src/api/queryKeys';
import { useIsRowHighlighted } from '../../../src/realtime/highlightStore';
import { Contact } from '@flowdesk/shared';

function ContactItemRow({
  contact,
  onPress,
}: {
  contact: Contact;
  onPress: () => void;
}) {
  const isHighlighted = useIsRowHighlighted(contact._id);
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

  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  const accountName =
    typeof contact.account === 'object' && contact.account
      ? contact.account.name
      : '';
  const roleSubtitle = [contact.jobTitle, accountName].filter(Boolean).join(' · ');

  const hasPhone = Boolean(contact.phone && contact.phone.trim().length > 0);

  return (
    <PressableScale onPress={onPress} accessibilityRole="none">
      <Animated.View style={[styles.contactRow, animatedHighlightStyle]}>
        <Avatar name={fullName} size={42} />

        <View style={styles.contactCenter}>
          <Text style={styles.contactName} numberOfLines={1}>
            {fullName}
          </Text>

          {roleSubtitle ? (
            <Text style={styles.contactSubtitle} numberOfLines={1}>
              {roleSubtitle}
            </Text>
          ) : null}

          <Text style={styles.contactEmail} numberOfLines={1}>
            {contact.email}
          </Text>
        </View>

        <View style={styles.contactActions}>
          <PressableScale
            onPress={(e) => {
              e?.stopPropagation?.();
              if (hasPhone) Linking.openURL(`tel:${contact.phone}`);
            }}
            disabled={!hasPhone}
            style={[
              styles.callBtn,
              hasPhone ? styles.callBtnActive : styles.callBtnDisabled,
            ]}
            accessibilityLabel={hasPhone ? `Call ${fullName}` : 'No phone number available'}
            accessibilityRole="button"
          >
            <Phone
              size={18}
              color={hasPhone ? theme.colors.green : theme.colors.disabled}
              strokeWidth={1.8}
            />
          </PressableScale>
        </View>
      </Animated.View>
    </PressableScale>
  );
}

function ContactsSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={42} height={42} style={{ borderRadius: 21 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="45%" height={16} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="60%" height={12} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="35%" height={10} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={36} height={36} style={{ borderRadius: 18 }} />
        </View>
      ))}
    </View>
  );
}

export default function ContactsScreen() {
  const router = useRouter();
  const canCreate = useCan('contact:create');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterChip, setFilterChip] = useState<'all' | 'customers' | 'prospects' | 'partners'>('all');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.contacts.list({ search: debouncedSearch, limit: 100 }),
    queryFn: () => fetchContacts({ search: debouncedSearch || undefined, limit: 100 }),
  });

  const allContacts = useMemo(() => data?.data || [], [data]);

  // Client-side category categorization based on jobTitle/account
  const filteredContacts = useMemo(() => {
    if (filterChip === 'all') return allContacts;
    return allContacts.filter((c) => {
      const title = (c.jobTitle || '').toLowerCase();
      if (filterChip === 'customers') return !title.includes('partner') && !title.includes('lead');
      if (filterChip === 'partners') return title.includes('partner') || title.includes('vendor');
      if (filterChip === 'prospects') return title.includes('prospect') || title.includes('lead') || title.includes('founder');
      return true;
    });
  }, [allContacts, filterChip]);

  const chips = [
    { key: 'all', label: 'All', count: allContacts.length },
    { key: 'customers', label: 'Customers' },
    { key: 'prospects', label: 'Prospects' },
    { key: 'partners', label: 'Partners' },
  ];

  return (
    <View style={styles.container}>
      <AppBar
        title="Contacts"
        backgroundColor={theme.colors.appBar.contacts}
        rightAction={
          canCreate ? (
            <PressableScale
              onPress={() => router.push('/(tabs)/contacts/new')}
              accessibilityLabel="Create Contact"
              style={styles.addBtn}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
            </PressableScale>
          ) : null
        }
      />

      <ScreenEntrance style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts by name, email, role..."
          />
        </View>

        {/* Chips (All / Customers / Prospects / Partners) */}
        <View style={styles.chipsWrapper}>
          <SegmentedChips
            chips={chips}
            selected={filterChip}
            onSelect={(k) => setFilterChip(k as any)}
          />
        </View>

        {/* Main List */}
        {isLoading ? (
          <ContactsSkeleton />
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Unable to load contacts"
              message={(error as Error)?.message || 'Please check your connection.'}
              onRetry={() => refetch()}
            />
          </View>
        ) : filteredContacts.length === 0 ? (
          <EmptyState
            title="No contacts found"
            description={
              search
                ? 'Try searching with a different name or email.'
                : 'Create contacts to link with accounts and deals.'
            }
            actionLabel={canCreate ? 'Create Contact' : undefined}
            onAction={canCreate ? () => router.push('/(tabs)/contacts/new') : undefined}
          />
        ) : (
          <FlashList
            data={filteredContacts}
            keyExtractor={(item) => item._id}
            estimatedItemSize={76}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <ContactItemRow
                contact={item}
                onPress={() => router.push(`/(tabs)/contacts/${item._id}`)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => refetch()}
                tintColor={theme.colors.orange}
              />
            }
          />
        )}
      </ScreenEntrance>
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
  searchWrapper: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 12,
  },
  chipsWrapper: {
    paddingHorizontal: theme.spacing.screen,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: 90,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.radii.listRow,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.listRowGap,
  },
  contactCenter: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: theme.typography.rowTitle.fontSize,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: theme.typography.rowTitle.fontWeight,
    color: theme.colors.ink,
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginBottom: 2,
  },
  contactEmail: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnActive: {
    backgroundColor: theme.colors.greenTint,
  },
  callBtnDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
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
});
