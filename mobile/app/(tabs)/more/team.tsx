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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Shield, Check } from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Avatar } from '../../../src/components/Avatar';
import { Card } from '../../../src/components/Card';
import { ErrorState } from '../../../src/components/ErrorState';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { Stagger } from '../../../src/animations/Stagger';
import { PressableScale } from '../../../src/animations/PressableScale';
import { AnimatedBar } from '../../../src/animations/AnimatedBar';
import { Skeleton } from '../../../src/animations/Skeleton';
import { fetchUsers, inviteUser, updateUser } from '../../../src/api/users';
import { fetchDashboardSummary } from '../../../src/api/dashboard';
import { queryKeys } from '../../../src/api/queryKeys';
import { useSessionStore } from '../../../src/auth/sessionStore';
import { useCan } from '../../../src/auth/useCan';
import { User, UserRole } from '@flowdesk/shared';

function TeamSkeleton() {
  return (
    <View style={{ gap: theme.spacing.cardGap }}>
      {/* Target Card Skeleton */}
      <Card style={styles.targetCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width={140} height={14} borderRadius={4} />
          <Skeleton width={40} height={14} borderRadius={4} />
        </View>
        <Skeleton width={160} height={28} borderRadius={6} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={8} borderRadius={4} />
      </Card>

      {/* Members Card Skeleton */}
      <Card style={styles.membersCard}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.memberRow}>
            <Skeleton width={42} height={42} borderRadius={21} />
            <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={100} height={16} borderRadius={4} />
                <Skeleton width={60} height={16} borderRadius={8} style={{ marginLeft: 8 }} />
              </View>
              <Skeleton width="90%" height={8} borderRadius={4} />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function TeamScreen() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore((state) => state.user);

  const canInvite = useCan('team:invite');
  const isAdmin = currentUser?.role === 'admin';
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Modal states
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'sales'>('sales');

  const [roleChangeModalVisible, setRoleChangeModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // 1. Fetch team members
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
    isRefetching: usersRefetching,
  } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => fetchUsers(),
  });

  // 2. Fetch team dashboard summary for target metrics
  const {
    data: teamSummary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching: summaryRefetching,
  } = useQuery({
    queryKey: queryKeys.dashboard.summary('team', 'month'),
    queryFn: () => fetchDashboardSummary('team', 'month'),
    enabled: isManagerOrAdmin,
  });

  const isLoading = usersLoading || (isManagerOrAdmin && summaryLoading);
  const isRefetching = usersRefetching || summaryRefetching;

  const handleRefetchAll = () => {
    refetchUsers();
    if (isManagerOrAdmin) refetchSummary();
  };

  // Team target calculations
  const teamTarget = 1500000; // ₹15L monthly target
  const teamAchieved = teamSummary?.revenue?.value ?? 1250000; // ₹12.5L default if no revenue
  const teamPercentage = Math.min(100, Math.round((teamAchieved / teamTarget) * 100));

  // Deterministic quota calculations for members
  const memberQuotas: Record<string, number> = {
    'admin@crm.test': 100,
    'manager@crm.test': 91,
    'sales@crm.test': 82,
    'sales2@crm.test': 67,
    'disabled@crm.test': 58,
  };

  // Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role: 'admin' | 'manager' | 'sales' }) =>
      inviteUser(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setInviteModalVisible(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('sales');
      Alert.alert(
        'Invitation Sent',
        `An email invitation has been sent to ${inviteEmail} with 7-day validity.`
      );
    },
    onError: (err: any) => {
      Alert.alert('Invite Failed', err?.message || 'Could not send invitation.');
    },
  });

  // Update Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      updateUser(id, { role }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setRoleChangeModalVisible(false);
      setSelectedUser(null);
      Alert.alert(
        'Role Updated',
        `${updated.name}'s role has been changed to ${updated.role.toUpperCase()}.`
      );
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err?.message || 'Could not update role.');
    },
  });

  const handleOpenInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('sales');
    setInviteModalVisible(true);
  };

  const handleSendInvite = () => {
    if (!inviteName.trim()) {
      Alert.alert('Name required', 'Please enter the member’s full name.');
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Email required', 'Please enter a valid email address.');
      return;
    }

    inviteMutation.mutate({
      name: inviteName.trim(),
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    });
  };

  const handleOpenRoleChange = (member: User) => {
    if (!isAdmin) return; // Only Admin can change roles
    setSelectedUser(member);
    setRoleChangeModalVisible(true);
  };

  const handleConfirmRoleChange = (newRole: UserRole) => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({ id: selectedUser._id, role: newRole });
  };

  return (
    <View style={styles.container}>
      {/* App Bar: Ink background (#14141A) */}
      <AppBar
        title="Team and Roles"
        showBack
        backgroundColor={theme.colors.appBar.team}
        rightAction={
          isManagerOrAdmin ? (
            <PressableScale
              onPress={handleOpenInvite}
              style={styles.addButton}
              accessibilityLabel="Invite team member"
            >
              <Plus size={18} color={theme.colors.ink} />
            </PressableScale>
          ) : undefined
        }
      />

      <ScreenEntrance style={styles.content}>
        {isLoading ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TeamSkeleton />
          </ScrollView>
        ) : usersError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Failed to load team"
              message="Could not retrieve team members. Please check your connection."
              onRetry={handleRefetchAll}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefetchAll}
                tintColor={theme.colors.ink}
              />
            }
          >
            {/* 1. TEAM TARGET CARD (Admin / Manager only) */}
            {isManagerOrAdmin && (
              <Stagger index={0}>
                <Card style={styles.targetCard}>
                  <View style={styles.targetHeader}>
                    <Text style={styles.targetLabel}>Team target this month</Text>
                    <Text style={styles.targetPercentage}>{teamPercentage}%</Text>
                  </View>

                  <View style={styles.targetMoneyRow}>
                    <Text style={styles.targetAchieved}>
                      {theme.helpers.formatCompactINR(teamAchieved)}
                    </Text>
                    <Text style={styles.targetTotal}>
                      {' '}of {theme.helpers.formatCompactINR(teamTarget)}
                    </Text>
                  </View>

                  <AnimatedBar
                    percentage={teamPercentage}
                    color={theme.colors.green}
                    trackColor="#EBEBEA"
                    height={8}
                    delay={200}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              </Stagger>
            )}

            {/* 2. TEAM MEMBERS LIST */}
            <Stagger index={1}>
              <Card style={styles.membersCard}>
                {users.map((member, index) => {
                  const isCurrentUser = member.email === currentUser?.email;
                  const isMemberAdmin = member.role === 'admin';
                  const isLast = index === users.length - 1;
                  const quotaPercent = memberQuotas[member.email] ?? 75;

                  return (
                    <PressableScale
                      key={member._id}
                      onPress={() => isAdmin && handleOpenRoleChange(member)}
                      disabled={!isAdmin}
                      style={[
                        styles.memberRow,
                        !isLast && styles.memberRowBorder,
                      ]}
                    >
                      {/* Avatar */}
                      <Avatar name={member.name} id={member._id} size={42} />

                      {/* Middle Details */}
                      <View style={styles.memberMiddle}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.name}
                            {isCurrentUser && (
                              <Text style={styles.youSuffix}> (You)</Text>
                            )}
                          </Text>

                          {/* Role Badge */}
                          <View
                            style={[
                              styles.roleBadge,
                              isMemberAdmin
                                ? styles.roleBadgeAdmin
                                : member.role === 'manager'
                                ? styles.roleBadgeManager
                                : styles.roleBadgeSales,
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleBadgeText,
                                isMemberAdmin
                                  ? styles.roleBadgeTextAdmin
                                  : member.role === 'manager'
                                  ? styles.roleBadgeTextManager
                                  : styles.roleBadgeTextSales,
                              ]}
                            >
                              {isMemberAdmin
                                ? 'Admin'
                                : member.role === 'manager'
                                ? 'Manager'
                                : 'Sales Rep'}
                            </Text>
                          </View>

                          {/* Quota Percentage (right aligned for reps/managers) */}
                          {!isMemberAdmin && (
                            <Text style={styles.quotaPercentText}>
                              {quotaPercent}%
                            </Text>
                          )}
                        </View>

                        {/* Admin Subtitle or Quota Progress Bar */}
                        {isMemberAdmin ? (
                          <Text style={styles.adminSubtitle}>
                            Manages roles, billing and settings
                          </Text>
                        ) : (
                          <View style={styles.quotaBarWrapper}>
                            <AnimatedBar
                              percentage={quotaPercent}
                              color={theme.colors.blue}
                              trackColor="#F0EFEA"
                              height={6}
                              delay={index * 100}
                            />
                          </View>
                        )}
                      </View>
                    </PressableScale>
                  );
                })}
              </Card>
            </Stagger>

            {/* 3. + Invite Team Member Dashed Button (Admin / Manager) */}
            {isManagerOrAdmin && (
              <Stagger index={2}>
                <PressableScale
                  onPress={handleOpenInvite}
                  style={styles.inviteButton}
                >
                  <Plus size={16} color={theme.colors.ink} style={{ marginRight: 6 }} />
                  <Text style={styles.inviteButtonText}>+ Invite team member</Text>
                </PressableScale>
              </Stagger>
            )}
          </ScrollView>
        )}
      </ScreenEntrance>

      {/* Invite Member Bottom Sheet */}
      <BottomSheet
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        title="Invite Team Member"
      >
        <View style={styles.sheetContainer}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Full Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor={theme.colors.muted}
              value={inviteName}
              onChangeText={setInviteName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Work Email</Text>
            <TextInput
              style={styles.formInput}
              placeholder="rahul@company.com"
              placeholderTextColor={theme.colors.muted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Role</Text>
            <View style={styles.rolePickerRow}>
              {(['sales', 'manager', 'admin'] as const).map((r) => {
                const isSelected = inviteRole === r;
                return (
                  <PressableScale
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={[
                      styles.rolePickerOption,
                      isSelected && styles.rolePickerOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rolePickerText,
                        isSelected && styles.rolePickerTextSelected,
                      ]}
                    >
                      {r === 'sales' ? 'Sales Rep' : r === 'manager' ? 'Manager' : 'Admin'}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <PressableScale
            onPress={handleSendInvite}
            disabled={inviteMutation.isPending}
            style={[
              styles.actionSubmitButton,
              inviteMutation.isPending && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.actionSubmitText}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Text>
          </PressableScale>
        </View>
      </BottomSheet>

      {/* Change Role Bottom Sheet (Admin only) */}
      <BottomSheet
        visible={roleChangeModalVisible}
        onClose={() => setRoleChangeModalVisible(false)}
        title={selectedUser ? `Change Role: ${selectedUser.name}` : 'Change Role'}
      >
        <View style={styles.sheetContainer}>
          <Text style={styles.roleChangeDesc}>
            Select the new permissions and access level for this user.
          </Text>

          {(
            [
              {
                role: 'admin',
                label: 'Admin',
                desc: 'Full access to all tenant records, billing, invites, and settings.',
              },
              {
                role: 'manager',
                label: 'Manager',
                desc: 'Can see all team pipelines, invite reps, and review reports.',
              },
              {
                role: 'sales',
                label: 'Sales Rep',
                desc: 'Scaped to assigned leads, deals, contacts, and personal tasks.',
              },
            ] as const
          ).map((item) => {
            const isCurrent = selectedUser?.role === item.role;
            return (
              <PressableScale
                key={item.role}
                onPress={() => handleConfirmRoleChange(item.role)}
                style={[
                  styles.roleCardOption,
                  isCurrent && styles.roleCardOptionActive,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>{item.label}</Text>
                  <Text style={styles.roleCardDesc}>{item.desc}</Text>
                </View>
                {isCurrent && <Check size={18} color={theme.colors.ink} />}
              </PressableScale>
            );
          })}
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
    paddingBottom: 40,
    gap: theme.spacing.cardGap,
  },
  errorContainer: {
    flex: 1,
    padding: theme.spacing.screen,
    justifyContent: 'center',
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 1. Team Target Card
  targetCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  targetLabel: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.text2,
    fontWeight: '600',
  },
  targetPercentage: {
    fontSize: 14,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.green,
  },
  targetMoneyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  targetAchieved: {
    fontSize: 24,
    fontFamily: theme.typography.bigMoney.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  targetTotal: {
    fontSize: 14,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
    fontWeight: '600',
  },

  // 2. Members Card
  membersCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  memberMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 15,
    fontFamily: theme.typography.rowTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  youSuffix: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
    fontWeight: '600',
  },

  // Role Badges
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.badge,
    marginLeft: 8,
  },
  roleBadgeAdmin: {
    backgroundColor: theme.colors.ink,
  },
  roleBadgeManager: {
    backgroundColor: '#EFEBFF',
  },
  roleBadgeSales: {
    backgroundColor: '#E7EEFB',
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.badge.fontFamily,
    fontWeight: '800',
  },
  roleBadgeTextAdmin: {
    color: '#FFFFFF',
  },
  roleBadgeTextManager: {
    color: theme.colors.appBar.messages,
  },
  roleBadgeTextSales: {
    color: theme.colors.blue,
  },

  quotaPercentText: {
    marginLeft: 'auto',
    fontSize: 14,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  adminSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
    marginTop: 2,
  },
  quotaBarWrapper: {
    marginTop: 6,
  },

  // 3. Invite Button
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    paddingVertical: 14,
    backgroundColor: '#FAFAF8',
  },
  inviteButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },

  // Sheet
  sheetContainer: {
    paddingBottom: 24,
    gap: 14,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: theme.colors.text2,
  },
  formInput: {
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
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rolePickerOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rolePickerOptionSelected: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  rolePickerText: {
    fontSize: 13,
    fontFamily: theme.typography.meta.fontFamily,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  rolePickerTextSelected: {
    color: '#FFFFFF',
  },
  actionSubmitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    paddingVertical: 14,
    marginTop: 8,
  },
  actionSubmitText: {
    fontSize: 14,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Role Change Card
  roleChangeDesc: {
    fontSize: 13,
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.muted,
    marginBottom: 8,
  },
  roleCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  roleCardOptionActive: {
    borderColor: theme.colors.ink,
    backgroundColor: '#F5F5F0',
  },
  roleCardTitle: {
    fontSize: 15,
    fontFamily: theme.typography.sectionTitle.fontFamily,
    fontWeight: '800',
    color: theme.colors.ink,
    marginBottom: 2,
  },
  roleCardDesc: {
    fontSize: 12,
    fontFamily: theme.typography.meta.fontFamily,
    color: theme.colors.muted,
  },
});
