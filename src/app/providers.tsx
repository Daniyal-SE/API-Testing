import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { apiClient, isDemoMode } from '@/src/lib/api-client';
import { getRoleUiCapabilities, type RoleUiCapabilities } from '@/src/lib/permissions';
import type { AuthCapabilities, SrsRole, UserProfile, Workspace } from '@/src/types/domain';

interface AppSessionContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  sessionExpired: boolean;
  capabilities: AuthCapabilities;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  roleCapabilities: RoleUiCapabilities;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole: (role: SrsRole) => Promise<void>;
  simulateSessionExpired: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const DEFAULT_CAPABILITIES: AuthCapabilities = {
  registrationMode: 'invite_only',
  passwordRecoveryEnabled: false,
  aiAdvisorEnabled: true,
  semester8Enabled: true,
};

function SessionInnerProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-fyp-main');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      document.body.className = 'bg-slate-950 text-slate-100 antialiased';
    } else {
      root.classList.remove('dark');
      document.body.className = 'bg-slate-50 text-slate-900 antialiased';
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const sessionQuery = useQuery({
    queryKey: ['auth-session'],
    queryFn: () => apiClient.getSession(),
  });

  const workspaces = sessionQuery.data?.workspaces ?? [];
  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null,
    [workspaces, activeWorkspaceId],
  );

  const user = sessionQuery.data?.user ?? null;
  const roleCapabilities = useMemo(() => getRoleUiCapabilities(user?.role), [user?.role]);

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiClient.login(email, password);
    await queryClient.invalidateQueries();
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
  }, []);

  const switchDemoRole = useCallback(async (role: SrsRole) => {
    if (!isDemoMode) return;
    await apiClient.switchDemoRole(role);
    await queryClient.invalidateQueries();
  }, []);

  const simulateSessionExpired = useCallback(async () => {
    await apiClient.simulateSessionExpired();
    await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
  }, []);

  const value: AppSessionContextValue = {
    user,
    isLoading: sessionQuery.isLoading,
    sessionExpired: Boolean(sessionQuery.data?.sessionExpired),
    capabilities: sessionQuery.data?.capabilities ?? DEFAULT_CAPABILITIES,
    workspaces,
    activeWorkspaceId: activeWorkspace?.id ?? activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    roleCapabilities,
    theme,
    toggleTheme,
    login,
    logout,
    switchDemoRole,
    simulateSessionExpired,
    refreshSession,
  };

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionInnerProvider>{children}</SessionInnerProvider>
    </QueryClientProvider>
  );
}

export function useAppSession(): AppSessionContextValue {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error('useAppSession must be used inside AppProviders');
  }
  return ctx;
}
