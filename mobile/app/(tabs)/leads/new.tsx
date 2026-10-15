import React from 'react';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { createLead } from '../../../src/api/leads';
import { queryKeys } from '../../../src/api/queryKeys';
import { leadSchema, LeadInput, LeadRating, LeadStatus, LeadSource } from '@flowdesk/shared';

export default function NewLeadScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      value: 0,
      source: 'website',
      status: 'new',
      rating: 'warm',
      notes: '',
    },
  });

  const selectedRating = watch('rating');
  const selectedStatus = watch('status');
  const selectedSource = watch('source');

  const createMutation = useMutation({
    mutationFn: (data: LeadInput) => createLead(data),
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      showToast(`Lead "${newLead.name}" created`, { type: 'success' });
      router.back();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create lead';
      showToast(msg, { type: 'error' });
    },
  });

  const onSubmit = (data: LeadInput) => {
    createMutation.mutate(data);
  };

  return (
    <View style={styles.container}>
      <AppBar
        title="New Lead"
        showBack
        backgroundColor={theme.colors.appBar.leads}
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.formCard}>
            {/* Name */}
            <Text style={styles.label}>Lead Name *</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="e.g. Rahul Sharma"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name.message}</Text>
            )}

            {/* Company */}
            <Text style={styles.label}>Company *</Text>
            <Controller
              control={control}
              name="company"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.company && styles.inputError]}
                  placeholder="e.g. Apex Tech Solutions"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.company && (
              <Text style={styles.errorText}>{errors.company.message}</Text>
            )}

            {/* Email */}
            <Text style={styles.label}>Email *</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="rahul@apextech.com"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}

            {/* Phone */}
            <Text style={styles.label}>Phone *</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder="+91 98765 43210"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="phone-pad"
                />
              )}
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone.message}</Text>
            )}

            {/* Deal Value */}
            <Text style={styles.label}>Estimated Value (₹)</Text>
            <Controller
              control={control}
              name="value"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="50000"
                  onBlur={onBlur}
                  onChangeText={(val) => onChange(val ? Number(val) : 0)}
                  value={value ? String(value) : ''}
                  keyboardType="numeric"
                />
              )}
            />

            {/* Rating Selector */}
            <Text style={styles.label}>Rating</Text>
            <View style={styles.pillsContainer}>
              {(['hot', 'warm', 'cold'] as LeadRating[]).map((r) => {
                const isActive = selectedRating === r;
                return (
                  <PressableScale
                    key={r}
                    onPress={() => setValue('rating', r)}
                    style={[
                      styles.pill,
                      isActive && styles.pillActive,
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

            {/* Status Selector */}
            <Text style={styles.label}>Status</Text>
            <View style={styles.pillsContainer}>
              {(['new', 'contacted', 'qualified', 'converted', 'lost'] as LeadStatus[]).map((st) => {
                const isActive = selectedStatus === st;
                return (
                  <PressableScale
                    key={st}
                    onPress={() => setValue('status', st)}
                    style={[
                      styles.pill,
                      isActive && styles.pillActive,
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

            {/* Source Selector */}
            <Text style={styles.label}>Lead Source</Text>
            <View style={styles.pillsContainer}>
              {(['website', 'referral', 'social', 'email', 'event', 'other'] as LeadSource[]).map((src) => {
                const isActive = selectedSource === src;
                return (
                  <PressableScale
                    key={src}
                    onPress={() => setValue('source', src)}
                    style={[
                      styles.pill,
                      isActive && styles.pillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isActive && styles.pillTextActive,
                      ]}
                    >
                      {src.toUpperCase()}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={styles.label}>Notes</Text>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Additional context or meeting notes..."
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}
            />

            {/* Submit Button */}
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
                  <Text style={styles.submitBtnText}>Create Lead</Text>
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
  textArea: {
    height: 80,
  },
  errorText: {
    fontSize: 11,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.ratings.hot.text,
    marginTop: 4,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  pillActive: {
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
