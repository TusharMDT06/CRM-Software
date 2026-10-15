import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Check, CheckCheck } from 'lucide-react-native';

import { theme } from '../../../../../src/theme';
import { AppBar } from '../../../../../src/components/AppBar';
import { ErrorState } from '../../../../../src/components/ErrorState';
import { PressableScale } from '../../../../../src/animations/PressableScale';
import { Skeleton } from '../../../../../src/animations/Skeleton';
import { fetchThreadMessages, sendMessage } from '../../../../../src/api/messages';
import { queryKeys } from '../../../../../src/api/queryKeys';
import { Message, SendMessageInput } from '@flowdesk/shared';

const QUICK_REPLIES = [
  'Confirmed for 12:30 PM today!',
  'Thanks! I will review and get back shortly.',
  'Can we connect tomorrow afternoon?',
  'Sending the revised proposal now.',
  'Please let me know if you have questions.',
];

function ThreadSkeleton() {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      <View style={{ alignSelf: 'flex-start', maxWidth: '75%' }}>
        <Skeleton width={200} height={48} borderRadius={16} />
      </View>
      <View style={{ alignSelf: 'flex-end', maxWidth: '75%' }}>
        <Skeleton width={180} height={40} borderRadius={16} />
      </View>
      <View style={{ alignSelf: 'flex-start', maxWidth: '75%' }}>
        <Skeleton width={240} height={56} borderRadius={16} />
      </View>
    </View>
  );
}

export default function MessageThreadScreen() {
  const { id, name, contact, channel = 'sms' } = useLocalSearchParams<{
    id: string;
    name?: string;
    contact?: string;
    channel?: string;
  }>();

  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');

  const displayName = name || contact || 'Conversation';
  const displayContact = contact || '';
  const messageChannel = (channel === 'email' ? 'email' : 'sms') as 'sms' | 'email';

  // Fetch thread messages
  const {
    data: threadData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.messages.thread(id),
    queryFn: () => fetchThreadMessages(id),
    refetchInterval: 5000, // Poll every 5s as fallback in addition to realtime socket
  });

  const messages: Message[] = threadData?.messages ?? [];

  // Scroll to bottom on messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      setInputText('');
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
    },
    onError: (err: any) => {
      Alert.alert('Send Error', err?.message || 'Failed to dispatch message.');
    },
  });

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    sendMutation.mutate({
      threadId: id,
      channel: messageChannel,
      to: displayContact || displayName,
      from: 'Flowdesk CRM',
      body: text,
      subject: messageChannel === 'email' ? `Re: ${displayName}` : '',
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* App Bar: Purple (#5B3FD6) */}
      <AppBar
        title={displayName}
        subtitle={displayContact ? `${messageChannel.toUpperCase()} · ${displayContact}` : messageChannel.toUpperCase()}
        showBack
        onBackPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/more/messages');
          }
        }}
        backgroundColor={theme.colors.appBar.messages}
      />

      <View style={styles.body}>
        {isLoading ? (
          <ThreadSkeleton />
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load thread"
              message="Could not retrieve messages for this conversation."
              onRetry={refetch}
            />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
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
            {messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages in this conversation yet.</Text>
              </View>
            ) : (
              messages.map((msg, index) => {
                const isOutbound = msg.direction === 'outbound';
                return (
                  <View
                    key={msg._id || index}
                    style={[
                      styles.bubbleWrapper,
                      isOutbound ? styles.bubbleWrapperOutbound : styles.bubbleWrapperInbound,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isOutbound ? styles.bubbleOutbound : styles.bubbleInbound,
                      ]}
                    >
                      {/* Optional Subject for email */}
                      {msg.subject ? (
                        <Text
                          style={[
                            styles.subjectText,
                            isOutbound ? styles.subjectTextOutbound : styles.subjectTextInbound,
                          ]}
                        >
                          {msg.subject}
                        </Text>
                      ) : null}

                      <Text
                        style={[
                          styles.messageBody,
                          isOutbound ? styles.messageBodyOutbound : styles.messageBodyInbound,
                        ]}
                      >
                        {msg.body}
                      </Text>

                      <View style={styles.bubbleFooter}>
                        <Text
                          style={[
                            styles.timestampText,
                            isOutbound ? styles.timestampOutbound : styles.timestampInbound,
                          ]}
                        >
                          {theme.helpers.relativeTime(msg.createdAt)}
                        </Text>
                        {isOutbound && (
                          <View style={styles.tickBox}>
                            {msg.status === 'delivered' || msg.status === 'read' ? (
                              <CheckCheck size={13} color="#FFFFFF" />
                            ) : (
                              <Check size={13} color="rgba(255,255,255,0.7)" />
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Quick Reply Pills */}
        <View style={styles.quickReplyContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplyScroll}
          >
            {QUICK_REPLIES.map((reply, i) => (
              <PressableScale
                key={i}
                onPress={() => setInputText(reply)}
                style={styles.quickPill}
              >
                <Text style={styles.quickPillText} numberOfLines={1}>
                  {reply}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>

        {/* Composer Input Bar */}
        <View style={styles.composerBar}>
          <TextInput
            style={styles.composerInput}
            placeholder={`Reply via ${messageChannel.toUpperCase()}...`}
            placeholderTextColor={theme.colors.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <PressableScale
            onPress={() => handleSend()}
            disabled={sendMutation.isPending || !inputText.trim()}
            style={[
              styles.sendButton,
              (!inputText.trim() || sendMutation.isPending) && styles.sendButtonDisabled,
            ]}
          >
            <Send size={18} color="#FFFFFF" />
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.screen,
    paddingBottom: 16,
    gap: 12,
  },
  errorContainer: {
    flex: 1,
    padding: theme.spacing.screen,
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.muted,
  },

  // Bubbles
  bubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bubbleWrapperInbound: {
    justifyContent: 'flex-start',
  },
  bubbleWrapperOutbound: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleInbound: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleOutbound: {
    backgroundColor: theme.colors.appBar.messages,
    borderBottomRightRadius: 4,
  },
  subjectText: {
    fontSize: 13,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: '800',
    marginBottom: 4,
  },
  subjectTextInbound: {
    color: theme.colors.ink,
  },
  subjectTextOutbound: {
    color: '#FFFFFF',
  },
  messageBody: {
    fontSize: 14,
    fontFamily: theme.typography.body.fontFamily,
    lineHeight: 20,
  },
  messageBodyInbound: {
    color: theme.colors.ink,
  },
  messageBodyOutbound: {
    color: '#FFFFFF',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestampText: {
    fontSize: 11,
    fontFamily: theme.typography.meta.fontFamily,
  },
  timestampInbound: {
    color: theme.colors.muted,
  },
  timestampOutbound: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  tickBox: {
    marginLeft: 2,
  },

  // Quick Reply
  quickReplyContainer: {
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingVertical: 6,
  },
  quickReplyScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickPill: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickPillText: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.text2,
    fontWeight: '600',
  },

  // Composer
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.ink,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.appBar.messages,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
