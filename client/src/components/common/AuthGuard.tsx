import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';

interface AuthGuardProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  managerOnly?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, adminOnly = false, managerOnly = false }) => {
  const { isAuthenticated, isLoading, isAdmin, isManager } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-border border-t-black dark:border-t-white rounded-full animate-spin" />
          <p className="text-xs text-muted font-medium">Loading Flowdesk...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (managerOnly && !isAdmin && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
