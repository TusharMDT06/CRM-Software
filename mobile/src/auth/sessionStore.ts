import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@flowdesk/shared';
import { setMemoryToken } from '../api/client';

export interface SessionState {
  user: User | null;
  tenant: any | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;

  setSession: (token: string, user: User, tenant?: any) => void;
  setUser: (user: User) => void;
  clearSession: () => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  tenant: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,

  setSession: (token: string, user: User, tenant?: any) => {
    setMemoryToken(token);
    set({
      token,
      user,
      tenant: tenant || null,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setUser: (user: User) => {
    set({ user });
  },

  clearSession: () => {
    setMemoryToken(null);
    set({
      token: null,
      user: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setBiometricEnabled: (biometricEnabled: boolean) => {
    set({ biometricEnabled });
    AsyncStorage.setItem('flowdesk_biometric_enabled', JSON.stringify(biometricEnabled)).catch(() => {});
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },
}));
