import { Platform, AppState, AppStateStatus } from 'react-native';
import { create } from 'zustand';
import { useSessionStore } from './sessionStore';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function getLocalAuth(): any {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

interface BiometricState {
  isLocked: boolean;
  isAuthenticating: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  biometryType: string | null;
  setIsLocked: (isLocked: boolean) => void;
  setHardwareSupport: (hasHardware: boolean, isEnrolled: boolean, biometryType: string | null) => void;
}

export const useBiometricStore = create<BiometricState>((set) => ({
  isLocked: false,
  isAuthenticating: false,
  hasHardware: false,
  isEnrolled: false,
  biometryType: null,
  setIsLocked: (isLocked) => set({ isLocked }),
  setHardwareSupport: (hasHardware, isEnrolled, biometryType) =>
    set({ hasHardware, isEnrolled, biometryType }),
}));

let backgroundedTimestamp: number | null = null;

/**
 * Checks hardware support and enrollment for biometrics
 */
export async function checkBiometricsSupport(): Promise<{
  hasHardware: boolean;
  isEnrolled: boolean;
  biometryType: string | null;
}> {
  if (Platform.OS === 'web') {
    return { hasHardware: false, isEnrolled: false, biometryType: null };
  }

  const LocalAuth = getLocalAuth();
  if (!LocalAuth) {
    return { hasHardware: false, isEnrolled: false, biometryType: null };
  }

  try {
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const isEnrolled = await LocalAuth.isEnrolledAsync();
    const supportedTypes = await LocalAuth.supportedAuthenticationTypesAsync();

    let biometryType = 'Biometrics';
    if (supportedTypes?.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) {
      biometryType = 'Face ID';
    } else if (supportedTypes?.includes(LocalAuth.AuthenticationType.FINGERPRINT)) {
      biometryType = 'Touch ID';
    }

    useBiometricStore.getState().setHardwareSupport(hasHardware, isEnrolled, biometryType);
    return { hasHardware, isEnrolled, biometryType };
  } catch (err) {
    console.warn('[Biometrics] Error checking support:', err);
    return { hasHardware: false, isEnrolled: false, biometryType: null };
  }
}

/**
 * Authenticates user via biometric prompt
 */
export async function promptBiometricUnlock(): Promise<boolean> {
  if (Platform.OS === 'web') {
    useBiometricStore.getState().setIsLocked(false);
    return true;
  }

  const LocalAuth = getLocalAuth();
  if (!LocalAuth) {
    useBiometricStore.getState().setIsLocked(false);
    return true;
  }

  try {
    useBiometricStore.setState({ isAuthenticating: true });
    const result = await LocalAuth.authenticateAsync({
      promptMessage: 'Unlock FlowDesk',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      useBiometricStore.getState().setIsLocked(false);
      backgroundedTimestamp = null;
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Biometrics] Authentication error:', err);
    return false;
  } finally {
    useBiometricStore.setState({ isAuthenticating: false });
  }
}

/**
 * AppState listener: tracks 2-minute background inactivity timeout
 */
export function setupBiometricTimeoutListener(): () => void {
  if (Platform.OS === 'web') return () => {};

  checkBiometricsSupport();

  const handleAppStateChange = async (nextState: AppStateStatus) => {
    const { biometricEnabled, isAuthenticated } = useSessionStore.getState();

    if (!isAuthenticated || !biometricEnabled) {
      backgroundedTimestamp = null;
      return;
    }

    if (nextState.match(/inactive|background/)) {
      if (!backgroundedTimestamp) {
        backgroundedTimestamp = Date.now();
      }
    } else if (nextState === 'active') {
      if (backgroundedTimestamp) {
        const elapsed = Date.now() - backgroundedTimestamp;
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          // Lock app and prompt unlock
          useBiometricStore.getState().setIsLocked(true);
          await promptBiometricUnlock();
        }
        backgroundedTimestamp = null;
      }
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}
