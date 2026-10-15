import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { createDeal } from '../../../src/api/deals';
import { fetchAccounts } from '../../../src/api/accounts';
import { fetchContacts } from '../../../src/api/contacts';
import { queryKeys } from '../../../src/api/queryKeys';
import { dealSchema, DealInput, DealStage } from '@flowdesk/shared';

const STAGES: { key: DealStage; label: string }[] = [
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

export default function NewDealScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const defaultCloseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DealInput>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: '',
      account: '',
      contact: '',
      amount: 0,
      stage: 'qualified',
      expectedClose: defaultCloseDate,
    },
  });

  const selectedStage = watch('stage');
  const selectedAccount = watch('account');
  const selectedContact = watch('contact');

  // Load existing accounts and contacts for picker
  const { data: accountsData } = useQuery({
    queryKey: queryKeys.accounts.list({ limit: 50 }),
    queryFn: () => fetchAccounts({ limit: 50 }),
  });

  const { data: contactsData } = useQuery({
    queryKey: queryKeys.contacts.list({ limit: 50 }),
    queryFn: () => fetchContacts({ limit: 50 }),
  });

  const accounts = accountsData?.data || [];
  const contacts = contactsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: DealInput) => createDeal(data),
    onSuccess: (newDeal) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      showToast(`Deal "${newDeal.title}" created`, { type: 'success' });
      router.back();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create deal';
      showToast(msg, { type: 'error' });
    },
  });

  const onSubmit = (data: DealInput) => {
    createMutation.mutate(data);
  };

  return (
    <View style={styles.container}>
      <AppBar
        title="New Deal"
        showBack
        backgroundColor={theme.colors.appBar.deals}
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.formCard}>
            {/* Title */}
            <Text style={styles.label}>Deal Title *</Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder="e.g. Enterprise Cloud Migration"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.title && (
              <Text style={styles.errorText}>{errors.title.message}</Text>
            )}

            {/* Amount */}
            <Text style={styles.label}>Amount (₹) *</Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.amount && styles.inputError]}
                  placeholder="150000"
                  onBlur={onBlur}
                  onChangeText={(val) => onChange(val ? Number(val) : 0)}
                  value={value ? String(value) : ''}
                  keyboardType="numeric"
                />
              )}
            />
            {errors.amount && (
              <Text style={styles.errorText}>{errors.amount.message}</Text>
            )}

            {/* Select Account */}
            <Text style={styles.label}>Account / Company *</Text>
            {accounts.length === 0 ? (
              <TextInput
                style={[styles.input, errors.account && styles.inputError]}
                placeholder="Account ID"
                value={selectedAccount}
                onChangeText={(val) => setValue('account', val)}
              />
            ) : (
              <View style={styles.pillsRow}>
                {accounts.slice(0, 8).map((acc) => {
                  const isSel = selectedAccount === acc._id;
                  return (
                    <PressableScale
                      key={acc._id}
                      onPress={() => setValue('account', acc._id)}
                      style={[
                        styles.pickerPill,
                        isSel && styles.pickerPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerPillText,
                          isSel && styles.pickerPillTextActive,
                        ]}
                      >
                        {acc.name}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            )}
            {errors.account && (
              <Text style={styles.errorText}>Please select an account</Text>
            )}

            {/* Select Contact */}
            <Text style={styles.label}>Primary Contact *</Text>
            {contacts.length === 0 ? (
              <TextInput
                style={[styles.input, errors.contact && styles.inputError]}
                placeholder="Contact ID"
                value={selectedContact}
                onChangeText={(val) => setValue('contact', val)}
              />
            ) : (
              <View style={styles.pillsRow}>
                {contacts.slice(0, 8).map((con) => {
                  const isSel = selectedContact === con._id;
                  return (
                    <PressableScale
                      key={con._id}
                      onPress={() => setValue('contact', con._id)}
                      style={[
                        styles.pickerPill,
                        isSel && styles.pickerPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerPillText,
                          isSel && styles.pickerPillTextActive,
                        ]}
                      >
                        {con.firstName} {con.lastName}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            )}
            {errors.contact && (
              <Text style={styles.errorText}>Please select a contact</Text>
            )}

            {/* Pipeline Stage */}
            <Text style={styles.label}>Pipeline Stage</Text>
            <View style={styles.pillsRow}>
              {STAGES.map((s) => {
                const isActive = selectedStage === s.key;
                return (
                  <PressableScale
                    key={s.key}
                    onPress={() => setValue('stage', s.key)}
                    style={[
                      styles.pickerPill,
                      isActive && styles.pickerPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerPillText,
                        isActive && styles.pickerPillTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {/* Submit */}
            <PressableScale
              onPress={handleSubmit(onSubmit)}
              style={styles.submitBtn}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Create Deal</Text>
                </View>
              )}
            </PressableScale>
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
    paddingBottom: 90,
  },
  formCard: {
    padding: 18,
  },
  label: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.ink,
  },
  inputError: {
    borderColor: theme.colors.ratings.hot.text,
  },
  errorText: {
    fontSize: 11,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.ratings.hot.text,
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  pickerPillActive: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.ink,
  },
  pickerPillText: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.text2,
  },
  pickerPillTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
});
