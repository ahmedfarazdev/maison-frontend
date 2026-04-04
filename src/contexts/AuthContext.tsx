// ============================================================
// Auth Context — Role-based access control for Maison Em Ops
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, UserRole, AuthState } from '@/types';
import { api } from '@/lib/api-client';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  switchRole: (role: UserRole) => void; // Dev mode only
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Initial user check
    api.auth.me().then(res => {
      setState({
        user: res.data,
        isAuthenticated: !!res.data,
        isLoading: false,
      });
    }).catch(() => {
      setState(prev => ({ ...prev, isLoading: false }));
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await api.auth.signIn(email, password);
      const res = await api.auth.me();
      setState({
        user: res.data,
        isAuthenticated: !!res.data,
        isLoading: false,
      });
    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.signOut();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!state.user) return false;
    const userRoles = state.user.roles || [state.user.role];
    if (userRoles.includes('owner') || userRoles.includes('admin')) return true;
    return roles.some(role => userRoles.includes(role));
  }, [state.user]);

  const hasPermission = useCallback((permission: string) => {
    if (!state.user) return false;
    const userRoles = state.user.roles || [state.user.role];
    if (userRoles.includes('owner') || userRoles.includes('admin')) return true;
    const perms = state.user.permissions || [];
    return perms.includes('*') || perms.includes(permission);
  }, [state.user]);

  const switchRole = useCallback((role: UserRole) => {
    setState(prev => prev.user ? {
      ...prev,
      user: { ...prev.user, role },
    } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      hasRole,
      hasPermission,
      switchRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
