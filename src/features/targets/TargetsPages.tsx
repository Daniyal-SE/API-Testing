import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PlusCircle, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable, FilterToolbar } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, ForbiddenState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { RunStateBadge, ScopeApprovalBadge, ScopeVersionBadge, TargetAuthBadge } from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import { formatEnvironmentLabel, mapTargetAuthStatus } from '@/src/lib/status-mappers';
import { previewNormalizeUrl, targetSchema } from '@/src/lib/validators';
import type { Target } from '@/src/types/domain';

export function TargetsListPage() {
  const { roleCapabilities } = useAppSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [targetToDelete, setTargetToDelete] = useState<Target | null>(null);

  const targetsQ = useQuery({ queryKey: ['targets'], queryFn: () => apiClient.getTargets() });

  const deleteMut = useMutation({
    mutationFn: (targetId: string) => apiClient.deleteTarget(targetId),
    onSuccess: () => {
      setTargetToDelete(null);
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['test-identities'] });
      qc.invalidateQueries({ queryKey: ['invariants'] });
      qc.invalidateQueries({ queryKey: ['findings'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (targetsQ.data ?? []).filter((t) => {
      const matchEnv = envFilter === 'all' || t.environment === envFilter;
      const matchQuery =
        !q ||
        t.displayName.toLowerCase().includes(q) ||
        t.normalizedBaseUrl.toLowerCase().includes(q) ||
        t.projectName.toLowerCase().includes(q);
      return matchEnv && matchQuery;
    });
  }, [targetsQ.data, search, envFilter]);

  const columns = [
    {
      key: 'name',
      header: 'Target / Base URL',
      render: (t: Target) => (
        <div>
          <Link to={`/app/targets/${t.id}`} className="font-medium text-slate-100 hover:text-teal-400">
            {t.displayName}
          </Link>
          <div className="font-mono text-xs text-slate-400">{t.normalizedBaseUrl}</div>
        </div>
      ),
    },
    { key: 'project', header: 'Project', render: (t: Target) => <span className="text-xs text-slate-300">{t.projectName}</span> },
    {
      key: 'env',
      header: 'Environment',
      render: (t: Target) => <span className="text-xs text-slate-300">{formatEnvironmentLabel(t.environment)}</span>,
    },
    {
      key: 'auth',
      header: 'Authorization',
      render: (t: Target) => <TargetAuthBadge status={t.authorizationStatus} />,
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (t: Target) => <ScopeVersionBadge versionLabel={t.currentScopeVersionLabel} approvalState={t.currentScopeApprovalState} />,
    },
    {
      key: 'run',
      header: 'Latest Run',
      render: (t: Target) => (t.latestRunState ? <RunStateBadge state={t.latestRunState} /> : <span className="text-xs text-slate-500">None</span>),
    },
    {
      key: 'review',
      header: 'Last Auth Review',
      render: (t: Target) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(t.lastAuthorizationReviewAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (t: Target) => (
        <div className="flex justify-end">
          <DeleteIconButton
            label={`Delete target ${t.displayName}`}
            title={roleCapabilities.canDeleteRecords ? `Delete target ${t.displayName}` : 'Read-only roles cannot delete targets'}
            disabled={!roleCapabilities.canDeleteRecords}
            onClick={() => {
              deleteMut.reset();
              setTargetToDelete(t);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Targets' }]}
        title="Assessment Targets"
        description="Registered Local Lab and Staging targets. Registration is distinct from Project Owner authorization."
        actions={
          roleCapabilities.canRegisterTarget && (
            <Button variant="primary" onClick={() => navigate('/app/targets/new')}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Add Target
            </Button>
          )
        }
      />

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Filter targets by name, URL, or project...">
        <select
          aria-label="Environment filter"
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Environments</option>
          <option value="local_lab">Local Lab</option>
          <option value="staging">Staging</option>
        </select>
      </FilterToolbar>

      {targetsQ.error ? (
        <ErrorState message="Failed to load targets." onRetry={() => targetsQ.refetch()} />
      ) : targetsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No targets found" description="Register a target under a project to configure scope and authorization." />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(t) => t.id} onRowClick={(t) => navigate(`/app/targets/${t.id}`)} />
      )}

      <ConfirmDialog
        open={Boolean(targetToDelete)}
        title="Delete Target"
        description={
          targetToDelete
            ? `Delete "${targetToDelete.displayName}" (${targetToDelete.normalizedBaseUrl}) along with its scope versions, authorization history, and associated artifacts?`
            : ''
        }
        confirmLabel="Delete Target"
        isPending={deleteMut.isPending}
        onConfirm={() => targetToDelete && deleteMut.mutate(targetToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setTargetToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete target.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

export function CreateTargetPage() {
  const { activeWorkspaceId, roleCapabilities } = useAppSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const projectsQ = useQuery({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: () => apiClient.getProjects(activeWorkspaceId),
  });

  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:8080');
  const [environment, setEnvironment] = useState<'local_lab' | 'staging'>('local_lab');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const [description, setDescription] = useState('');
  const [ownershipDeclaration, setOwnershipDeclaration] = useState('');
  const [permissionReference, setPermissionReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const effectiveProjectId =
    (projectsQ.data ?? []).some((p) => p.id === projectId) ? projectId : (projectsQ.data?.[0]?.id ?? '');

  const normPreview = useMemo(() => previewNormalizeUrl(baseUrl), [baseUrl]);

  const createMut = useMutation({
    mutationFn: apiClient.createTarget,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/app/targets/${created.id}`);
    },
  });

  if (!roleCapabilities.canRegisterTarget) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'Targets', to: '/app/targets' }, { label: 'Add Target' }]}
          title="Register Target"
          description="Target registration is restricted to authorized Project Owners and Security Testers."
        />
        <ForbiddenState />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = targetSchema.safeParse({
      displayName,
      baseUrl,
      environment,
      projectId: effectiveProjectId,
      description,
      ownershipDeclaration,
      permissionReference,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    createMut.mutate(parsed.data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Targets', to: '/app/targets' }, { label: 'Add Target' }]}
        title="Register Assessment Target"
        description="Register a Local Lab or Staging target. Registration enters Pending Review and does not authorize scanning."
      />

      <div className="rounded-md border border-amber-700/40 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
        <span>
          Target registration is not equivalent to target authorization. After registration, a Project Owner must review
          and approve authorization and an immutable scope version before any assessment can launch.
        </span>
      </div>

      <Panel className="max-w-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {createMut.error && (
            <ErrorState message={createMut.error instanceof Error ? createMut.error.message : 'Unable to register target.'} />
          )}

          <FormField id="tgt-project" label="Project Association" required error={errors.projectId}>
            <select id="tgt-project" value={effectiveProjectId} onChange={(e) => setProjectId(e.target.value)} className={inputClassName}>
              {(projectsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="tgt-name" label="Display Name" required error={errors.displayName}>
            <input
              id="tgt-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Campus Orders Fixture API"
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="tgt-url"
            label="Base URL"
            required
            error={errors.baseUrl}
            hint={
              normPreview.valid
                ? `Normalized preview: ${normPreview.normalized} (host: ${normPreview.host}, port: ${normPreview.port})`
                : normPreview.reason
            }
          >
            <input
              id="tgt-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className={`${inputClassName} font-mono`}
            />
          </FormField>

          <FormField id="tgt-env" label="Environment Classification" required error={errors.environment}>
            <select
              id="tgt-env"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'local_lab' | 'staging')}
              className={inputClassName}
            >
              <option value="local_lab">Local Lab (Isolated Loopback / Docker)</option>
              <option value="staging">Staging (Authorized Non-Production)</option>
            </select>
          </FormField>

          <FormField id="tgt-desc" label="Target Description" required error={errors.description}>
            <textarea
              id="tgt-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of API surface and test fixture state..."
              className={inputClassName}
            />
          </FormField>

          <FormField id="tgt-owner-decl" label="Ownership Declaration" required error={errors.ownershipDeclaration}>
            <input
              id="tgt-owner-decl"
              type="text"
              value={ownershipDeclaration}
              onChange={(e) => setOwnershipDeclaration(e.target.value)}
              placeholder="Owned by FYP Team; isolated local lab instance"
              className={inputClassName}
            />
          </FormField>

          <FormField id="tgt-perm-ref" label="Written Permission Reference" required error={errors.permissionReference}>
            <input
              id="tgt-perm-ref"
              type="text"
              value={permissionReference}
              onChange={(e) => setPermissionReference(e.target.value)}
              placeholder="FYP-AUTH-2026-03"
              className={`${inputClassName} font-mono`}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/app/targets')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMut.isPending}>
              {createMut.isPending ? 'Registering...' : 'Register Target (Pending Review)'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export function TargetDetailPage() {
  const { targetId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const targetQ = useQuery({
    queryKey: ['target', targetId],
    queryFn: () => apiClient.getTargetById(targetId),
    enabled: Boolean(targetId),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiClient.deleteTarget(targetId),
    onSuccess: () => {
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate('/app/targets');
    },
  });

  if (targetQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (targetQ.error || !targetQ.data) {
    return <ErrorState message="Target could not be loaded." onRetry={() => targetQ.refetch()} />;
  }

  const { target, scopeVersions, runs } = targetQ.data;
  const authMapped = mapTargetAuthStatus(target.authorizationStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Targets', to: '/app/targets' },
          { label: target.displayName },
        ]}
        title={target.displayName}
        description={target.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/app/targets/${target.id}/authorization`)}>
              Authorization History
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/app/targets/${target.id}/scope`)}>
              Configure Scope
            </Button>
            <Button
              variant="primary"
              disabled={!authMapped.canLaunch}
              title={authMapped.canLaunch ? 'Launch assessment wizard' : 'Blocked: Target authorization required'}
              onClick={() => navigate(`/app/assessments/new?targetId=${target.id}`)}
            >
              Launch Assessment
            </Button>
            {roleCapabilities.canDeleteRecords && (
              <Button
                variant="danger"
                onClick={() => {
                  deleteMut.reset();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Target
              </Button>
            )}
          </>
        }
      />

      {!authMapped.canLaunch && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-red-800/60 bg-red-950/30 p-4 text-xs text-red-200"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-semibold">Assessment Launch Blocked ({authMapped.label})</div>
            <p className="mt-0.5 text-red-300/90">
              This target cannot be assessed until its authorization status is explicitly Approved by a Project Owner.{' '}
              <Link to={`/app/targets/${target.id}/authorization`} className="underline hover:text-white">
                Open Authorization Review
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Target Profile & Authorization</h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400">Normalized Base URL</dt>
              <dd className="mt-0.5 font-mono text-slate-200 break-all">{target.normalizedBaseUrl}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Environment</dt>
              <dd className="mt-0.5 text-slate-200">{formatEnvironmentLabel(target.environment)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Authorization State</dt>
              <dd className="mt-1">
                <TargetAuthBadge status={target.authorizationStatus} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Permission Reference</dt>
              <dd className="mt-0.5 font-mono text-slate-200">{target.permissionReference}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Ownership Declaration</dt>
              <dd className="mt-0.5 text-slate-300">{target.ownershipDeclaration}</dd>
            </div>
          </dl>
        </Panel>

        <Panel className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Scope Versions</h2>
            <Link to={`/app/targets/${target.id}/scope/versions`} className="text-xs text-teal-400 hover:text-teal-300">
              All Versions
            </Link>
          </div>
          {scopeVersions.length === 0 ? (
            <EmptyState title="No scope configured" description="Define target boundaries and safe budgets before launching runs." />
          ) : (
            <ul className="divide-y divide-slate-800 text-xs">
              {scopeVersions.slice(0, 3).map((sv) => (
                <li key={sv.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-mono font-semibold text-slate-200">{sv.versionLabel}</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="text-slate-400">{sv.changeSummary}</span>
                  </div>
                  <ScopeApprovalBadge state={sv.approvalState} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Associated Assessment Runs</h2>
        {runs.length === 0 ? (
          <p className="text-xs text-slate-400">No runs recorded for this target yet.</p>
        ) : (
          <div className="divide-y divide-slate-800 text-xs">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <Link to={`/app/assessments/${r.id}/monitor`} className="font-mono font-medium text-teal-400">
                    {r.id}
                  </Link>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-400">
                    Scope {r.scopeVersionLabel} · {formatTimestamp(r.startedAt)}
                  </span>
                </div>
                <RunStateBadge state={r.state} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Target"
        description={`Delete "${target.displayName}" (${target.normalizedBaseUrl}) and clear its scope versions, authorization log, and associated records?`}
        confirmLabel="Delete Target"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => {
          deleteMut.reset();
          setDeleteOpen(false);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete target.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

export function TargetAuthorizationPage() {
  const { targetId = '' } = useParams();
  const { roleCapabilities } = useAppSession();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');

  const targetQ = useQuery({
    queryKey: ['target', targetId],
    queryFn: () => apiClient.getTargetById(targetId),
    enabled: Boolean(targetId),
  });

  const authMut = useMutation({
    mutationFn: (nextState: 'authorized' | 'revoked' | 'needs_revalidation') =>
      apiClient.updateTargetAuthorization(targetId, nextState, notes),
    onSuccess: () => {
      setNotes('');
      qc.invalidateQueries({ queryKey: ['target', targetId] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  if (targetQ.isLoading) return <LoadingSkeleton rows={4} />;
  if (targetQ.error || !targetQ.data) {
    return <ErrorState message="Target authorization records could not be loaded." onRetry={() => targetQ.refetch()} />;
  }

  const { target, authorizations } = targetQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Targets', to: '/app/targets' },
          { label: target.displayName, to: `/app/targets/${target.id}` },
          { label: 'Authorization History' },
        ]}
        title={`Authorization: ${target.displayName}`}
        description="Chronological ownership declarations, permission references, and Project Owner approval history."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-teal-400" aria-hidden="true" />
            <span>Current Authorization State</span>
          </div>
          <div>
            <TargetAuthBadge status={target.authorizationStatus} />
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>
              Environment: <span className="text-slate-200">{formatEnvironmentLabel(target.environment)}</span>
            </div>
            <div>
              Permission Ref: <span className="font-mono text-slate-200">{target.permissionReference}</span>
            </div>
            <div>
              Active Scope: <span className="font-mono text-slate-200">{target.currentScopeVersionLabel ?? 'None'}</span>
            </div>
          </div>

          {roleCapabilities.canApproveTargetAuthorization ? (
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <FormField id="auth-review-notes" label="Review Rationale">
                <textarea
                  id="auth-review-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Verified written lab authorization window..."
                  className={inputClassName}
                />
              </FormField>
              {authMut.error && (
                <ErrorState message={authMut.error instanceof Error ? authMut.error.message : 'Update failed'} />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={authMut.isPending}
                  onClick={() => authMut.mutate('authorized')}
                >
                  Approve Authorization
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={authMut.isPending}
                  onClick={() => authMut.mutate('needs_revalidation')}
                >
                  Needs Revalidation
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={authMut.isPending}
                  onClick={() => authMut.mutate('revoked')}
                >
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-3 text-xs text-slate-400">
              Only a Project Owner can approve or revoke target authorization. Evaluators, Testers, and Administrators cannot self-approve targets.
            </div>
          )}
        </Panel>

        <Panel className="p-5 space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-100">Chronological Authorization Log</h2>
          <div className="divide-y divide-slate-800">
            {authorizations.map((rec) => (
              <div key={rec.id} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TargetAuthBadge status={rec.state} />
                  <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(rec.timestamp)}</span>
                </div>
                <div className="text-xs text-slate-300">
                  Declared by <span className="font-mono text-slate-200">{rec.declaringUser}</span>
                  {rec.reviewedBy && (
                    <>
                      {' · '}Reviewed by <span className="font-mono text-slate-200">{rec.reviewedBy}</span>
                    </>
                  )}
                  {rec.scopeVersionUsed && (
                    <>
                      {' · '}Scope <span className="font-mono text-slate-200">{rec.scopeVersionUsed}</span>
                    </>
                  )}
                </div>
                {rec.notes && <p className="text-xs text-slate-400">{rec.notes}</p>}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
