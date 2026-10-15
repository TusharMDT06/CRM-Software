import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_AUTH_TOKEN = 'flowdesk_auth_token';
const KEY_REFRESH_TOKEN = 'flowdesk_refresh_token';
const KEY_USER_PROFILE = 'flowdesk_user_profile';
const KEY_BIOMETRICS = 'flowdesk_biometric_enabled';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (err) {
      console.warn('[Storage] Failed to save to localStorage:', err);
      return;
    }
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn('[SecureStore] Failed to save key:', key, err);
  }
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      return;
    }
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn('[SecureStore] Error deleting key:', key, err);
  }
}

export async function getAuthToken(): Promise<string | null> {
  return getItem(KEY_AUTH_TOKEN);
}

export async function setAuthToken(token: string): Promise<void> {
  return setItem(KEY_AUTH_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(KEY_REFRESH_TOKEN);
}

export async function setRefreshToken(token: string): Promise<void> {
  return setItem(KEY_REFRESH_TOKEN, token);
}

export async function getUserProfile<T = any>(): Promise<T | null> {
  const raw = await getItem(KEY_USER_PROFILE);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setUserProfile(profile: any): Promise<void> {
  return setItem(KEY_USER_PROFILE, JSON.stringify(profile));
}

export async function getBiometricEnabled(): Promise<boolean> {
  const val = await getItem(KEY_BIOMETRICS);
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  return setItem(KEY_BIOMETRICS, enabled ? 'true' : 'false');
}

export async function clearAuthTokens(): Promise<void> {
  await deleteItem(KEY_AUTH_TOKEN);
  await deleteItem(KEY_REFRESH_TOKEN);
  await deleteItem(KEY_USER_PROFILE);
}
