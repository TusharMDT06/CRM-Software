import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionStore } from './sessionStore';
import {
  setAuthToken,
  setRefreshToken,
  setUserProfile,
  clearAuthTokens,
  getAuthToken,
  getUserProfile,
} from './secureStorage';
import { apiClient, registerAuthFailureHandler } from '../api/client';
import { queryClient } from '../api/queryClient';
import { fetchMe } from '../api/users';
import { disconnectSocket } from '../realtime/socket';
import {
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from '../notifications/pushNotifications';

export function useAuth() {
  const {
    user,
    tenant,
    token,
    isAuthenticated,
    isLoading,
    biometricEnabled,
    setSession,
    clearSession,
    setLoading,
    setUser,
    setBiometricEnabled,
  } = useSessionStore();

  const logout = useCallback(async () => {
    try {
      await unregisterPushNotificationsAsync();
      disconnectSocket();
      await clearAuthTokens();
      queryClient.clear();
      clearSession();
    } catch (err) {
      console.warn('[Auth] Error during logout:', err);
    }
  }, [clearSession]);

  // Register global 401 callback from axios interceptor
  registerAuthFailureHandler(() => {
    logout();
  });

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const response = await apiClient.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password,
        });

        const { token: authToken, user: userProfile, tenant: tenantData } = response.data;

        await setAuthToken(authToken);
        await setRefreshToken(authToken);
        await setUserProfile(userProfile);

        setSession(authToken, userProfile, tenantData);

        // Register push token asynchronously after successful authentication
        registerForPushNotificationsAsync().catch((err) => {
          console.warn('[Auth] Push token registration skipped/failed:', err);
        });

        return { success: true, user: userProfile };
      } catch (err: any) {
        setLoading(false);
        throw err;
      }
    },
    [setSession, setLoading]
  );

  const initializeAuth = useCallback(async () => {
    try {
      const storedToken = await getAuthToken();
      const cachedProfile = await getUserProfile();

      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Restore biometric setting
      const savedBio = await AsyncStorage.getItem('flowdesk_biometric_enabled');
      if (savedBio !== null) {
        setBiometricEnabled(JSON.parse(savedBio));
      }

      // Fast optimistic hydration from secure storage
      if (cachedProfile) {
        setSession(storedToken, cachedProfile);
      }

      // Verify token with backend
      try {
        const { user: liveUser, tenant: liveTenant } = await fetchMe();
        setSession(storedToken, liveUser, liveTenant);
        await setUserProfile(liveUser);
      } catch {
        // If verify fails, token may be expired or revoked
        await logout();
      }
    } catch (err) {
      console.warn('[Auth] Failed to initialize auth session:', err);
    } finally {
      setLoading(false);
    }
  }, [setSession, setLoading, logout, setBiometricEnabled]);

  return {
    user,
    tenant,
    token,
    isAuthenticated,
    isLoading,
    biometricEnabled,
    login,
    logout,
    initializeAuth,
  };
}
