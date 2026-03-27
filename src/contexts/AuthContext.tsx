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

// Permission matrix — Round 23: Full access audit
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: ['*'],
  system_architect: [
    'bom.read', 'bom.write', 'master_data.read', 'master_data.write',
    'inventory.read', 'settings.read', 'settings.write',
    'ledger.read', 'dashboard.read', 'reports.read',
  ],
  inventory_admin: [
    'station_0', 'inventory.read', 'inventory.write',
    'master_data.read', 'master_data.write',
    'procurement.read', 'procurement.write',
    'ledger.read', 'dashboard.read', 'reports.read',
  ],
  qc: [
    'station_4', 'station_5',
    'orders.read', 'inventory.read',
    'dashboard.read', 'reports.read',
  ],
  viewer: [
    'dashboard.read', 'orders.read', 'inventory.read',
    'master_data.read', 'ledger.read', 'reports.read',
  ],
  vault_guardian: [
    'station_0', 'vault_guardian', 'vault_ledger',
    'procurement.read', 'procurement.write',
    'master_data.read', 'master_data.write',
    'inventory.read', 'inventory.write', 'ledger.read',
  ],
  pod_junior: [
    'station_1', 'station_2', 'station_3', 'station_4', 'station_5', 'station_6',
    'orders.read', 'inventory.read', 'print_jobs',
  ],
  pod_leader: [
    'station_1', 'station_2', 'station_3', 'station_4', 'station_5', 'station_6',
    'manual_decant', 'orders.read', 'orders.write', 'inventory.read',
    'ledger.read', 'work_allocation', 'operator_management',
    'dashboard.read', 'reports.read', 'print_jobs',
  ],
  pod_senior: [
    'station_1', 'station_2', 'station_3', 'station_4', 'station_5', 'station_6',
    'manual_decant', 'orders.read', 'inventory.read', 'print_jobs',
  ],
};

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

  const login = useCallback(async (_email: string, _password: string) => {
    // Mock login for now — triggers a fresh user fetch
    const res = await api.auth.me();
    setState({ user: res.data, isAuthenticated: !!res.data, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    // Clear local token (dummy implementation for now)
    localStorage.removeItem('sb-access-token');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!state.user) return false;
    if (state.user.role === 'owner' || state.user.role === 'admin') return true;
    return roles.includes(state.user.role);
  }, [state.user]);

  const hasPermission = useCallback((permission: string) => {
    if (!state.user) return false;
    const perms = ROLE_PERMISSIONS[state.user.role];
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
