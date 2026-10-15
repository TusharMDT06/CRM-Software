import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, X, Inbox } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationItem,
} from '../api/notifications';
import { queryKeys } from '../api/queryKeys';
import { showToast } from './Toast';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => fetchNotifications(1, 30),
    enabled: visible,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      showToast('All notifications marked as read', { type: 'success' });
    },
  });

  const notifications = data?.data || [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Bell size={20} color={theme.colors.ink} style={{ marginRight: 8 }} />
              <Text style={styles.title}>Notifications</Text>
            </View>

            <View style={styles.actionRow}>
              {notifications.some((n) => !n.readAt) && (
                <PressableScale
                  onPress={() => markAllReadMutation.mutate()}
                  style={styles.markAllBtn}
                >
                  <CheckCheck size={16} color={theme.colors.blue} style={{ marginRight: 4 }} />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </PressableScale>
              )}
              <PressableScale onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={theme.colors.muted} />
              </PressableScale>
            </View>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.orange} size="small" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Inbox size={40} color={theme.colors.muted} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyDesc}>
                You're all caught up! Realtime alerts will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollList}
              showsVerticalScrollIndicator={false}
            >
              {notifications.map((item: NotificationItem) => {
                const isUnread = !item.readAt;
                return (
                  <PressableScale
                    key={item._id}
                    onPress={() => {
                      if (isUnread) markReadMutation.mutate(item._id);
                    }}
                    style={[
                      styles.itemCard,
                      isUnread && styles.itemCardUnread,
                    ]}
                  >
                    <View style={styles.itemHeader}>
                      <Text
                        style={[
                          styles.itemTitle,
                          isUnread && styles.itemTitleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>

                    <Text style={styles.itemMessage} numberOfLines={2}>
                      {item.message}
                    </Text>

                    <Text style={styles.itemTime}>
                      {theme.helpers.relativeTime(item.createdAt)}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sectionTitle.fontSize,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: theme.typography.sectionTitle.fontWeight,
    color: theme.colors.ink,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.blue,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  scrollList: {
    padding: 16,
    gap: 10,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.listRow,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  itemCardUnread: {
    backgroundColor: 'rgba(47, 111, 237, 0.04)',
    borderColor: 'rgba(47, 111, 237, 0.3)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    fontWeight: '500',
    color: theme.colors.ink,
    flex: 1,
  },
  itemTitleUnread: {
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.blue,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.blue,
    marginLeft: 8,
  },
  itemMessage: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.text2,
    lineHeight: 18,
    marginBottom: 6,
  },
  itemTime: {
    fontSize: 11,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
});
