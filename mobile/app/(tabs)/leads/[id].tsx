import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  MessageSquare,
  Mail,
  Send,
  Edit2,
  Trash2,
  Building2,
  User,
  Plus,
  Clock,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { SourceChip } from '../../../src/components/SourceChip';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { useCan } from '../../../src/auth/useCan';
import { fetchLeadById, updateLead, deleteLead } from '../../../src/api/leads';
import { fetchActivities, createActivity, ActivityItem } from '../../../src/api/activities';
import { queryKeys } from '../../../src/api/queryKeys';
import { enqueueOfflineMutation } from '../../../src/offline/mutationQueue';
import { Lead, LeadRating, LeadStatus, LeadUpdateInput } from '@flowdesk/shared';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canUpdate = useCan('lead:update');
  const canDelete = useCan('lead:delete');

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editValue, setEditValue] = useState('');

  // 1. Fetch Lead
  const {
    data: lead,
    isLoading: leadLoading,
    isError: leadError,
    error,
  } = useQuery({
    queryKey: queryKeys.leads.detail(id),
    queryFn: () => fetchLeadById(id),
    enabled: Boolean(id),
    retry: 1,
  });

  // 2. Fetch Activities for Lead
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: queryKeys.activities.list({ entityType: 'lead', entityId: id }),
    queryFn: () => fetchActivities('lead', id),
    enabled: Boolean(id && lead),
  });

  // 3. Optimistic Lead PATCH Mutation
  const updateMutation = useMutation({
    mutationFn: (changes: Partial<LeadUpdateInput>) => updateLead(id, changes),
    onMutate: async (newChanges) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.detail(id) });
      const previousLead = queryClient.getQueryData<Lead>(queryKeys.leads.detail(id));

      if (previousLead) {
        queryClient.setQueryData<Lead>(queryKeys.leads.detail(id), {
          ...previousLead,
          ...newChanges,
        } as Lead);
      }
      return { previousLead };
    },
    onError: async (err: any, newChanges, context) => {
      // If network failure / offline, queue mutation for background sync
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'UPDATE_LEAD',
          endpoint: `/leads/${id}`,
          method: 'PATCH',
          payload: newChanges,
          entityType: 'lead',
          entityId: id,
          description: 'Lead updated',
        });
        return;
      }
      if (context?.previousLead) {
        queryClient.setQueryData(queryKeys.leads.detail(id), context.previousLead);
      }
      if (err?.response?.status === 409 || err?.status === 409) {
        showToast('Updated on web — review', { type: 'warning' });
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      } else {
        showToast('Update failed. Changes rolled back.', { type: 'error' });
      }
    },
    onSuccess: (savedLead) => {
      queryClient.setQueryData(queryKeys.leads.detail(id), savedLead);
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      showToast('Lead updated', { type: 'success' });
    },
  });

  // 4. Delete Lead Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      showToast('Lead deleted', { type: 'success' });
      router.back();
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Delete failed', { type: 'error' });
    },
  });

  // 5. Add Note Activity Mutation
  const addNoteMutation = useMutation({
    mutationFn: (text: string) =>
      createActivity({
        type: 'note',
        subject: 'Note added from mobile',
        body: text,
        entityType: 'lead',
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
            subject: 'Note added from mobile',
            body: text,
            entityType: 'lead',
            entityId: id,
          },
          entityType: 'lead',
          entityId: id,
          description: 'Note added to lead',
        });
        setNoteText('');
        setNoteSheetVisible(false);
        return;
      }
      showToast('Failed to add note', { type: 'error' });
    },
  });

  const handleOpenEditSheet = () => {
    if (!lead) return;
    setEditName(lead.name);
    setEditCompany(lead.company || '');
    setEditEmail(lead.email);
    setEditPhone(lead.phone || '');
    setEditValue(lead.value ? String(lead.value) : '');
    setEditSheetVisible(true);
  };

  const handleSaveEditSheet = () => {
    if (!lead) return;
    const changes: Partial<LeadUpdateInput> = {};
    if (editName !== lead.name) changes.name = editName;
    if (editCompany !== (lead.company || '')) changes.company = editCompany;
    if (editEmail !== lead.email) changes.email = editEmail;
    if (editPhone !== (lead.phone || '')) changes.phone = editPhone;
    const numVal = parseFloat(editValue) || 0;
    if (numVal !== (lead.value || 0)) changes.value = numVal;

    if (Object.keys(changes).length === 0) {
      setEditSheetVisible(false);
      return;
    }

    updateMutation.mutate(changes);
    setEditSheetVisible(false);
  };

  const handleDeleteLead = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this lead? This cannot be undone.')) {
        deleteMutation.mutate();
      }
      return;
    }
    Alert.alert(
      'Delete Lead',
      'Are you sure you want to delete this lead? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  // Check for 404 or record removed
  if (leadError) {
    return (
      <View style={styles.container}>
        <AppBar title="Lead Details" showBack backgroundColor={theme.colors.appBar.leads} />
        <View style={styles.removedContainer}>
          <AlertCircle size={48} color={theme.colors.ratings.hot.text} />
          <Text style={styles.removedTitle}>This record was removed</Text>
          <Text style={styles.removedDesc}>
            This lead may have been deleted on the web or you no longer have permission to view it.
          </Text>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Return to Leads</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (leadLoading || !lead) {
    return (
      <View style={styles.container}>
        <AppBar title="Lead Details" showBack backgroundColor={theme.colors.appBar.leads} />
        <View style={{ padding: 16 }}>
          <Skeleton width="60%" height={26} style={{ marginBottom: 12, borderRadius: 8 }} />
          <Skeleton width="40%" height={16} style={{ marginBottom: 20, borderRadius: 6 }} />
          <Skeleton width="100%" height={140} style={{ borderRadius: 16, marginBottom: 16 }} />
          <Skeleton width="100%" height={200} style={{ borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9]/g, '') : '';
  const activities = activitiesData?.data || [];

  return (
    <View style={styles.container}>
      <AppBar
        title={lead.name}
        subtitle={lead.company}
        showBack
        backgroundColor={theme.colors.appBar.leads}
        rightAction={
          <View style={styles.appBarActions}>
            {canUpdate && (
              <PressableScale
                onPress={handleOpenEditSheet}
                accessibilityLabel="Edit Lead"
                style={styles.actionIconBtn}
              >
                <Edit2 size={18} color="#FFFFFF" />
              </PressableScale>
            )}
            {canDelete && (
              <PressableScale
                onPress={handleDeleteLead}
                accessibilityLabel="Delete Lead"
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
          {/* Hero Contact Card */}
          <Card style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <Avatar name={lead.name} size={54} />
              <View style={styles.heroHeaderInfo}>
                <Text style={styles.heroName}>{lead.name}</Text>
                <Text style={styles.heroCompany}>{lead.company || 'No Company'}</Text>
                <View style={styles.heroChipsRow}>
                  <SourceChip source={lead.source} />
                  <Badge
                    label={lead.rating}
                    variant={
                      lead.rating === 'hot'
                        ? 'hot'
                        : lead.rating === 'warm'
                        ? 'warm'
                        : 'cold'
                    }
                  />
                </View>
              </View>
            </View>

            {/* Quick Actions (Call, SMS, Email, WhatsApp) */}
            <View style={styles.quickActionsRow}>
              <PressableScale
                onPress={() => lead.phone && Linking.openURL(`tel:${lead.phone}`)}
                style={[styles.quickActionBtn, !lead.phone && styles.quickActionDisabled]}
                accessibilityLabel="Call"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: theme.colors.green }]}>
                  <Phone size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Call</Text>
              </PressableScale>

              <PressableScale
                onPress={() => lead.phone && Linking.openURL(`sms:${lead.phone}`)}
                style={[styles.quickActionBtn, !lead.phone && styles.quickActionDisabled]}
                accessibilityLabel="SMS"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: theme.colors.blue }]}>
                  <MessageSquare size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>SMS</Text>
              </PressableScale>

              <PressableScale
                onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)}
                style={[styles.quickActionBtn, !lead.email && styles.quickActionDisabled]}
                accessibilityLabel="Email"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: theme.colors.purple }]}>
                  <Mail size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Email</Text>
              </PressableScale>

              <PressableScale
                onPress={() =>
                  cleanPhone &&
                  Linking.openURL(`https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(lead.name)}`)
                }
                style={[styles.quickActionBtn, !cleanPhone && styles.quickActionDisabled]}
                accessibilityLabel="WhatsApp"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: '#25D366' }]}>
                  <Send size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>WhatsApp</Text>
              </PressableScale>
            </View>
          </Card>

          {/* Quick Rating & Status Pills (Optimistic PATCH) */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Rating</Text>
            <View style={styles.pillsRow}>
              {(['hot', 'warm', 'cold'] as LeadRating[]).map((r) => {
                const isActive = lead.rating === r;
                return (
                  <PressableScale
                    key={r}
                    onPress={() => canUpdate && updateMutation.mutate({ rating: r })}
                    style={[
                      styles.ratingPill,
                      isActive && styles.ratingPillActive,
                      !canUpdate && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isActive && styles.pillTextActive,
                      ]}
                    >
                      {r.toUpperCase()}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Status</Text>
            <View style={styles.pillsRow}>
              {(['new', 'contacted', 'qualified', 'converted', 'lost'] as LeadStatus[]).map((st) => {
                const isActive = lead.status === st;
                return (
                  <PressableScale
                    key={st}
                    onPress={() => canUpdate && updateMutation.mutate({ status: st })}
                    style={[
                      styles.statusPill,
                      isActive && styles.statusPillActive,
                      !canUpdate && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isActive && styles.pillTextActive,
                      ]}
                    >
                      {st.toUpperCase()}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </Card>

          {/* Lead Information Card */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estimated Value</Text>
                <Text style={styles.infoValue}>
                  {lead.value ? theme.helpers.formatINR(lead.value) : '₹0'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue} selectable>
                  {lead.email}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue} selectable>
                  {lead.phone || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>
                  {typeof lead.owner === 'object' && lead.owner ? lead.owner.name : 'Unassigned'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>
                  {theme.helpers.relativeTime(lead.createdAt)}
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
                  Add a note or call record to track interactions.
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

      {/* Edit Lead Bottom Sheet */}
      <BottomSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        title="Edit Lead"
      >
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="Full Name"
          />

          <Text style={styles.fieldLabel}>Company</Text>
          <TextInput
            style={styles.input}
            value={editCompany}
            onChangeText={setEditCompany}
            placeholder="Company name"
          />

          <Text style={styles.fieldLabel}>Email *</Text>
          <TextInput
            style={styles.input}
            value={editEmail}
            onChangeText={setEditEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Deal Value (₹)</Text>
          <TextInput
            style={styles.input}
            value={editValue}
            onChangeText={setEditValue}
            keyboardType="numeric"
          />

          <PressableScale
            onPress={handleSaveEditSheet}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>Save Changes</Text>
          </PressableScale>
        </ScrollView>
      </BottomSheet>

      {/* Add Note Bottom Sheet */}
      <BottomSheet
        visible={noteSheetVisible}
        onClose={() => setNoteSheetVisible(false)}
        title="Add Activity Note"
      >
        <View style={styles.noteForm}>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Enter discussion notes, call takeaways, or follow-up details..."
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
    padding: 16,
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroHeaderInfo: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    fontSize: theme.typography.screenTitle.fontSize,
    fontFamily: theme.typography.screenTitle.fontFamily,
    fontWeight: theme.typography.screenTitle.fontWeight,
    color: theme.colors.ink,
  },
  heroCompany: {
    fontSize: 14,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginTop: 2,
  },
  heroChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 14,
  },
  quickActionBtn: {
    alignItems: 'center',
  },
  quickActionDisabled: {
    opacity: 0.35,
  },
  quickIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.text2,
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
    marginBottom: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  ratingPillActive: {
    borderColor: theme.colors.orange,
    backgroundColor: theme.colors.orange,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  statusPillActive: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.ink,
  },
  pillText: {
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.text2,
  },
  pillTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: theme.colors.blue,
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
  formScroll: {
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 4,
    marginTop: 10,
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
  submitBtn: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  noteForm: {
    gap: 12,
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
});
