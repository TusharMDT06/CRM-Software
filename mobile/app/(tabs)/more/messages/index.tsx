import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SquarePen,
  Check,
  Send,
  MessageSquare,
  Mail,
  FileText,
  Copy,
} from 'lucide-react-native';

import { theme } from '../../../../src/theme';
import { AppBar } from '../../../../src/components/AppBar';
import { Avatar } from '../../../../src/components/Avatar';
import { Card } from '../../../../src/components/Card';
import { SearchInput } from '../../../../src/components/SearchInput';
import { ErrorState } from '../../../../src/components/ErrorState';
import { BottomSheet } from '../../../../src/components/BottomSheet';
import { ScreenEntrance } from '../../../../src/animations/ScreenEntrance';
import { Stagger } from '../../../../src/animations/Stagger';
import { PressableScale } from '../../../../src/animations/PressableScale';
import { UnderlineTabs } from '../../../../src/animations/UnderlineTabs';
import { Skeleton } from '../../../../src/animations/Skeleton';
import { fetchThreads, sendMessage } from '../../../../src/api/messages';
import { queryKeys } from '../../../../src/api/queryKeys';
import { MessageThread, SendMessageInput } from '@flowdesk/shared';

const MESSAGE_TABS = [
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
  { key: 'templates', label: 'Templates' },
];

const PREDEFINED_TEMPLATES = [
  {
    id: 'demo_confirm',
    title: 'Demo Confirmation',
    channel: 'sms',
    body: 'Hi {name}, confirming our demo call today at 12:30 PM. Looking forward to speaking with you!',
  },
  {
    id: 'quote_followup',
    title: 'Revised Quote Follow-up',
    channel: 'sms',
    body: 'Hi {name}, I have prepared the revised quotation with preferred pricing for your review.',
  },
  {
    id: 'proposal_email',
    title: 'Proposal & Commercials',
    channel: 'email',
    subject: 'FlowDesk Enterprise Proposal for Review',
    body: 'Hi {name},\n\nThank you for exploring FlowDesk CRM. Please find attached our detailed proposal and onboarding timeline.\n\nBest regards,\nAarav',
  },
  {
    id: 'call_reschedule',
    title: 'Reschedule Request',
    channel: 'sms',
    body: 'Hi {name}, can we move our upcoming session by 30 minutes? Let me know what time works best.',
  },
  {
    id: 'invoice_reminder',
    title: 'Payment Reminder',
    channel: 'email',
    subject: 'Friendly Reminder: Invoice Payment Due',
    body: 'Hi {name},\n\nThis is a friendly reminder that invoice #INV-2026 is due this week. Please let us know if you need any assistance with settlement.\n\nThank you,\nFinance Team',
  },
];

function MessagesSkeleton() {
  return (
    <Card style={styles.listCard}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.threadRow}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={120} height={16} borderRadius={4} />
              <Skeleton width={60} height={14} borderRadius={4} />
            </View>
            <Skeleton width="80%" height={14} borderRadius={4} />
          </View>
        </View>
      ))}
    </Card>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'sms' | 'email' | 'templates'>('sms');
  const [searchQuery, setSearchQuery] = useState('');

  // Compose Modal State
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeChannel, setComposeChannel] = useState<'sms' | 'email'>('sms');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // Query threads for active channel
  const {
    data: threadsData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.messages.threads(activeTab !== 'templates' ? activeTab : undefined),
    queryFn: () => fetchThreads(activeTab !== 'templates' ? activeTab : undefined),
    enabled: activeTab !== 'templates',
  });

  const threads = threadsData?.threads ?? [];

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase().trim();
    return threads.filter(
      (t) =>
        t.participantName.toLowerCase().includes(q) ||
        t.participantContact.toLowerCase().includes(q) ||
        (t.lastMessage?.body && t.lastMessage.body.toLowerCase().includes(q))
    );
  }, [threads, searchQuery]);

  // Send Message Mutation
  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      setComposeVisible(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      Alert.alert(
        'Message Sent',
        composeChannel === 'sms'
          ? 'SMS has been dispatched to recipient.'
          : 'Email has been queued and sent via Resend.'
      );
      if (data?.threadId) {
        router.push({
          pathname: '/more/messages/thread/[id]',
          params: {
            id: data.threadId,
            name: data.to,
            contact: data.to,
            channel: data.channel,
          },
        });
      }
    },
    onError: (err: any) => {
      Alert.alert('Send Failed', err?.message || 'Could not send message. Please retry.');
    },
  });

  const handleOpenCompose = (template?: typeof PREDEFINED_TEMPLATES[0]) => {
    if (template) {
      setComposeChannel(template.channel as 'sms' | 'email');
      setComposeSubject(template.subject || '');
      setComposeBody(template.body);
    } else {
      setComposeChannel(activeTab === 'email' ? 'email' : 'sms');
      setComposeSubject('');
      setComposeBody('');
    }
    setComposeVisible(true);
  };

  const handleSendMessage = () => {
    if (!composeTo.trim()) {
      Alert.alert('Recipient required', 'Please enter a recipient phone number or email address.');
      return;
    }
    if (!composeBody.trim()) {
      Alert.alert('Message empty', 'Please type a message body to send.');
      return;
    }

    sendMutation.mutate({
      channel: composeChannel,
      to: composeTo.trim(),
      from: 'Flowdesk CRM',
      subject: composeChannel === 'email' ? composeSubject.trim() : '',
      body: composeBody.trim(),
    });
  };

  return (
    <View style={styles.container}>
      {/* App Bar: Purple background (#5B3FD6) */}
      <AppBar
        title="Messages"
        showBack
        backgroundColor={theme.colors.appBar.messages}
        rightAction={
          <PressableScale
            onPress={() => handleOpenCompose()}
            style={styles.composeButton}
            accessibilityLabel="Compose new message"
          >
            <SquarePen size={18} color={theme.colors.appBar.messages} />
          </PressableScale>
        }
      />

      {/* Tabs Row: SMS / Email / Templates */}
      <View style={styles.tabsContainer}>
        <UnderlineTabs
          tabs={MESSAGE_TABS}
          activeKey={activeTab}
          onSelectTab={(k) => setActiveTab(k as any)}
          activeColor={theme.colors.appBar.messages}
        />
      </View>

      <ScreenEntrance style={styles.content}>
        {/* Search Input */}
        {activeTab !== 'templates' && (
          <View style={styles.searchContainer}>
            <SearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages..."
            />
          </View>
        )}

        {/* Content depending on tab */}
        {activeTab === 'templates' ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.templatesHeader}>Quick CRM Templates</Text>
            <View style={{ gap: 12 }}>
              {PREDEFINED_TEMPLATES.map((tmpl) => (
                <Card key={tmpl.id} style={styles.templateCard}>
                  <View style={styles.templateTopRow}>
                    <Text style={styles.templateTitle}>{tmpl.title}</Text>
                    <View
                      style={[
                        styles.channelPill,
                        {
                          backgroundColor:
                            tmpl.channel === 'sms' ? '#EFEBFF' : '#E7EEFB',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.channelPillText,
                          {
                            color:
                              tmpl.channel === 'sms'
                                ? theme.colors.purple
                                : theme.colors.blue,
                          },
                        ]}
                      >
                        {tmpl.channel.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.templateBody} numberOfLines={3}>
                    {tmpl.body}
                  </Text>

                  <PressableScale
                    onPress={() => handleOpenCompose(tmpl)}
                    style={styles.useTemplateButton}
                  >
                    <Send size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.useTemplateText}>Use Template</Text>
                  </PressableScale>
                </Card>
              ))}
            </View>
          </ScrollView>
        ) : isLoading ? (
          <View style={styles.scrollContent}>
            <MessagesSkeleton />
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load conversations"
              message="Could not retrieve your message inbox. Please check your network."
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
                tintColor={theme.colors.purple}
              />
            }
          >
            {filteredThreads.length === 0 ? (
              <Card style={styles.emptyCard}>
                <MessageSquare size={36} color={theme.colors.muted} />
                <Text style={styles.emptyTitle}>No conversations found</Text>
                <Text style={styles.emptyDesc}>
                  {searchQuery
                    ? 'No messages matched your query.'
                    : `No ${activeTab.toUpperCase()} conversations yet. Tap the compose icon above to send a new message.`}
                </Text>
              </Card>
            ) : (
              <Card style={styles.listCard}>
                <Stagger>
                  {filteredThreads.map((thread, index) => {
                    const isLast = index === filteredThreads.length - 1;
                    const isOutbound = thread.lastMessage?.direction === 'outbound';
                    const hasUnread = thread.unreadCount > 0;

                    return (
                      <PressableScale
                        key={thread.threadId}
                        onPress={() =>
                          router.push({
                            pathname: '/more/messages/thread/[id]',
                            params: {
                              id: thread.threadId,
                              name: thread.participantName,
                              contact: thread.participantContact,
                              channel: thread.channel,
                            },
                          })
                        }
                        style={[
                          styles.threadRow,
                          !isLast && styles.threadRowBorder,
                        ]}
                      >
                        {/* Avatar */}
                        <Avatar
                          name={thread.participantName}
                          id={thread.threadId}
                          size={44}
                        />

                        {/* Middle info */}
                        <View style={styles.threadMiddle}>
                          <View style={styles.threadHeaderRow}>
                            <Text style={styles.participantName} numberOfLines={1}>
                              {thread.participantName}
                            </Text>
                            <Text
                              style={[
                                styles.timeText,
                                hasUnread && styles.timeTextUnread,
                              ]}
                            >
                              {theme.helpers.relativeTime(thread.lastMessage?.createdAt)}
                            </Text>
                          </View>

                          <View style={styles.snippetRow}>
                            {isOutbound && (
                              <View style={styles.sentTickBox}>
                                <Check size={13} color="#12724B" strokeWidth={2.5} />
                                <Text style={styles.youPrefix}> You: </Text>
                              </View>
                            )}
                            <Text
                              style={[
                                styles.snippetText,
                                hasUnread && styles.snippetTextUnread,
                              ]}
                              numberOfLines={1}
                            >
                              {thread.lastMessage?.body || 'No messages'}
                            </Text>

                            {/* Unread badge */}
                            {hasUnread && (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>
                                  {thread.unreadCount}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </PressableScale>
                    );
                  })}
                </Stagger>
              </Card>
            )}
          </ScrollView>
        )}
      </ScreenEntrance>

      {/* Compose Message Sheet */}
      <BottomSheet
        visible={composeVisible}
        onClose={() => setComposeVisible(false)}
        title="New Message"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.composeContainer}
        >
          {/* Channel selector */}
          <View style={styles.composeChannelToggle}>
            <PressableScale
              onPress={() => setComposeChannel('sms')}
              style={[
                styles.channelToggleOption,
                composeChannel === 'sms' && styles.channelToggleActive,
              ]}
            >
              <MessageSquare
                size={16}
                color={composeChannel === 'sms' ? '#FFFFFF' : theme.colors.ink}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.channelToggleText,
                  composeChannel === 'sms' && styles.channelToggleTextActive,
                ]}
              >
                SMS
              </Text>
            </PressableScale>

            <PressableScale
              onPress={() => setComposeChannel('email')}
              style={[
                styles.channelToggleOption,
                composeChannel === 'email' && styles.channelToggleActive,
              ]}
            >
              <Mail
                size={16}
                color={composeChannel === 'email' ? '#FFFFFF' : theme.colors.ink}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.channelToggleText,
                  composeChannel === 'email' && styles.channelToggleTextActive,
                ]}
              >
                Email
              </Text>
            </PressableScale>
          </View>

          {/* Recipient */}
          <View style={styles.inputFieldGroup}>
            <Text style={styles.inputLabel}>
              {composeChannel === 'sms' ? 'To Phone Number' : 'To Email Address'}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={composeChannel === 'sms' ? '+91 98765 43210' : 'recipient@example.com'}
              placeholderTextColor={theme.colors.muted}
              value={composeTo}
              onChangeText={setComposeTo}
              keyboardType={composeChannel === 'sms' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
            />
          </View>

          {/* Subject (for email) */}
          {composeChannel === 'email' && (
            <View style={styles.inputFieldGroup}>
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Message Subject..."
                placeholderTextColor={theme.colors.muted}
                value={composeSubject}
                onChangeText={setComposeSubject}
              />
            </View>
          )}

          {/* Body */}
          <View style={styles.inputFieldGroup}>
            <Text style={styles.inputLabel}>Message Body</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Type your message here..."
              placeholderTextColor={theme.colors.muted}
              value={composeBody}
              onChangeText={setComposeBody}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Send Action */}
          <PressableScale
            onPress={handleSendMessage}
            disabled={sendMutation.isPending}
            style={[
              styles.sendActionButton,
              sendMutation.isPending && { opacity: 0.6 },
            ]}
          >
            <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sendActionText}>
              {sendMutation.isPending ? 'Sending...' : 'Send Message'}
            </Text>
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
  composeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 14,
    paddingBottom: 4,
  },
  scrollContent: {
    padding: theme.spacing.screen,
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    padding: theme.spacing.screen,
    justifyContent: 'center',
  },

  // Conversation List Card
  listCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  threadRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  threadMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  threadHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    flex: 1,
    fontSize: 15,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  timeText: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  timeTextUnread: {
    color: theme.colors.appBar.messages,
    fontWeight: '700',
  },
  snippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sentTickBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  youPrefix: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.text2,
    fontWeight: '600',
  },
  snippetText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.text2,
  },
  snippetTextUnread: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: theme.colors.appBar.messages,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: theme.typography.badge.fontFamily,
    fontWeight: '800',
  },

  // Empty Card
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Templates Tab
  templatesHeader: {
    fontSize: 15,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 12,
  },
  templateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  templateTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateTitle: {
    fontSize: 15,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  channelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.badge,
  },
  channelPillText: {
    fontSize: 10,
    fontFamily: theme.typography.badge.fontFamily,
    fontWeight: '800',
  },
  templateBody: {
    fontSize: 13,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.text2,
    lineHeight: 18,
    marginBottom: 14,
  },
  useTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.appBar.messages,
    paddingVertical: 10,
    borderRadius: theme.radii.input,
  },
  useTemplateText: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Compose Bottom Sheet
  composeContainer: {
    paddingBottom: 24,
    gap: 14,
  },
  composeChannelToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.input,
    padding: 4,
  },
  channelToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radii.input - 2,
  },
  channelToggleActive: {
    backgroundColor: theme.colors.appBar.messages,
  },
  channelToggleText: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  channelToggleTextActive: {
    color: '#FFFFFF',
  },
  inputFieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: theme.colors.text2,
  },
  textInput: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.ink,
  },
  textArea: {
    height: 90,
    paddingTop: 10,
  },
  sendActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.appBar.messages,
    borderRadius: theme.radii.input,
    paddingVertical: 14,
    marginTop: 6,
  },
  sendActionText: {
    fontSize: 14,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
