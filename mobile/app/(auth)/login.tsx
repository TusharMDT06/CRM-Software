import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';

import { theme } from '../../src/theme';
import { FloatingLogo } from '../../src/animations/FloatingLogo';
import { PressableScale } from '../../src/animations/PressableScale';
import { useAuth } from '../../src/auth/useAuth';
import { showToast } from '../../src/components/Toast';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      showToast('Welcome back!', { type: 'success' });
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Invalid credentials. Please try again.';
      setErrorMessage(msg);
      showToast(msg, { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(demoEmail, 'Password@123');
      showToast('Welcome back!', { type: 'success' });
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Invalid credentials. Please try again.';
      setErrorMessage(msg);
      showToast(msg, { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24) + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Ink Hero Section */}
        <View style={styles.heroSection}>
          <FloatingLogo size={68} />

          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>FlowDesk</Text>
            <View style={styles.crmTag}>
              <Text style={styles.crmTagText}>CRM</Text>
            </View>
          </View>

          <Text style={styles.brandTagline}>
            Enterprise Sales & Pipeline CRM platform
          </Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Sign in to your account</Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email address</Text>
            <View
              style={[
                styles.inputWrapper,
                isEmailFocused && styles.inputWrapperFocused,
              ]}
            >
              <Mail
                size={18}
                color={isEmailFocused ? theme.colors.blue : theme.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="name@company.com"
                placeholderTextColor={theme.colors.muted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!isSubmitting}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordHeader}>
              <Text style={styles.inputLabel}>Password</Text>
              <PressableScale
                onPress={() => showToast('Please reset password via web portal')}
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </PressableScale>
            </View>
            <View
              style={[
                styles.inputWrapper,
                isPasswordFocused && styles.inputWrapperFocused,
              ]}
            >
              <Lock
                size={18}
                color={isPasswordFocused ? theme.colors.blue : theme.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••••••"
                placeholderTextColor={theme.colors.muted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isSubmitting}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <PressableScale
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff size={18} color={theme.colors.muted} />
                ) : (
                  <Eye size={18} color={theme.colors.muted} />
                )}
              </PressableScale>
            </View>
          </View>

          {/* Sign In Button */}
          <PressableScale
            onPress={handleLogin}
            disabled={isSubmitting}
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Text style={styles.submitBtnText}>Sign In</Text>
                <ArrowRight size={18} color="#FFFFFF" style={styles.submitIcon} />
              </View>
            )}
          </PressableScale>

          {/* Demo account quick fills */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Quick Demo Login:</Text>
            <View style={styles.demoChips}>
              <PressableScale
                onPress={() => handleFillDemo('admin@crm.test')}
                style={styles.demoChip}
              >
                <Text style={styles.demoChipText}>Admin</Text>
              </PressableScale>
              <PressableScale
                onPress={() => handleFillDemo('manager@crm.test')}
                style={styles.demoChip}
              >
                <Text style={styles.demoChipText}>Manager</Text>
              </PressableScale>
              <PressableScale
                onPress={() => handleFillDemo('sales@crm.test')}
                style={styles.demoChip}
              >
                <Text style={styles.demoChipText}>Sales Rep</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.ink,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.screen,
    justifyContent: 'center',
    minHeight: '100%',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontFamily: theme.typography.families.extraBold,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  crmTag: {
    backgroundColor: theme.colors.orange,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.badge,
  },
  crmTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: {
    fontSize: 18,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.radii.badge,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: theme.colors.ratings.hot.text,
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
  },
  inputGroup: {
    marginBottom: 16,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
    marginBottom: 6,
  },
  forgotLink: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.blue,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.blue,
    backgroundColor: theme.colors.surface,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: theme.colors.ink,
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    cursor: 'pointer' as any,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  submitIcon: {
    marginLeft: 2,
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  demoTitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.muted,
    marginBottom: 8,
  },
  demoChips: {
    flexDirection: 'row',
    gap: 8,
  },
  demoChip: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.chip,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  demoChipText: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.text2,
  },
  devSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.radii.chip,
    cursor: 'pointer' as any,
  },
  devIcon: {
    marginRight: 6,
  },
  devBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
  },
});
