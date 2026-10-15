import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { showToast } from '../../../src/components/Toast';
import { useSessionStore } from '../../../src/auth/sessionStore';
import { apiClient } from '../../../src/api/client';

export default function SettingsScreen() {
  const { biometricEnabled, setBiometricEnabled } = useSessionStore();
  const queryClient = useQueryClient();

  // 1. Fetch Notification Preferences
  const { data: prefData } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: async () => {
      const res = await apiClient.get('/notifications/preferences');
      return res.data?.preferences || {};
    },
  });

  const [leadAssigned, setLeadAssigned] = useState(true);
  const [newLeadCaptured, setNewLeadCaptured] = useState(true);
  const [taskDue, setTaskDue] = useState(true);
  const [dealStageChanged, setDealStageChanged] = useState(true);
  const [inboundSms, setInboundSms] = useState(true);
  const [mentions, setMentions] = useState(true);

  useEffect(() => {
    if (prefData) {
      if (prefData.lead_assigned) setLeadAssigned(prefData.lead_assigned.inApp !== false);
      if (prefData.new_lead) setNewLeadCaptured(prefData.new_lead.inApp !== false);
      if (prefData.task_due_today) setTaskDue(prefData.task_due_today.inApp !== false);
      if (prefData.deal_stage_changed) setDealStageChanged(prefData.deal_stage_changed.inApp !== false);
      if (prefData.inbound_sms) setInboundSms(prefData.inbound_sms.inApp !== false);
      if (prefData.mention) setMentions(prefData.mention.inApp !== false);
    }
  }, [prefData]);

  // 2. Mutation for Saving Preferences
  const updatePrefMutation = useMutation({
    mutationFn: async (updated: Record<string, { inApp: boolean; email?: boolean }>) => {
      await apiClient.put('/notifications/preferences', { preferences: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
    onError: () => {
      showToast('Failed to save preference', { type: 'error' });
    },
  });

  const handleTogglePref = (
    key: string,
    val: boolean,
    setter: (v: boolean) => void,
    label: string
  ) => {
    setter(val);
    const existing = prefData?.[key] || { inApp: true, email: false };
    updatePrefMutation.mutate({
      [key]: { ...existing, inApp: val },
    });
    showToast(`${label} ${val ? 'enabled' : 'disabled'}`, { type: 'success' });
  };

  const handleToggleBiometrics = async (val: boolean) => {
    if (!val) {
      setBiometricEnabled(false);
      showToast('Biometric lock disabled', { type: 'info' });
      return;
    }

    if (Platform.OS === 'web') {
      setBiometricEnabled(true);
      showToast('Biometric lock enabled (simulated on web)', { type: 'success' });
      return;
    }

    try {
      const LocalAuthentication = require('expo-local-authentication');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        showToast('No biometrics enrolled on this device', { type: 'warning' });
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Biometric Lock for FlowDesk',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        setBiometricEnabled(true);
        showToast('Biometric lock enabled (2 min timeout)', { type: 'success' });
      } else {
        showToast('Biometric authentication cancelled', { type: 'info' });
      }
    } catch {
      showToast('Biometric setup failed', { type: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      <AppBar
        title="Settings"
        showBack
        backgroundColor={theme.colors.appBar.more}
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notification Preferences */}
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>Push Notifications</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.row}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Lead Assigned to Me</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Notify immediately when a new lead is assigned
                </Text>
              </View>
              <Switch
                value={leadAssigned}
                onValueChange={(val) =>
                  handleTogglePref('lead_assigned', val, setLeadAssigned, 'Lead notifications')
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle lead assigned notifications"
              />
            </View>

            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>New Captured Lead</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Alert for leads incoming from Google/Meta/Forms
                </Text>
              </View>
              <Switch
                value={newLeadCaptured}
                onValueChange={(val) =>
                  handleTogglePref('new_lead', val, setNewLeadCaptured, 'Lead capture alerts')
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle new lead notifications"
              />
            </View>

            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Tasks Due & Overdue</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Reminder 30 minutes before task due time
                </Text>
              </View>
              <Switch
                value={taskDue}
                onValueChange={(val) => {
                  setTaskDue(val);
                  updatePrefMutation.mutate({
                    task_due_today: { inApp: val, email: false },
                    task_overdue: { inApp: val, email: false },
                  });
                  showToast(`Task reminders ${val ? 'enabled' : 'disabled'}`, { type: 'success' });
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle task notifications"
              />
            </View>

            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Deal Stage Changed</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Updates when any of your active deals move stages
                </Text>
              </View>
              <Switch
                value={dealStageChanged}
                onValueChange={(val) =>
                  handleTogglePref('deal_stage_changed', val, setDealStageChanged, 'Deal stage alerts')
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle deal stage notifications"
              />
            </View>

            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Inbound SMS & Messages</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Notify on incoming customer text replies
                </Text>
              </View>
              <Switch
                value={inboundSms}
                onValueChange={(val) =>
                  handleTogglePref('inbound_sms', val, setInboundSms, 'Inbound message alerts')
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle inbound message notifications"
              />
            </View>

            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Mentions</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Notify when someone mentions you in an activity or note
                </Text>
              </View>
              <Switch
                value={mentions}
                onValueChange={(val) =>
                  handleTogglePref('mention', val, setMentions, 'Mention alerts')
                }
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle mention notifications"
              />
            </View>
          </Card>

          {/* Security & Biometrics */}
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>Security</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.row}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Biometric Lock (Face/Touch ID)</Text>
                <Text style={styles.rowSub} maxFontSizeMultiplier={1.3}>
                  Require biometrics after app is backgrounded 2 min
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: theme.colors.border, true: theme.colors.green }}
                accessibilityLabel="Toggle biometric lock"
              />
            </View>
          </Card>

          {/* App Info */}
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>About</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.row}>
              <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>App Version</Text>
              <Text style={styles.versionText} maxFontSizeMultiplier={1.3}>FlowDesk Mobile v1.0.0 (Build 42)</Text>
            </View>
            <View style={[styles.row, styles.borderTop]}>
              <Text style={styles.rowLabel} maxFontSizeMultiplier={1.3}>Environment</Text>
              <Text style={styles.versionText} maxFontSizeMultiplier={1.3}>Production Connected</Text>
            </View>
          </Card>
        </ScrollView>
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
  scrollContent: {
    padding: theme.spacing.screen,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  card: {
    borderRadius: theme.radii.card,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  labelContainer: {
    flex: 1,
    marginRight: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    marginTop: 2,
  },
  versionText: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
  },
});
