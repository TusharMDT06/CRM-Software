import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Lock, Fingerprint, ShieldCheck } from 'lucide-react-native';
import { theme } from '../theme';
import { FloatingLogo } from '../animations/FloatingLogo';
import { PressableScale } from '../animations/PressableScale';
import { useBiometricStore, promptBiometricUnlock } from '../auth/biometrics';

export const BiometricLockModal: React.FC = () => {
  const { isLocked, isAuthenticating, biometryType } = useBiometricStore();

  useEffect(() => {
    if (isLocked) {
      promptBiometricUnlock();
    }
  }, [isLocked]);

  if (!isLocked) return null;

  return (
    <Modal visible={isLocked} transparent={false} animationType="fade">
      <View style={styles.container}>
        <View style={styles.content}>
          <FloatingLogo size={72} />

          <Text style={styles.title}>FlowDesk is Locked</Text>
          <Text style={styles.subtitle}>
            Your session is secured with {biometryType || 'biometric'} lock. Please authenticate to resume.
          </Text>

          <View style={styles.badgeRow}>
            <ShieldCheck size={16} color={theme.colors.green} style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>2-Minute Inactivity Protection</Text>
          </View>

          <PressableScale
            onPress={() => promptBiometricUnlock()}
            disabled={isAuthenticating}
            style={styles.unlockBtn}
            accessibilityRole="button"
            accessibilityLabel="Unlock FlowDesk"
          >
            {biometryType === 'Touch ID' ? (
              <Fingerprint size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Lock size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.unlockBtnText}>
              {isAuthenticating ? 'Authenticating…' : `Unlock with ${biometryType || 'Biometrics'}`}
            </Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 24,
    fontFamily: theme.typography.families.bold,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 36,
  },
  badgeText: {
    color: '#E2F5EA',
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.orange,
    width: '100%',
    height: 52,
    borderRadius: theme.radii.input,
    shadowColor: theme.colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700' as const,
  },
});
