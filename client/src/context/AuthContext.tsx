import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Tenant } from '../types/index.js';
import { api } from '../api/client.js';

interface AuthContextValue {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSales: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  isImpersonating: boolean;
  login: (token: string, user: User, tenant?: Tenant) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('flowdesk_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('flowdesk_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    const saved = localStorage.getItem('flowdesk_tenant');
    return saved ? JSON.parse(saved) : null;
  });
  const [isImpersonating, setIsImpersonating] = useState<boolean>(() => {
    return localStorage.getItem('flowdesk_is_impersonating') === 'true';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem('flowdesk_token');
    localStorage.removeItem('flowdesk_user');
    localStorage.removeItem('flowdesk_tenant');
    localStorage.removeItem('flowdesk_is_impersonating');
    localStorage.removeItem('flowdesk_platform_token');
    setToken(null);
    setUser(null);
    setTenant(null);
    setIsImpersonating(false);
  }, []);

  const stopImpersonating = useCallback(() => {
    const platformToken = localStorage.getItem('flowdesk_platform_token');
    if (platformToken) {
      localStorage.setItem('flowdesk_token', platformToken);
      localStorage.removeItem('flowdesk_platform_token');
      localStorage.removeItem('flowdesk_is_impersonating');
      setToken(platformToken);
      setIsImpersonating(false);
      window.location.href = '/platform';
    } else {
      logout();
    }
  }, [logout]);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setTenant(res.data.tenant || null);
      setIsImpersonating(Boolean(res.data.isImpersonating));
      localStorage.setItem('flowdesk_user', JSON.stringify(res.data.user));
      if (res.data.tenant) {
        localStorage.setItem('flowdesk_tenant', JSON.stringify(res.data.tenant));
      }
      if (res.data.isImpersonating) {
        localStorage.setItem('flowdesk_is_impersonating', 'true');
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('flowdesk-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('flowdesk-unauthorized', handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = (newToken: string, newUser: User, newTenant?: Tenant) => {
    localStorage.setItem('flowdesk_token', newToken);
    localStorage.setItem('flowdesk_user', JSON.stringify(newUser));
    if (newTenant) {
      localStorage.setItem('flowdesk_tenant', JSON.stringify(newTenant));
      setTenant(newTenant);
    }
    setToken(newToken);
    setUser(newUser);
  };

  const isPlatformAdmin = user?.role === 'platform_admin';
  const isAdmin = user?.role === 'admin' || isPlatformAdmin;
  const isManager = user?.role === 'manager';
  const isSales = user?.role === 'sales';
  const canDelete = isAdmin || isManager;
  const canManageUsers = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        isPlatformAdmin,
        isAdmin,
        isManager,
        isSales,
        canDelete,
        canManageUsers,
        isImpersonating,
        login,
        logout,
        refreshMe,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
