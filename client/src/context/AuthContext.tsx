import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/index.js';
import { api } from '../api/client.js';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSales: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('flowdesk_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('flowdesk_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem('flowdesk_token');
    localStorage.removeItem('flowdesk_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      localStorage.setItem('flowdesk_user', JSON.stringify(res.data.user));
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

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('flowdesk_token', newToken);
    localStorage.setItem('flowdesk_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isSales = user?.role === 'sales';
  const canDelete = isAdmin || isManager;
  const canManageUsers = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        isAdmin,
        isManager,
        isSales,
        canDelete,
        canManageUsers,
        login,
        logout,
        refreshMe,
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
