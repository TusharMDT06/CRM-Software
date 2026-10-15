import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Server,
  Globe,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  X,
  Radio,
  Wifi,
} from 'lucide-react-native';

import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';
import {
  getServerUrl,
  setServerUrl,
  resetServerUrl,
  DEFAULT_SERVER_URL,
  testServerConnection,
} from '../api/serverConfig';
import { showToast } from './Toast';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ServerSettingsModal({ visible, onClose }: ServerSettingsModalProps) {
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    latencyMs?: number;
    message?: string;
  }>({ tested: false, ok: false });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCurrentUrl();
    }
  }, [visible]);

  const loadCurrentUrl = async () => {
    const url = await getServerUrl();
    setCurrentUrl(url);
    setInputUrl(url);
    setTestResult({ tested: false, ok: false });
  };

  const handleTest = async () => {
    const target = inputUrl.trim();
    if (!target) {
      setTestResult({ tested: true, ok: false, message: 'Please enter a valid URL' });
      return;
    }
    setIsTesting(true);
    setTestResult({ tested: false, ok: false });

    try {
      const res = await testServerConnection(target);
      setTestResult({
        tested: true,
        ok: res.ok,
        latencyMs: res.latencyMs,
        message: res.ok
          ? `Server reachable! (${res.latencyMs}ms)`
          : res.message || 'Unable to connect to server',
      });
    } catch (e: any) {
      setTestResult({
        tested: true,
        ok: false,
        message: e?.message || 'Network error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const clean = inputUrl.trim();
    if (!clean) {
      showToast('URL cannot be empty', { type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      await setServerUrl(clean);
      setCurrentUrl(clean);
      showToast('Server URL saved! All requests will use this backend.', { type: 'success' });
      onClose();
    } catch {
      showToast('Failed to save Server URL', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      const def = await resetServerUrl();
      setCurrentUrl(def);
      setInputUrl(def);
      setTestResult({ tested: false, ok: false });
      showToast('Reset to default backend URL', { type: 'info' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrapper}>
                <Server size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.title}>Backend Connection</Text>
                <Text style={styles.subtitle}>Production Server & Network Settings</Text>
              </View>
            </View>
            <PressableScale onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={theme.colors.muted} />
            </PressableScale>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Active URL Banner */}
            <View style={styles.activeBanner}>
              <View style={styles.activeDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeLabel}>ACTIVE BACKEND URL:</Text>
                <Text style={styles.activeUrlText} numberOfLines={1}>
                  {currentUrl || DEFAULT_SERVER_URL}
                </Text>
              </View>
            </View>

            {/* Instruction */}
            <Text style={styles.helperText}>
              To access FlowDesk CRM on cellular mobile data (4G/5G) or any Wi-Fi, enter your public
              HTTPS production backend URL below.
            </Text>

            {/* URL Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Server Base URL (HTTP / HTTPS)</Text>
              <View style={styles.inputRow}>
                <Globe size={18} color={theme.colors.blue} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="https://your-crm-server.onrender.com"
                  placeholderTextColor={theme.colors.muted}
                  value={inputUrl}
                  onChangeText={(text) => {
                    setInputUrl(text);
                    if (testResult.tested) setTestResult({ tested: false, ok: false });
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </View>

            {/* Test Connection Button */}
            <PressableScale
              onPress={handleTest}
              disabled={isTesting}
              style={[styles.testBtn, isTesting && { opacity: 0.7 }]}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color={theme.colors.blue} />
              ) : (
                <Radio size={16} color={theme.colors.blue} />
              )}
              <Text style={styles.testBtnText}>
                {isTesting ? 'Testing Connectivity...' : 'Test Server Connectivity'}
              </Text>
            </PressableScale>

            {/* Test Status Banner */}
            {testResult.tested && (
              <View
                style={[
                  styles.resultBanner,
                  testResult.ok ? styles.resultSuccess : styles.resultError,
                ]}
              >
                {testResult.ok ? (
                  <CheckCircle size={18} color="#10B981" style={{ marginRight: 8 }} />
                ) : (
                  <AlertCircle size={18} color="#EF4444" style={{ marginRight: 8 }} />
                )}
                <Text
                  style={[
                    styles.resultText,
                    testResult.ok ? { color: '#047857' } : { color: '#B91C1C' },
                  ]}
                >
                  {testResult.message}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <PressableScale onPress={handleReset} style={styles.resetBtn}>
                <RotateCcw size={15} color={theme.colors.text2} style={{ marginRight: 6 }} />
                <Text style={styles.resetBtnText}>Default</Text>
              </PressableScale>

              <PressableScale
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save & Apply</Text>
                )}
              </PressableScale>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceMuted,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 20,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: theme.radii.input,
    padding: 12,
    marginBottom: 14,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 10,
  },
  activeLabel: {
    fontSize: 10,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.blue,
    letterSpacing: 0.5,
  },
  activeUrlText: {
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.text2,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputSection: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600',
    color: theme.colors.ink,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: theme.colors.ink,
    fontSize: 13,
    fontFamily: theme.typography.families.regular,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    paddingVertical: 10,
    borderRadius: theme.radii.input,
    marginTop: 4,
    marginBottom: 12,
  },
  testBtnText: {
    color: theme.colors.blue,
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: theme.radii.badge,
    borderWidth: 1,
    marginBottom: 16,
  },
  resultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  resultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resultText: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    paddingBottom: 10,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    height: 44,
    backgroundColor: theme.colors.surfaceMuted,
  },
  resetBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
  },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    height: 44,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
