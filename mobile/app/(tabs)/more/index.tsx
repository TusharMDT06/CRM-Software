import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CheckSquare,
  Building2,
  Target,
  MessageSquare,
  Users,
  SlidersHorizontal,
  LogOut,
  ChevronRight,
  HelpCircle,
  Mail,
  Phone,
  Globe,
  X,
} from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { Card } from '../../../src/components/Card';
import { PressableScale } from '../../../src/animations/PressableScale';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { showToast } from '../../../src/components/Toast';
import { useSessionStore } from '../../../src/auth/sessionStore';
import { useAuth } from '../../../src/auth/useAuth';
import { fetchTasks } from '../../../src/api/tasks';
import { fetchAccounts } from '../../../src/api/accounts';
import { fetchUsers } from '../../../src/api/users';
import { fetchThreads } from '../../../src/api/messages';
import { queryKeys } from '../../../src/api/queryKeys';

export default function MoreMenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSessionStore((state) => state.user);
  const { logout } = useAuth();
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // 1. Live Tasks Due Today Count
  const { data: tasksData } = useQuery({
    queryKey: queryKeys.tasks.list({ status: 'open', limit: 100 }),
    queryFn: () => fetchTasks({ status: 'open', limit: 100 }),
  });

  const dueTodayTasksCount = React.useMemo(() => {
    if (!tasksData?.data) return 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    return tasksData.data.filter((t) => {
      const dStr = new Date(t.dueDate).toISOString().split('T')[0];
      return dStr <= todayStr && t.status === 'open';
    }).length;
  }, [tasksData]);

  // 2. Live Accounts Count
  const { data: accountsData } = useQuery({
    queryKey: queryKeys.accounts.list({ limit: 1 }),
    queryFn: () => fetchAccounts({ limit: 1 }),
  });
  const totalAccountsCount = accountsData?.pagination?.total ?? accountsData?.data?.length ?? 0;

  // 3. Live Team Members Count
  const { data: teamData } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: fetchUsers,
  });
  const totalTeamCount = Array.isArray(teamData) ? teamData.length : 0;

  // 4. Live Unread Messages Count
  const { data: threadsData } = useQuery({
    queryKey: queryKeys.messages.threads(),
    queryFn: () => fetchThreads(),
  });
  const totalUnreadMessages = React.useMemo(() => {
    if (!threadsData?.threads) return 0;
    return threadsData.threads.reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0);
  }, [threadsData]);

  const handleConfirmLogout = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      setSignOutModalVisible(false);
      showToast('Signed out successfully', { type: 'info' });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/login';
      } else {
        router.replace('/(auth)/login');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error signing out', { type: 'error' });
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleLogout = () => {
    setSignOutModalVisible(true);
  };

  const TILES = [
    {
      title: 'Reports',
      desc: 'Sales and deal insights',
      Icon: BarChart3,
      color: theme.colors.blue,
      bgColor: theme.colors.blueTint,
      route: '/(tabs)/more/reports',
      badge: null,
    },
    {
      title: 'Tasks',
      desc: `${dueTodayTasksCount} due today`,
      Icon: CheckSquare,
      color: theme.colors.green,
      bgColor: theme.colors.greenTint,
      route: '/(tabs)/more/tasks',
      badge: dueTodayTasksCount > 0 ? dueTodayTasksCount : null,
    },
    {
      title: 'Accounts',
      desc: `${totalAccountsCount} companies`,
      Icon: Building2,
      color: theme.colors.blue,
      bgColor: theme.colors.blueTint,
      route: '/(tabs)/more/accounts',
      badge: null,
    },
    {
      title: 'Lead Sources',
      desc: 'Ads and marketing',
      Icon: Target,
      color: theme.colors.orange,
      bgColor: theme.colors.orangeTint,
      route: '/(tabs)/more/lead-sources',
      badge: null,
    },
    {
      title: 'Messages',
      desc: 'SMS and email',
      Icon: MessageSquare,
      color: theme.colors.purple,
      bgColor: theme.colors.purpleTint,
      route: '/(tabs)/more/messages',
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : null,
    },
    {
      title: 'Team and Roles',
      desc: `${totalTeamCount > 0 ? totalTeamCount : 'Team'} members`,
      Icon: Users,
      color: theme.colors.ink,
      bgColor: theme.colors.surfaceMuted,
      route: '/(tabs)/more/team',
      badge: null,
    },
  ];

  const roleLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'manager'
      ? 'Manager'
      : 'Sales Rep';

  return (
    <View style={styles.container}>
      {/* App Bar with Settings action on right */}
      <AppBar
        title="More"
        backgroundColor={theme.colors.appBar.more}
        rightAction={
          <PressableScale
            onPress={() => router.push('/(tabs)/more/settings')}
            style={styles.settingsBtn}
            accessibilityLabel="Open settings"
          >
            <SlidersHorizontal size={18} color="#FFFFFF" />
          </PressableScale>
        }
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card matching image copy 6.png */}
          <Card
            style={styles.profileCard}
            onPress={() => router.push('/(tabs)/more/settings')}
          >
            <View style={styles.profileRow}>
              <Avatar name={user?.name || 'User'} size={52} />

              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user?.name || 'FlowDesk User'}
                </Text>
                <Text style={styles.profileTitleCompany} numberOfLines={1}>
                  {user?.role === 'admin'
                    ? 'Administrator · FlowDesk'
                    : user?.role === 'manager'
                    ? 'Sales Manager · FlowDesk'
                    : 'Sales Executive · FlowDesk'}
                </Text>
              </View>

              <View style={styles.roleBadgeContainer}>
                <Badge
                  label={roleLabel}
                  variant={
                    user?.role === 'admin'
                      ? 'hot'
                      : user?.role === 'manager'
                      ? 'role'
                      : 'neutral'
                  }
                />
              </View>
            </View>
          </Card>

          {/* 2x3 Tiles Grid */}
          <View style={styles.grid}>
            {TILES.map((tile) => {
              const IconComp = tile.Icon;
              return (
                <View key={tile.title} style={styles.gridCol}>
                  <Card
                    style={styles.tileCard}
                    onPress={() => router.push(tile.route as any)}
                  >
                    <View style={styles.tileTopRow}>
                      <View
                        style={[
                          styles.tileIconContainer,
                          { backgroundColor: tile.bgColor },
                        ]}
                      >
                        <IconComp size={22} color={tile.color} />
                      </View>

                      {tile.badge && (
                        <View style={styles.tileBadgePill}>
                          <Text style={styles.tileBadgeText}>{tile.badge}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.tileTitle}>{tile.title}</Text>
                    <Text style={styles.tileDesc} numberOfLines={1}>
                      {tile.desc}
                    </Text>
                  </Card>
                </View>
              );
            })}
          </View>

          {/* List Items: Help & Support, Sign Out */}
          <Card style={styles.listCard} padded={false}>
            <TouchableOpacity
              onPress={() => setHelpModalVisible(true)}
              style={styles.listItem}
              activeOpacity={0.7}
            >
              <View style={styles.listIconContainer}>
                <HelpCircle size={18} color={theme.colors.ink} />
              </View>
              <Text style={styles.listLabel}>Help and support</Text>
              <ChevronRight size={18} color={theme.colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.listItem, styles.listBorder]}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              testID="sign-out-row"
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.listIconContainer,
                  { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                ]}
              >
                <LogOut size={18} color={theme.colors.ratings.hot.text} />
              </View>
              <Text
                style={[
                  styles.listLabel,
                  { color: theme.colors.ratings.hot.text, fontWeight: '700' },
                ]}
              >
                Sign out
              </Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </ScreenEntrance>

      {/* Help and Support Modal */}
      {Platform.OS === 'web' ? (
        helpModalVisible && (
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={() => setHelpModalVisible(false)}
            />
            <View style={[styles.modalCard, { position: 'relative', zIndex: 100000, elevation: 100 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Help & Support</Text>
                <TouchableOpacity onPress={() => setHelpModalVisible(false)}>
                  <X size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                Need assistance with FlowDesk CRM or your account? Our team is here to help 24/7.
              </Text>

              <View style={styles.supportOptions}>
                <TouchableOpacity
                  onPress={() => Linking.openURL('mailto:support@flowdesk.in')}
                  style={styles.supportOptionBtn}
                >
                  <Mail size={18} color={theme.colors.blue} />
                  <Text style={styles.supportOptionText}>support@flowdesk.in</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Linking.openURL('tel:+918001234567')}
                  style={styles.supportOptionBtn}
                >
                  <Phone size={18} color={theme.colors.green} />
                  <Text style={styles.supportOptionText}>+91 800 123 4567</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Linking.openURL('https://flowdesk.in/docs')}
                  style={styles.supportOptionBtn}
                >
                  <Globe size={18} color={theme.colors.purple} />
                  <Text style={styles.supportOptionText}>Documentation & Guides</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={helpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setHelpModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Help & Support</Text>
                <TouchableOpacity onPress={() => setHelpModalVisible(false)}>
                  <X size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                Need assistance with FlowDesk CRM or your account? Our team is here to help 24/7.
              </Text>

              <View style={styles.supportOptions}>
                <TouchableOpacity
                  onPress={() => Linking.openURL('mailto:support@flowdesk.in')}
                  style={styles.supportOptionBtn}
                >
                  <Mail size={18} color={theme.colors.blue} />
                  <Text style={styles.supportOptionText}>support@flowdesk.in</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Linking.openURL('tel:+918001234567')}
                  style={styles.supportOptionBtn}
                >
                  <Phone size={18} color={theme.colors.green} />
                  <Text style={styles.supportOptionText}>+91 800 123 4567</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Linking.openURL('https://flowdesk.in/docs')}
                  style={styles.supportOptionBtn}
                >
                  <Globe size={18} color={theme.colors.purple} />
                  <Text style={styles.supportOptionText}>Documentation & Guides</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Sign Out Confirmation Modal */}
      {Platform.OS === 'web' ? (
        signOutModalVisible && (
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={() => !isSigningOut && setSignOutModalVisible(false)}
            />
            <View
              style={[
                styles.modalCard,
                styles.signOutCard,
                { position: 'relative', zIndex: 100000, elevation: 100 },
              ]}
            >
              <View style={styles.signOutIconContainer}>
                <LogOut size={26} color={theme.colors.ratings.hot.text} />
              </View>

              <Text style={styles.signOutTitle}>Sign out of FlowDesk?</Text>
              <Text style={styles.signOutDesc}>
                Are you sure you want to sign out? You will need to enter your email and password to access your CRM workspace again.
              </Text>

              <View style={styles.signOutActionsRow}>
                <TouchableOpacity
                  onPress={() => setSignOutModalVisible(false)}
                  disabled={isSigningOut}
                  style={styles.cancelBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  testID="cancel-sign-out-btn"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmLogout}
                  disabled={isSigningOut}
                  style={styles.confirmSignOutBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm Sign Out"
                  testID="confirm-sign-out-btn"
                >
                  {isSigningOut ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmSignOutText}>Sign Out</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={signOutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => !isSigningOut && setSignOutModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={() => !isSigningOut && setSignOutModalVisible(false)}
            />
            <View
              style={[
                styles.modalCard,
                styles.signOutCard,
                { position: 'relative', zIndex: 100, elevation: 20 },
              ]}
            >
              <View style={styles.signOutIconContainer}>
                <LogOut size={26} color={theme.colors.ratings.hot.text} />
              </View>

              <Text style={styles.signOutTitle}>Sign out of FlowDesk?</Text>
              <Text style={styles.signOutDesc}>
                Are you sure you want to sign out? You will need to enter your email and password to access your CRM workspace again.
              </Text>

              <View style={styles.signOutActionsRow}>
                <TouchableOpacity
                  onPress={() => setSignOutModalVisible(false)}
                  disabled={isSigningOut}
                  style={styles.cancelBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmLogout}
                  disabled={isSigningOut}
                  style={styles.confirmSignOutBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm Sign Out"
                >
                  {isSigningOut ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmSignOutText}>Sign Out</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    gap: 14,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2A2A32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    borderRadius: theme.radii.card,
    padding: 16,
    backgroundColor: theme.colors.surface,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  profileName: {
    fontSize: 16,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 3,
  },
  profileTitleCompany: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
  roleBadgeContainer: {
    alignItems: 'flex-end',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridCol: {
    width: '50%',
    padding: 6,
  },
  tileCard: {
    borderRadius: theme.radii.card,
    padding: 16,
    minHeight: 124,
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadgePill: {
    backgroundColor: theme.colors.purple,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tileBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  tileTitle: {
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 2,
  },
  tileDesc: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  listCard: {
    borderRadius: theme.radii.card,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  listBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  listIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
    elevation: 99,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  modalDesc: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: 18,
  },
  supportOptions: {
    gap: 10,
  },
  supportOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: theme.radii.input,
    backgroundColor: theme.colors.surfaceMuted,
    gap: 12,
  },
  supportOptionText: {
    fontSize: 14,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.ink,
  },
  signOutCard: {
    maxWidth: 360,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    zIndex: 10,
    elevation: 10,
  },
  signOutIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signOutTitle: {
    fontSize: 19,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800',
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  signOutDesc: {
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  signOutActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  confirmSignOutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.colors.ratings.hot.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSignOutText: {
    fontSize: 14,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
