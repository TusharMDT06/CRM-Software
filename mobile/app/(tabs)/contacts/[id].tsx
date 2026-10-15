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
import { BottomSheet } from '../../../src/components/BottomSheet';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { useCan } from '../../../src/auth/useCan';
import { fetchContactById, updateContact, deleteContact } from '../../../src/api/contacts';
import { enqueueOfflineMutation } from '../../../src/offline/mutationQueue';
import { fetchActivities, createActivity } from '../../../src/api/activities';
import { queryKeys } from '../../../src/api/queryKeys';
import { Contact } from '@flowdesk/shared';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canUpdate = useCan('contact:update');
  const canDelete = useCan('contact:delete');

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Edit fields
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');

  // 1. Fetch Contact
  const {
    data: contact,
    isLoading: contactLoading,
    isError: contactError,
  } = useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: () => fetchContactById(id),
    enabled: Boolean(id),
    retry: 1,
  });

  // 2. Fetch Activities for Contact
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: queryKeys.activities.list({ entityType: 'contact', entityId: id }),
    queryFn: () => fetchActivities('contact', id),
    enabled: Boolean(id && contact),
  });

  // 3. Optimistic Update Mutation
  const updateMutation = useMutation({
    mutationFn: (changes: Partial<Contact>) => updateContact(id, changes),
    onMutate: async (newChanges) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.contacts.detail(id) });
      const prev = queryClient.getQueryData<Contact>(queryKeys.contacts.detail(id));
      if (prev) {
        queryClient.setQueryData<Contact>(queryKeys.contacts.detail(id), {
          ...prev,
          ...newChanges,
        });
      }
      return { prev };
    },
    onError: async (err: any, newChanges, context) => {
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'UPDATE_LEAD',
          endpoint: `/contacts/${id}`,
          method: 'PATCH',
          payload: newChanges,
          entityType: 'contact',
          entityId: id,
          description: 'Contact updated',
        });
        return;
      }
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.contacts.detail(id), context.prev);
      }
      if (err?.response?.status === 409 || err?.status === 409) {
        showToast('Updated on web — review', { type: 'warning' });
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts.detail(id) });
      } else {
        showToast('Update failed. Changes rolled back.', { type: 'error' });
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.contacts.detail(id), saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
      showToast('Contact updated', { type: 'success' });
    },
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      showToast('Contact deleted', { type: 'success' });
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
        subject: 'Contact note from mobile',
        body: text,
        entityType: 'contact',
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
            subject: 'Contact note from mobile',
            body: text,
            entityType: 'contact',
            entityId: id,
          },
          entityType: 'contact',
          entityId: id,
          description: 'Note added to contact',
        });
        setNoteText('');
        setNoteSheetVisible(false);
        return;
      }
      showToast('Failed to add note', { type: 'error' });
    },
  });

  const handleOpenEdit = () => {
    if (!contact) return;
    setEditFirstName(contact.firstName);
    setEditLastName(contact.lastName);
    setEditEmail(contact.email);
    setEditPhone(contact.phone || '');
    setEditJobTitle(contact.jobTitle || '');
    setEditSheetVisible(true);
  };

  const handleSaveEdit = () => {
    if (!contact) return;
    const changes: Partial<Contact> = {};
    if (editFirstName !== contact.firstName) changes.firstName = editFirstName;
    if (editLastName !== contact.lastName) changes.lastName = editLastName;
    if (editEmail !== contact.email) changes.email = editEmail;
    if (editPhone !== (contact.phone || '')) changes.phone = editPhone;
    if (editJobTitle !== (contact.jobTitle || '')) changes.jobTitle = editJobTitle;

    if (Object.keys(changes).length === 0) {
      setEditSheetVisible(false);
      return;
    }

    updateMutation.mutate(changes);
    setEditSheetVisible(false);
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this contact?')) {
        deleteMutation.mutate();
      }
      return;
    }
    Alert.alert('Delete Contact', 'Are you sure you want to delete this contact?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (contactError) {
    return (
      <View style={styles.container}>
        <AppBar title="Contact Details" showBack backgroundColor={theme.colors.appBar.contacts} />
        <View style={styles.removedContainer}>
          <AlertCircle size={48} color={theme.colors.ratings.hot.text} />
          <Text style={styles.removedTitle}>This record was removed</Text>
          <Text style={styles.removedDesc}>
            This contact may have been deleted on the web or you no longer have access.
          </Text>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Return to Contacts</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (contactLoading || !contact) {
    return (
      <View style={styles.container}>
        <AppBar title="Contact Details" showBack backgroundColor={theme.colors.appBar.contacts} />
        <View style={{ padding: 16 }}>
          <Skeleton width="60%" height={26} style={{ marginBottom: 12, borderRadius: 8 }} />
          <Skeleton width="40%" height={16} style={{ marginBottom: 20, borderRadius: 6 }} />
          <Skeleton width="100%" height={140} style={{ borderRadius: 16, marginBottom: 16 }} />
          <Skeleton width="100%" height={200} style={{ borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  const accountName =
    typeof contact.account === 'object' && contact.account ? contact.account.name : 'No Account';
  const cleanPhone = contact.phone ? contact.phone.replace(/[^0-9]/g, '') : '';
  const activities = activitiesData?.data || [];

  return (
    <View style={styles.container}>
      <AppBar
        title={fullName}
        subtitle={accountName}
        showBack
        backgroundColor={theme.colors.appBar.contacts}
        rightAction={
          <View style={styles.appBarActions}>
            {canUpdate && (
              <PressableScale
                onPress={handleOpenEdit}
                accessibilityLabel="Edit Contact"
                style={styles.actionIconBtn}
              >
                <Edit2 size={18} color="#FFFFFF" />
              </PressableScale>
            )}
            {canDelete && (
              <PressableScale
                onPress={handleDelete}
                accessibilityLabel="Delete Contact"
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
              <Avatar name={fullName} size={54} />
              <View style={styles.heroHeaderInfo}>
                <Text style={styles.heroName}>{fullName}</Text>
                <Text style={styles.heroRole}>
                  {[contact.jobTitle, accountName].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>

            {/* Quick Actions (Call, SMS, Email, WhatsApp) */}
            <View style={styles.quickActionsRow}>
              <PressableScale
                onPress={() => contact.phone && Linking.openURL(`tel:${contact.phone}`)}
                style={[styles.quickActionBtn, !contact.phone && styles.quickActionDisabled]}
                accessibilityLabel="Call"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: theme.colors.green }]}>
                  <Phone size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Call</Text>
              </PressableScale>

              <PressableScale
                onPress={() => contact.phone && Linking.openURL(`sms:${contact.phone}`)}
                style={[styles.quickActionBtn, !contact.phone && styles.quickActionDisabled]}
                accessibilityLabel="SMS"
              >
                <View style={[styles.quickIconCircle, { backgroundColor: theme.colors.blue }]}>
                  <MessageSquare size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>SMS</Text>
              </PressableScale>

              <PressableScale
                onPress={() => contact.email && Linking.openURL(`mailto:${contact.email}`)}
                style={[styles.quickActionBtn, !contact.email && styles.quickActionDisabled]}
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
                  Linking.openURL(`https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(fullName)}`)
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

          {/* Details Overview */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue} selectable>
                  {contact.email}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue} selectable>
                  {contact.phone || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Job Title</Text>
                <Text style={styles.infoValue}>{contact.jobTitle || 'Not specified'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Company Account</Text>
                <Text style={styles.infoValue}>{accountName}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>
                  {typeof contact.owner === 'object' && contact.owner ? contact.owner.name : 'Unassigned'}
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
                <Text style={styles.emptyTimelineText}>No activities logged</Text>
                <Text style={styles.emptyTimelineSub}>
                  Record notes, calls, or meetings with {contact.firstName}.
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

      {/* Edit Contact Bottom Sheet */}
      <BottomSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        title="Edit Contact"
      >
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>First Name *</Text>
          <TextInput
            style={styles.input}
            value={editFirstName}
            onChangeText={setEditFirstName}
          />

          <Text style={styles.fieldLabel}>Last Name *</Text>
          <TextInput
            style={styles.input}
            value={editLastName}
            onChangeText={setEditLastName}
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

          <Text style={styles.fieldLabel}>Job Title</Text>
          <TextInput
            style={styles.input}
            value={editJobTitle}
            onChangeText={setEditJobTitle}
          />

          <PressableScale
            onPress={handleSaveEdit}
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
        title="Add Contact Note"
      >
        <View style={styles.noteForm}>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Log discussion points, preferences, or action items..."
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
  heroRole: {
    fontSize: 14,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
    marginTop: 2,
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
    maxWidth: '65%',
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
    backgroundColor: theme.colors.purple,
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
    maxHeight: 380,
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
