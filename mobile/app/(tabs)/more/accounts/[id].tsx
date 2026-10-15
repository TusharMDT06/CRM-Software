import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Phone,
  Globe,
  MapPin,
  Users,
  Briefcase,
  Edit2,
  Trash2,
  Plus,
  ArrowLeft,
  AlertCircle,
  Clock,
  Send,
} from 'lucide-react-native';

import { theme } from '../../../../src/theme';
import { AppBar } from '../../../../src/components/AppBar';
import { Card } from '../../../../src/components/Card';
import { Badge } from '../../../../src/components/Badge';
import { Avatar } from '../../../../src/components/Avatar';
import { BottomSheet } from '../../../../src/components/BottomSheet';
import { showToast } from '../../../../src/components/Toast';
import { PressableScale } from '../../../../src/animations/PressableScale';
import { Skeleton } from '../../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../../src/animations/ScreenEntrance';
import {
  fetchAccountById,
  updateAccount,
  deleteAccount,
} from '../../../../src/api/accounts';
import { enqueueOfflineMutation } from '../../../../src/offline/mutationQueue';
import { fetchContacts } from '../../../../src/api/contacts';
import { fetchDeals } from '../../../../src/api/deals';
import { fetchActivities, createActivity } from '../../../../src/api/activities';
import { queryKeys } from '../../../../src/api/queryKeys';
import { Account, Contact, Deal } from '@flowdesk/shared';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // 1. Fetch Account
  const {
    data: account,
    isLoading: accountLoading,
    isError: accountError,
    error,
  } = useQuery({
    queryKey: queryKeys.accounts.detail(id),
    queryFn: () => fetchAccountById(id),
    enabled: Boolean(id),
    retry: 1,
  });

  // 2. Fetch Contacts for Account
  const { data: contactsData } = useQuery({
    queryKey: queryKeys.contacts.list({ limit: 100 }),
    queryFn: () => fetchContacts({ limit: 100 }),
    enabled: Boolean(id && account),
  });

  const accountContacts = React.useMemo(() => {
    if (!contactsData?.data) return [];
    return contactsData.data.filter((c: Contact) => {
      const acctId = typeof c.account === 'object' && c.account ? (c.account as any)._id : c.account;
      return String(acctId) === String(id);
    });
  }, [contactsData, id]);

  // 3. Fetch Deals for Account
  const { data: dealsData } = useQuery({
    queryKey: queryKeys.deals.list({ limit: 100 }),
    queryFn: () => fetchDeals({ limit: 100 }),
    enabled: Boolean(id && account),
  });

  const accountDeals = React.useMemo(() => {
    if (!dealsData?.data) return [];
    return dealsData.data.filter((d: Deal) => {
      const acctId = typeof d.account === 'object' && d.account ? (d.account as any)._id : d.account;
      return String(acctId) === String(id);
    });
  }, [dealsData, id]);

  const accountLifetimeValue = React.useMemo(() => {
    return accountDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [accountDeals]);

  // 4. Fetch Activities
  const { data: activitiesData, refetch: refetchActivities } = useQuery({
    queryKey: queryKeys.activities.list({ entityType: 'account', entityId: id }),
    queryFn: () => fetchActivities('account', id),
    enabled: Boolean(id && account),
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (changes: Partial<Account>) => updateAccount(id, changes),
    onMutate: async (newChanges) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.detail(id) });
      const previousAccount = queryClient.getQueryData<Account>(queryKeys.accounts.detail(id));
      if (previousAccount) {
        queryClient.setQueryData<Account>(queryKeys.accounts.detail(id), {
          ...previousAccount,
          ...newChanges,
        });
      }
      return { previousAccount };
    },
    onError: async (err: any, newChanges, context) => {
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'UPDATE_LEAD',
          endpoint: `/accounts/${id}`,
          method: 'PATCH',
          payload: newChanges,
          entityType: 'account',
          entityId: id,
          description: 'Account updated',
        });
        setEditSheetVisible(false);
        return;
      }
      if (context?.previousAccount) {
        queryClient.setQueryData(queryKeys.accounts.detail(id), context.previousAccount);
      }
      if (err?.response?.status === 409 || err?.status === 409) {
        showToast('Updated on web — review', { type: 'warning' });
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts.detail(id) });
      } else {
        showToast(err.message || 'Failed to update account', { type: 'error' });
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.accounts.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      setEditSheetVisible(false);
      showToast('Account updated', { type: 'success' });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      showToast('Account deleted', { type: 'success' });
      router.back();
    },
    onError: () => {
      showToast('Could not delete account', { type: 'error' });
    },
  });

  // Add Note Mutation
  const noteMutation = useMutation({
    mutationFn: () =>
      createActivity({
        type: 'note',
        subject: 'Note added from mobile',
        body: noteText.trim(),
        entityType: 'account',
        entityId: id,
      }),
    onSuccess: () => {
      setNoteText('');
      setNoteSheetVisible(false);
      refetchActivities();
      showToast('Note added', { type: 'success' });
    },
    onError: async (err: any) => {
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'ADD_NOTE',
          endpoint: '/activities',
          method: 'POST',
          payload: {
            type: 'note',
            subject: 'Note added from mobile',
            body: noteText.trim(),
            entityType: 'account',
            entityId: id,
          },
          entityType: 'account',
          entityId: id,
          description: 'Note added to account',
        });
        setNoteText('');
        setNoteSheetVisible(false);
        return;
      }
      showToast('Failed to add note', { type: 'error' });
    },
  });

  const handleOpenEdit = () => {
    if (!account) return;
    setEditName(account.name);
    setEditIndustry(account.industry || '');
    setEditCity(account.city || '');
    setEditWebsite(account.website || '');
    setEditPhone(account.phone || '');
    setEditSheetVisible(true);
  };

  const handleSaveEdit = () => {
    if (!account) return;
    const changes: Partial<Account> = {};
    if (editName !== account.name) changes.name = editName;
    if (editIndustry !== (account.industry || '')) changes.industry = editIndustry;
    if (editCity !== (account.city || '')) changes.city = editCity;
    if (editWebsite !== (account.website || '')) changes.website = editWebsite;
    if (editPhone !== (account.phone || '')) changes.phone = editPhone;

    if (Object.keys(changes).length === 0) {
      setEditSheetVisible(false);
      return;
    }
    updateMutation.mutate(changes);
  };

  if (accountError) {
    return (
      <View style={styles.container}>
        <AppBar title="Account Details" showBack backgroundColor={theme.colors.appBar.accounts} />
        <View style={styles.removedContainer}>
          <AlertCircle size={48} color={theme.colors.ratings.hot.text} />
          <Text style={styles.removedTitle}>This record was removed</Text>
          <Text style={styles.removedDesc}>
            This account may have been deleted on the web or you no longer have permission to view it.
          </Text>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Return to Accounts</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (accountLoading || !account) {
    return (
      <View style={styles.container}>
        <AppBar title="Account Details" showBack backgroundColor={theme.colors.appBar.accounts} />
        <View style={{ padding: 16 }}>
          <Skeleton width="65%" height={26} style={{ marginBottom: 12, borderRadius: 8 }} />
          <Skeleton width="40%" height={16} style={{ marginBottom: 20, borderRadius: 6 }} />
          <Skeleton width="100%" height={140} style={{ borderRadius: 16, marginBottom: 16 }} />
          <Skeleton width="100%" height={200} style={{ borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBar
        title={account.name}
        showBack
        onBackPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/more/accounts');
          }
        }}
        backgroundColor={theme.colors.appBar.accounts}
        rightAction={
          <View style={styles.appBarRightActions}>
            <PressableScale onPress={handleOpenEdit} style={styles.headerIconBtn}>
              <Edit2 size={16} color="#FFFFFF" />
            </PressableScale>
            <PressableScale
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this account?')) {
                    deleteMutation.mutate();
                  }
                  return;
                }
                Alert.alert('Delete Account', 'Are you sure you want to delete this account?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
                ]);
              }}
              style={styles.headerIconBtn}
            >
              <Trash2 size={16} color="#FFFFFF" />
            </PressableScale>
          </View>
        }
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Hero Card */}
          <Card style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.avatarTile}>
                <Building2 size={24} color={theme.colors.blue} />
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {account.name}
                </Text>
                <Text style={styles.heroSub}>
                  {[account.industry, account.city].filter(Boolean).join(' · ') || 'B2B Account'}
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionRow}>
              {account.phone && (
                <PressableScale
                  onPress={() => Linking.openURL(`tel:${account.phone}`)}
                  style={styles.actionBtn}
                >
                  <Phone size={18} color={theme.colors.green} />
                  <Text style={styles.actionBtnText}>Call</Text>
                </PressableScale>
              )}

              {account.website && (
                <PressableScale
                  onPress={() => Linking.openURL(account.website!)}
                  style={styles.actionBtn}
                >
                  <Globe size={18} color={theme.colors.blue} />
                  <Text style={styles.actionBtnText}>Website</Text>
                </PressableScale>
              )}

              <PressableScale
                onPress={() => setNoteSheetVisible(true)}
                style={styles.actionBtn}
              >
                <Plus size={18} color={theme.colors.purple} />
                <Text style={styles.actionBtnText}>Add Note</Text>
              </PressableScale>
            </View>
          </Card>

          {/* 2. Key Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.greenTint }]}>
              <Text style={styles.metricLabel}>Lifetime Revenue</Text>
              <Text style={styles.metricValue}>
                {theme.helpers.formatCompactINR(accountLifetimeValue)}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.colors.blueTint }]}>
              <Text style={styles.metricLabel}>Total Deals</Text>
              <Text style={styles.metricValue}>{accountDeals.length}</Text>
            </View>
          </View>

          {/* 3. Associated Contacts */}
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Users size={16} color={theme.colors.ink} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>
                Contacts ({accountContacts.length})
              </Text>
            </View>

            {accountContacts.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No contacts linked to this account</Text>
              </Card>
            ) : (
              accountContacts.map((contact) => (
                <PressableScale
                  key={contact._id}
                  onPress={() => router.push(`/(tabs)/contacts/${contact._id}`)}
                  style={styles.subItemRow}
                >
                  <Avatar name={`${contact.firstName} ${contact.lastName}`} size={38} />
                  <View style={styles.subItemInfo}>
                    <Text style={styles.subItemTitle}>
                      {contact.firstName} {contact.lastName}
                    </Text>
                    <Text style={styles.subItemDesc}>
                      {[contact.jobTitle, contact.email].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </PressableScale>
              ))
            )}
          </View>

          {/* 4. Associated Deals */}
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Briefcase size={16} color={theme.colors.ink} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>
                Deals ({accountDeals.length})
              </Text>
            </View>

            {accountDeals.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No deals linked to this account</Text>
              </Card>
            ) : (
              accountDeals.map((deal) => (
                <PressableScale
                  key={deal._id}
                  onPress={() => router.push(`/(tabs)/deals/${deal._id}`)}
                  style={styles.subItemRow}
                >
                  <View style={styles.dealIconTile}>
                    <Briefcase size={18} color={theme.colors.orange} />
                  </View>
                  <View style={styles.subItemInfo}>
                    <Text style={styles.subItemTitle}>{deal.title}</Text>
                    <Text style={styles.subItemDesc}>
                      Stage: {deal.stage.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.dealAmountText}>
                    {theme.helpers.formatCompactINR(deal.amount)}
                  </Text>
                </PressableScale>
              ))
            )}
          </View>

          {/* 5. Activity Timeline */}
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Clock size={16} color={theme.colors.ink} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Activity History</Text>
            </View>

            {(!activitiesData?.data || activitiesData.data.length === 0) ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No activity recorded yet</Text>
              </Card>
            ) : (
              activitiesData.data.map((act) => (
                <Card key={act._id} style={styles.activityCard}>
                  <Text style={styles.activitySubject}>{act.subject}</Text>
                  {act.body ? <Text style={styles.activityBody}>{act.body}</Text> : null}
                  <Text style={styles.activityTime}>
                    {theme.helpers.relativeTime(act.createdAt)}
                  </Text>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      </ScreenEntrance>

      {/* Edit Account Bottom Sheet */}
      <BottomSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        title="Edit Account"
      >
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.inputLabel}>Company Name</Text>
          <TextInput
            value={editName}
            onChangeText={setEditName}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>Industry</Text>
          <TextInput
            value={editIndustry}
            onChangeText={setEditIndustry}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            value={editCity}
            onChangeText={setEditCity}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>Website</Text>
          <TextInput
            value={editWebsite}
            onChangeText={setEditWebsite}
            keyboardType="url"
            autoCapitalize="none"
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="phone-pad"
            style={styles.textInput}
          />

          <PressableScale onPress={handleSaveEdit} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </PressableScale>
        </ScrollView>
      </BottomSheet>

      {/* Add Note Bottom Sheet */}
      <BottomSheet
        visible={noteSheetVisible}
        onClose={() => setNoteSheetVisible(false)}
        title="Add Account Note"
      >
        <View style={styles.sheetScroll}>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Type notes from your call or meeting..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={4}
            style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
          />
          <PressableScale
            onPress={() => noteText.trim() && noteMutation.mutate()}
            style={[styles.saveBtn, !noteText.trim() && { opacity: 0.5 }]}
            disabled={!noteText.trim()}
          >
            <Text style={styles.saveBtnText}>Post Note</Text>
          </PressableScale>
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
    paddingBottom: 60,
    gap: 14,
  },
  appBarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    padding: 16,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarTile: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: theme.colors.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroInfo: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: theme.radii.card,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  sectionWrapper: {
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
  },
  emptyCardText: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radii.listRow,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dealIconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.orangeTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subItemInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  subItemTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 2,
  },
  subItemDesc: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  dealAmountText: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  activityCard: {
    padding: 14,
    borderRadius: theme.radii.listRow,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  activitySubject: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 4,
  },
  activityBody: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.text2,
    marginBottom: 6,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  removedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  removedTitle: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    marginTop: 14,
    marginBottom: 6,
  },
  removedDesc: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 260,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radii.input,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
});
