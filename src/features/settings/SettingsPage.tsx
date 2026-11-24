import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppSession } from '@/src/app/providers';
import { PageHeader } from '@/src/components/layout/AppShell';
import { RunnerReadinessPanel } from '@/src/components/security/StatusBadges';
import { Button, Panel } from '@/src/components/ui/Primitives';
import { apiClient, isDemoMode } from '@/src/lib/api-client';
import { formatRoleLabel } from '@/src/lib/status-mappers';
import type { SrsRole } from '@/src/types/domain';

export function SettingsPage() {
  const {
    user,
    workspaces,
    theme,
    toggleTheme,
    logout,
    switchDemoRole,
    simulateSessionExpired,
    roleCapabilities,
  } = useAppSession();
  const navigate = useNavigate();

  const runnerQ = useQuery({
    queryKey: ['runner-health-settings'],
    queryFn: () => apiClient.getRunnerHealth(),
    enabled: roleCapabilities.canViewAdminHealth,
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Account' }, { label: 'Profile & Settings' }]}
        title="Profile & Workspace Settings"
        description="Manage your authenticated display details, appearance preference, and session controls."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">User Profile & Membership</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-slate-400">Display Name</dt>
              <dd className="mt-0.5 font-medium text-slate-100">{user.displayName}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Email</dt>
              <dd className="mt-0.5 font-mono text-slate-200">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Assigned SRS Role</dt>
              <dd className="mt-0.5 font-medium text-teal-400">{formatRoleLabel(user.role)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Workspaces</dt>
              <dd className="mt-0.5 text-slate-200">{workspaces.map((w) => w.name).join(', ')}</dd>
            </div>
          </dl>
          <p className="rounded border border-slate-800 bg-slate-950/60 p-3 text-slate-400">
            {roleCapabilities.roleSummaryNote}
          </p>
        </Panel>

        <Panel className="p-5 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Display & Session Controls</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Console Theme</div>
              <div className="text-slate-400">Dark security console is the default academic workspace theme.</div>
            </div>
            <Button size="sm" variant="secondary" onClick={toggleTheme}>
              Current: {theme === 'dark' ? 'Dark' : 'Light'} (Switch)
            </Button>
          </div>

          {isDemoMode && (
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <div className="font-medium text-slate-200">Demo Role Switcher (UI Verification Only)</div>
              <div className="flex flex-wrap gap-2">
                {(['project_owner', 'security_tester', 'supervisor_evaluator', 'system_admin'] as SrsRole[]).map((role) => (
                  <Button
                    key={role}
                    size="sm"
                    variant={user.role === role ? 'primary' : 'secondary'}
                    onClick={() => switchDemoRole(role)}
                  >
                    {formatRoleLabel(role)}
                  </Button>
                ))}
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await simulateSessionExpired();
                    navigate('/login');
                  }}
                >
                  Simulate Session Expired
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-4 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Sign Out
            </Button>
          </div>
        </Panel>
      </div>

      {roleCapabilities.canViewAdminHealth && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Administrator System & Worker Health (Read-Only)</h2>
          <p className="text-xs text-slate-400">
            System Administrators monitor backend worker health only and cannot approve target authorizations or override project scope.
          </p>
          <RunnerReadinessPanel readiness={runnerQ.data} isLoading={runnerQ.isLoading} />
        </div>
      )}
    </div>
  );
}
