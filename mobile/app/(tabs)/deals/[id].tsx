import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  User,
  Calendar,
  Edit2,
  Trash2,
  Plus,
  Clock,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
} from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { useCan } from '../../../src/auth/useCan';
import { fetchDealById, updateDeal, deleteDeal } from '../../../src/api/deals';
import { fetchActivities, createActivity } from '../../../src/api/activities';
import { queryKeys } from '../../../src/api/queryKeys';
import { enqueueOfflineMutation } from '../../../src/offline/mutationQueue';
import { Deal, DealStage } from '@flowdesk/shared';

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'qualified', label: 'Qualified', color: theme.colors.blue },
  { key: 'proposal', label: 'Proposal', color: theme.colors.orange },
  { key: 'negotiation', label: 'Negotiation', color: theme.colors.purple },
  { key: 'won', label: 'Won', color: theme.colors.green },
  { key: 'lost', label: 'Lost', color: '#94A3B8' },
];

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canUpdate = useCan('deal:update');
  const canDelete = useCan('deal:delete');

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Edit fields state
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // 1. Fetch Deal
  const {
    data: deal,
    isLoading: dealLoading,
    isError: dealError,
  } = useQuery({
    queryKey: queryKeys.deals.detail(id),
    queryFn: () => fetchDealById(id),
    enabled: Boolean(id),
    retry: 1,
  });

  // 2. Fetch Activities for Deal
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: queryKeys.activities.list({ entityType: 'deal', entityId: id }),
    queryFn: () => fetchActivities('deal', id),
    enabled: Boolean(id && deal),
  });

  // 3. Optimistic Update Mutation
  const updateMutation = useMutation({
    mutationFn: (changes: Partial<Deal>) => updateDeal(id, changes),
    onMutate: async (newChanges) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.deals.detail(id) });
      const prev = queryClient.getQueryData<Deal>(queryKeys.deals.detail(id));
      if (prev) {
        queryClient.setQueryData<Deal>(queryKeys.deals.detail(id), {
          ...prev,
          ...newChanges,
        });
      }
      return { prev };
    },
    onError: async (err: any, vars, context) => {
      // If network failure / offline, queue mutation for background sync
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'MOVE_DEAL_STAGE',
          endpoint: `/deals/${id}`,
          method: 'PATCH',
          payload: vars,
          entityType: 'deal',
          entityId: id,
          description: 'Deal updated',
        });
        return;
      }
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.deals.detail(id), context.prev);
      }
      if (err?.response?.status === 409 || err?.status === 409) {
        showToast('Updated on web — review', { type: 'warning' });
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(id) });
      } else {
        showToast('Update failed. Changes rolled back.', { type: 'error' });
      }
    },
    onSuccess: (savedDeal) => {
      queryClient.setQueryData(queryKeys.deals.detail(id), savedDeal);
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      showToast('Deal updated', { type: 'success' });
    },
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      showToast('Deal deleted', { type: 'success' });
      router.back();
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Delete failed', { type: 'error' });
    },
  });

  // 5. Add Note Mutation
  const addNoteMutation = useMutation({
    mutationFn: (text: string) =>
      createActivity({
        type: 'note',
        subject: 'Deal note from mobile',
        body: text,
        entityType: 'deal',
        entityId: id,
      }),
    onSuccess: () => {
      setNoteText('');
      setNoteSheetVisible(false);
      refetchActivities();
      showToast('Note added', { type: 'success' });
    },
    onError: async (err: any, text: string) => {
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'ADD_NOTE',
          endpoint: '/activities',
          method: 'POST',
          payload: {
            type: 'note',
            subject: 'Deal note from mobile',
            body: text,
            entityType: 'deal',
            entityId: id,
          },
          entityType: 'deal',
          entityId: id,
          description: 'Note added to deal',
        });
        setNoteText('');
        setNoteSheetVisible(false);
        return;
      }
      showToast('Failed to add note', { type: 'error' });
    },
  });

  const handleOpenEdit = () => {
    if (!deal) return;
    setEditTitle(deal.title);
    setEditAmount(String(deal.amount));
    setEditSheetVisible(true);
  };

  const handleSaveEdit = () => {
    if (!deal) return;
    const changes: Partial<Deal> = {};
    if (editTitle !== deal.title) changes.title = editTitle;
    const num = parseFloat(editAmount) || 0;
    if (num !== deal.amount) changes.amount = num;

    if (Object.keys(changes).length === 0) {
      setEditSheetVisible(false);
      return;
    }

    updateMutation.mutate(changes);
    setEditSheetVisible(false);
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this deal?')) {
        deleteMutation.mutate();
      }
      return;
    }
    Alert.alert('Delete Deal', 'Are you sure you want to delete this deal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (dealError) {
    return (
      <View style={styles.container}>
        <AppBar title="Deal Details" showBack backgroundColor={theme.colors.appBar.deals} />
        <View style={styles.removedContainer}>
          <AlertCircle size={48} color={theme.colors.ratings.hot.text} />
          <Text style={styles.removedTitle}>This record was removed</Text>
          <Text style={styles.removedDesc}>
            This deal may have been deleted on the web or you no longer have access.
          </Text>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Return to Deals</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (dealLoading || !deal) {
    return (
      <View style={styles.container}>
        <AppBar title="Deal Details" showBack backgroundColor={theme.colors.appBar.deals} />
        <View style={{ padding: 16 }}>
          <Skeleton width="70%" height={26} style={{ marginBottom: 12, borderRadius: 8 }} />
          <Skeleton width="40%" height={32} style={{ marginBottom: 20, borderRadius: 6 }} />
          <Skeleton width="100%" height={140} style={{ borderRadius: 16, marginBottom: 16 }} />
          <Skeleton width="100%" height={200} style={{ borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  const accountName =
    typeof deal.account === 'object' && deal.account ? deal.account.name : 'Unassigned Account';
  const contactName =
    typeof deal.contact === 'object' && deal.contact
      ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim()
      : 'Unassigned Contact';

  const activities = activitiesData?.data || [];

  return (
    <View style={styles.container}>
      <AppBar
        title={deal.title}
        subtitle={accountName}
        showBack
        backgroundColor={theme.colors.appBar.deals}
        rightAction={
          <View style={styles.appBarActions}>
            {canUpdate && (
              <PressableScale
                onPress={handleOpenEdit}
                accessibilityLabel="Edit Deal"
                style={styles.actionIconBtn}
              >
                <Edit2 size={18} color="#FFFFFF" />
              </PressableScale>
            )}
            {canDelete && (
              <PressableScale
                onPress={handleDelete}
                accessibilityLabel="Delete Deal"
                style={styles.actionIconBtn}
              >
                <Trash2 size={18} color="#FF6B6B" />
              </PressableScale>
            )}
          </View>
        }
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Big Money Card */}
          <Card style={styles.heroCard}>
            <Text style={styles.amountLabel}>Deal Amount</Text>
            <Text style={styles.bigMoneyText}>
              {theme.helpers.formatINR(deal.amount)}
            </Text>

            {/* Stage Stepper / Pills */}
            <Text style={styles.stagePickerLabel}>Pipeline Stage</Text>
            <View style={styles.stagePillsRow}>
              {STAGES.map((s) => {
                const isActive = deal.stage === s.key;
                return (
                  <PressableScale
                    key={s.key}
                    onPress={() => canUpdate && updateMutation.mutate({ stage: s.key })}
                    style={[
                      styles.stagePill,
                      isActive && { backgroundColor: s.color, borderColor: s.color },
                      !canUpdate && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stagePillText,
                        isActive && styles.stagePillTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </Card>

          {/* Deal Metadata Info Card */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account</Text>
                <Text style={styles.infoValue}>{accountName}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Primary Contact</Text>
                <Text style={styles.infoValue}>{contactName}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expected Close</Text>
                <Text style={styles.infoValue}>
                  {theme.helpers.relativeTime(deal.expectedClose)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>
                  {typeof deal.owner === 'object' && deal.owner ? deal.owner.name : 'Unassigned'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created Date</Text>
                <Text style={styles.infoValue}>
                  {theme.helpers.relativeTime(deal.createdAt)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Activity Timeline */}
          <Card style={styles.sectionCard}>
            <View style={styles.timelineHeader}>
              <Text style={styles.sectionTitle}>Activity Timeline</Text>
              <PressableScale
                onPress={() => setNoteSheetVisible(true)}
                style={styles.addNoteBtn}
              >
                <Plus size={14} color={theme.colors.blue} style={{ marginRight: 4 }} />
                <Text style={styles.addNoteText}>Add Note</Text>
              </PressableScale>
            </View>

            {activitiesLoading ? (
              <ActivityIndicator color={theme.colors.orange} size="small" style={{ marginVertical: 16 }} />
            ) : activities.length === 0 ? (
              <View style={styles.emptyTimeline}>
                <Clock size={28} color={theme.colors.muted} />
                <Text style={styles.emptyTimelineText}>No activities logged yet</Text>
                <Text style={styles.emptyTimelineSub}>
                  Keep track of updates, client discussions, and milestones.
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {activities.map((act) => (
                  <View key={act._id} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineTop}>
                        <Text style={styles.timelineSubject}>{act.subject}</Text>
                        <Text style={styles.timelineTime}>
                          {theme.helpers.relativeTime(act.createdAt)}
                        </Text>
                      </View>
                      {act.body ? (
                        <Text style={styles.timelineBody}>{act.body}</Text>
                      ) : null}
                      <Text style={styles.timelineAuthor}>
                        by {act.createdBy?.name || 'System'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </ScrollView>
      </ScreenEntrance>

      {/* Edit Deal Bottom Sheet */}
      <BottomSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        title="Edit Deal"
      >
        <View style={styles.formContainer}>
          <Text style={styles.fieldLabel}>Deal Title *</Text>
          <TextInput
            style={styles.input}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Title"
          />

          <Text style={styles.fieldLabel}>Amount (₹) *</Text>
          <TextInput
            style={styles.input}
            value={editAmount}
            onChangeText={setEditAmount}
            keyboardType="numeric"
          />

          <PressableScale
            onPress={handleSaveEdit}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>Save Changes</Text>
          </PressableScale>
        </View>
      </BottomSheet>

      {/* Add Note Bottom Sheet */}
      <BottomSheet
        visible={noteSheetVisible}
        onClose={() => setNoteSheetVisible(false)}
        title="Add Deal Note"
      >
        <View style={styles.formContainer}>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Record deal progress, negotiation highlights, or action items..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <PressableScale
            onPress={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
            style={[styles.submitBtn, !noteText.trim() && { opacity: 0.5 }]}
          >
            <Text style={styles.submitBtnText}>Add Note</Text>
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
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: theme.spacing.screen,
    paddingBottom: 90,
  },
  heroCard: {
    padding: 18,
    marginBottom: 14,
  },
  amountLabel: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bigMoneyText: {
    fontSize: theme.typography.bigMoney.fontSize,
    fontFamily: theme.typography.bigMoney.fontFamily,
    fontWeight: theme.typography.bigMoney.fontWeight,
    color: theme.colors.ink,
    marginTop: 4,
    marginBottom: 16,
  },
  stagePickerLabel: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 8,
  },
  stagePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stagePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  stagePillText: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.text2,
  },
  stagePillTextActive: {
    color: '#FFFFFF',
  },
  sectionCard: {
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: theme.typography.sectionTitle.fontSize,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: theme.typography.sectionTitle.fontWeight,
    color: theme.colors.ink,
    marginBottom: 12,
  },
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    maxWidth: '60%',
    textAlign: 'right',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addNoteText: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.blue,
  },
  emptyTimeline: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTimelineText: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 8,
  },
  emptyTimelineSub: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  timelineList: {
    gap: 14,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.orange,
    marginTop: 6,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.input,
    padding: 10,
  },
  timelineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineSubject: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  timelineTime: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  timelineBody: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.text2,
    lineHeight: 18,
    marginBottom: 4,
  },
  timelineAuthor: {
    fontSize: 11,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  removedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  removedTitle: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 14,
  },
  removedDesc: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radii.input,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  formContainer: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 2,
    marginTop: 6,
  },
  input: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.ink,
  },
  noteInput: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.ink,
    height: 100,
  },
  submitBtn: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
});
