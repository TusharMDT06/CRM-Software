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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { showToast } from '../../../src/components/Toast';
import { PressableScale } from '../../../src/animations/PressableScale';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import { createContact } from '../../../src/api/contacts';
import { fetchAccounts } from '../../../src/api/accounts';
import { queryKeys } from '../../../src/api/queryKeys';
import { contactSchema, ContactInput } from '@flowdesk/shared';

export default function NewContactScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      account: '',
    },
  });

  const selectedAccount = watch('account');

  // Load accounts for picker
  const { data: accountsData } = useQuery({
    queryKey: queryKeys.accounts.list({ limit: 50 }),
    queryFn: () => fetchAccounts({ limit: 50 }),
  });

  const accounts = accountsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: ContactInput) => createContact(data),
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      showToast(
        `Contact "${newContact.firstName} ${newContact.lastName}" created`,
        { type: 'success' }
      );
      router.back();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create contact';
      showToast(msg, { type: 'error' });
    },
  });

  const onSubmit = (data: ContactInput) => {
    createMutation.mutate(data);
  };

  return (
    <View style={styles.container}>
      <AppBar
        title="New Contact"
        showBack
        backgroundColor={theme.colors.appBar.contacts}
      />

      <ScreenEntrance style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.formCard}>
            {/* First Name */}
            <Text style={styles.label}>First Name *</Text>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  placeholder="e.g. Priya"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.firstName && (
              <Text style={styles.errorText}>{errors.firstName.message}</Text>
            )}

            {/* Last Name */}
            <Text style={styles.label}>Last Name *</Text>
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  placeholder="e.g. Verma"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.lastName && (
              <Text style={styles.errorText}>{errors.lastName.message}</Text>
            )}

            {/* Email */}
            <Text style={styles.label}>Email *</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="priya@company.com"
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
            <Text style={styles.label}>Phone</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="phone-pad"
                />
              )}
            />

            {/* Job Title */}
            <Text style={styles.label}>Job Title / Role</Text>
            <Controller
              control={control}
              name="jobTitle"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. VP of Operations"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            {/* Select Account */}
            <Text style={styles.label}>Company Account *</Text>
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
              <Text style={styles.errorText}>Please select a company account</Text>
            )}

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
                  <Text style={styles.submitBtnText}>Create Contact</Text>
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
