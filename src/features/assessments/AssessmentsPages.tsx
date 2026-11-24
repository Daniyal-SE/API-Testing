import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, PlayCircle, RefreshCw, StopCircle } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable, FilterToolbar, MetricCard } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, ForbiddenState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import {
  RunStateBadge,
  RunStateTimeline,
  RunnerReadinessPanel,
  SafeText,
  ScopeVersionBadge,
  TargetAuthBadge,
} from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, Panel, TabBar } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatDurationSeconds, formatTimestamp } from '@/src/lib/formatters';
import { canDeleteAssessmentRun } from '@/src/lib/permissions';
import { formatEnvironmentLabel, mapTargetAuthStatus } from '@/src/lib/status-mappers';
import type { AssessmentModuleId, AssessmentRun } from '@/src/types/domain';

const AVAILABLE_MODULES: { id: AssessmentModuleId; label: string; semester: string; description: string }[] = [
  { id: 'url_discovery', label: 'Bounded URL Discovery', semester: 'Sem 7', description: 'Safe in-scope page, route, and form enumeration.' },
  { id: 'zap_passive', label: 'Passive Web Security (ZAP)', semester: 'Sem 8', description: 'Low-impact passive response & header inspection.' },
  { id: 'openapi_contract', label: 'OpenAPI Contract Verification', semester: 'Sem 8', description: 'Positive, negative, type, and boundary schema cases.' },
  { id: 'behavior_graph', label: 'Behavior Dependency Mining', semester: 'Sem 8', description: 'Producer/consumer edge inference from traces.' },
  { id: 'business_invariants', label: 'Business Invariant Replay', semester: 'Sem 8', description: 'Approved BOLA, workflow-order, and replay checks.' },
];

export function AssessmentWizardPage() {
  const { roleCapabilities } = useAppSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const targetsQ = useQuery({ queryKey: ['targets'], queryFn: () => apiClient.getTargets() });
  const identitiesQ = useQuery({ queryKey: ['test-identities'], queryFn: () => apiClient.getTestIdentities() });

  const initialTargetId = searchParams.get('targetId') ?? '';
  const [selectedTargetId, setSelectedTargetId] = useState(initialTargetId);
  const [selectedModules, setSelectedModules] = useState<AssessmentModuleId[]>(['url_discovery']);
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<string[]>([]);
  const [stateChangingApproved, setStateChangingApproved] = useState(false);

  const effectiveTargetId =
    (targetsQ.data ?? []).some((t) => t.id === selectedTargetId) ? selectedTargetId : (targetsQ.data?.[0]?.id ?? '');

  const targetDetailQ = useQuery({
    queryKey: ['target', effectiveTargetId],
    queryFn: () => apiClient.getTargetById(effectiveTargetId),
    enabled: Boolean(effectiveTargetId),
  });

  const approvedScope = targetDetailQ.data?.scopeVersions.find((s) => s.approvalState === 'approved');
  const activeScope = approvedScope ?? targetDetailQ.data?.scopeVersions[0];

  const requiresStateChange = selectedModules.includes('business_invariants');

  const preflightQ = useQuery({
    queryKey: ['preflight', effectiveTargetId, activeScope?.id, selectedModules, requiresStateChange, stateChangingApproved],
    queryFn: () =>
      apiClient.runPreflight({
        targetId: effectiveTargetId,
        scopeVersionId: activeScope?.id,
        modules: selectedModules,
        includeStateChanging: requiresStateChange,
        stateChangingApproved,
      }),
    enabled: Boolean(effectiveTargetId),
  });

  const launchMut = useMutation({
    mutationFn: () =>
      apiClient.launchAssessment({
        targetId: effectiveTargetId,
        scopeVersionId: activeScope?.id ?? '',
        modules: selectedModules,
        selectedIdentityIds,
      }),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate(`/app/assessments/${run.id}/monitor`);
    },
  });

  if (!roleCapabilities.canLaunchAssessment) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[{ label: 'Assessments', to: '/app/assessments' }, { label: 'New Assessment' }]}
          title="New Assessment Wizard"
          description="Only Project Owners and Security Testers may submit assessment launch requests."
        />
        <ForbiddenState />
      </div>
    );
  }

  const toggleModule = (id: AssessmentModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((m) => m !== id) : prev) : [...prev, id],
    );
  };

  const target = targetDetailQ.data?.target;
  const targetIdentities = (identitiesQ.data ?? []).filter((i) => i.targetId === effectiveTargetId);
  const authMapped = mapTargetAuthStatus(target?.authorizationStatus);
  const preflight = preflightQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Assessments', to: '/app/assessments' }, { label: 'New Assessment' }]}
        title="Configure & Launch Assessment"
        description="Verify target authorization, approved scope version, budgets, and backend preflight gates before submitting a run."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Step 1 & 2: Target + Authorization */}
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">1. Select Target & Confirm Authorization</h2>
            <div className="space-y-2">
              <label htmlFor="wizard-target" className="block text-xs font-medium text-slate-300">
                Registered Target
              </label>
              <select
                id="wizard-target"
                value={effectiveTargetId}
                onChange={(e) => {
                  setSelectedTargetId(e.target.value);
                  setSelectedIdentityIds([]);
                }}
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                {(targetsQ.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName} ({t.normalizedBaseUrl}) — {formatEnvironmentLabel(t.environment)}
                  </option>
                ))}
              </select>
            </div>

            {target && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-300">
                    Project: <span className="font-medium text-slate-100">{target.projectName}</span> · Permission Ref:{' '}
                    <span className="font-mono text-slate-200">{target.permissionReference}</span>
                  </div>
                  <div className="text-slate-400">
                    Environment: {formatEnvironmentLabel(target.environment)}
                  </div>
                </div>
                <TargetAuthBadge status={target.authorizationStatus} />
              </div>
            )}
          </Panel>

          {/* Step 3: Modules */}
          <Panel className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">2. Select Assessment Modules</h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {AVAILABLE_MODULES.map((mod) => {
                const checked = selectedModules.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-xs transition-colors ${
                      checked
                        ? 'border-teal-600/60 bg-teal-950/30 text-slate-100'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(mod.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="font-medium">
                        {mod.label} <span className="font-mono text-[10px] text-slate-400">({mod.semester})</span>
                      </div>
                      <p className="mt-0.5 text-slate-400">{mod.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Panel>

          {/* Step 4 & 5: Scope & Budgets */}
          <Panel className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">3. Approved Scope Snapshot & Budgets</h2>
              {target && (
                <Link to={`/app/targets/${target.id}/scope`} className="text-xs text-teal-400 hover:text-teal-300">
                  Manage Scope
                </Link>
              )}
            </div>
            {activeScope ? (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ScopeVersionBadge versionLabel={activeScope.versionLabel} approvalState={activeScope.approvalState} />
                  <span className="font-mono text-slate-400">
                    Methods: {activeScope.allowedMethods.join(', ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono">
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                    <div className="text-[11px] text-slate-400">Max Depth</div>
                    <div className="text-slate-100 tabular-nums">{activeScope.budgets.maxCrawlDepth}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                    <div className="text-[11px] text-slate-400">Max Requests</div>
                    <div className="text-slate-100 tabular-nums">{activeScope.budgets.maxRequests}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                    <div className="text-[11px] text-slate-400">Rate Limit</div>
                    <div className="text-slate-100 tabular-nums">{activeScope.budgets.perHostRateRps} req/s</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                    <div className="text-[11px] text-slate-400">Wall Clock</div>
                    <div className="text-slate-100 tabular-nums">{activeScope.budgets.maxWallClockSeconds}s</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-300">No scope version exists for this target.</p>
            )}
          </Panel>

          {/* Step 6 & 7: Synthetic Identities & State-Changing Approval */}
          <Panel className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">4. Test Identities & State-Change Safeguards</h2>
            {targetIdentities.length === 0 ? (
              <p className="text-xs text-slate-400">
                No synthetic test identities bound to this target (unauthenticated passive discovery mode).
              </p>
            ) : (
              <div className="space-y-2">
                {targetIdentities.map((ident) => (
                  <label key={ident.id} className="flex items-center gap-2.5 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedIdentityIds.includes(ident.id)}
                      onChange={() =>
                        setSelectedIdentityIds((prev) =>
                          prev.includes(ident.id) ? prev.filter((x) => x !== ident.id) : [...prev, ident.id],
                        )
                      }
                    />
                    <span>{ident.label}</span>
                    <span className="font-mono text-slate-500">({ident.secretRefId})</span>
                  </label>
                ))}
              </div>
            )}

            {requiresStateChange && (
              <div className="mt-3 rounded border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200 space-y-2">
                <div className="font-semibold">Business Invariant Module Selected</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stateChangingApproved}
                    onChange={(e) => setStateChangingApproved(e.target.checked)}
                  />
                  Confirm disposable lab fixture reset procedure and approved invariant sequence are active
                </label>
              </div>
            )}
          </Panel>
        </div>

        {/* Right column: Authoritative Preflight + Safe Runner Readiness */}
        <div className="space-y-5">
          <Panel className="p-5 space-y-4 sticky top-20">
            <h2 className="text-sm font-semibold text-slate-100">Authoritative Backend Preflight</h2>

            {preflightQ.isLoading ? (
              <LoadingSkeleton rows={3} />
            ) : preflight ? (
              <>
                {preflight.blockers.length === 0 ? (
                  <div className="flex items-start gap-2.5 rounded-md border border-emerald-700/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" aria-hidden="true" />
                    <div>
                      <div className="font-semibold">Preflight Ready</div>
                      <p className="mt-0.5 text-emerald-200/80">
                        Target authorization, scope {preflight.scopeVersionLabel}, and runner gates passed.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5" role="alert">
                    {preflight.blockers.map((blocker) => (
                      <div
                        key={blocker.code}
                        className="rounded-md border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" aria-hidden="true" />
                          <span>{blocker.title}</span>
                        </div>
                        <p className="text-red-300/90">{blocker.detail}</p>
                        {blocker.remediationHref && (
                          <Link
                            to={blocker.remediationHref}
                            className="inline-block font-medium text-teal-300 underline hover:text-teal-200"
                          >
                            {blocker.remediationLabel ?? 'Resolve blocker'} &rarr;
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {launchMut.error && (
                  <ErrorState message={launchMut.error instanceof Error ? launchMut.error.message : 'Launch blocked'} />
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  disabled={!preflight.canLaunch || !authMapped.canLaunch || launchMut.isPending}
                  onClick={() => launchMut.mutate()}
                >
                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                  {launchMut.isPending ? 'Submitting Run...' : 'Submit Assessment Run'}
                </Button>
              </>
            ) : null}
          </Panel>

          <RunnerReadinessPanel readiness={preflight?.runnerReadiness} isLoading={preflightQ.isLoading} compact />
        </div>
      </div>
    </div>
  );
}

export function AssessmentRunsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [runToDelete, setRunToDelete] = useState<AssessmentRun | null>(null);

  const runsQ = useQuery({ queryKey: ['runs'], queryFn: () => apiClient.getRuns() });

  const deleteMut = useMutation({
    mutationFn: (runId: string) => apiClient.deleteRun(runId),
    onSuccess: () => {
      setRunToDelete(null);
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (runsQ.data ?? []).filter((r) => {
      const matchState = stateFilter === 'all' || r.state === stateFilter;
      const matchQ =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.targetName.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q);
      return matchState && matchQ;
    });
  }, [runsQ.data, search, stateFilter]);

  const columns = [
    {
      key: 'id',
      header: 'Run ID',
      render: (r: AssessmentRun) => <span className="font-mono text-xs font-semibold text-teal-400">{r.id}</span>,
    },
    {
      key: 'target',
      header: 'Project / Target',
      render: (r: AssessmentRun) => (
        <div>
          <div className="font-medium text-slate-100">{r.targetName}</div>
          <div className="text-xs text-slate-400">{r.projectName}</div>
        </div>
      ),
    },
    {
      key: 'env',
      header: 'Env / Scope',
      render: (r: AssessmentRun) => (
        <span className="font-mono text-xs text-slate-300">
          {formatEnvironmentLabel(r.environment)} · {r.scopeVersionLabel}
        </span>
      ),
    },
    { key: 'state', header: 'State', render: (r: AssessmentRun) => <RunStateBadge state={r.state} /> },
    {
      key: 'reqs',
      header: 'Reqs / Budget',
      align: 'right' as const,
      render: (r: AssessmentRun) => (
        <span className="font-mono text-xs tabular-nums">
          {r.requestCount} / {r.requestBudget}
        </span>
      ),
    },
    {
      key: 'urls',
      header: 'URLs',
      align: 'right' as const,
      render: (r: AssessmentRun) => <span className="font-mono text-xs tabular-nums">{r.inScopeUrlsCount}</span>,
    },
    {
      key: 'findings',
      header: 'Findings',
      align: 'right' as const,
      render: (r: AssessmentRun) => <span className="font-mono text-xs tabular-nums">{r.findingsCount}</span>,
    },
    {
      key: 'started',
      header: 'Started / Duration',
      render: (r: AssessmentRun) => (
        <div className="font-mono text-xs tabular-nums">
          <div>{formatTimestamp(r.startedAt)}</div>
          <div className="text-slate-400">{formatDurationSeconds(r.durationSeconds)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (r: AssessmentRun) => {
        const stateDeletable = canDeleteAssessmentRun(r.state);
        const canDelete = roleCapabilities.canDeleteRecords && stateDeletable;
        const title = !roleCapabilities.canDeleteRecords
          ? 'Read-only roles cannot delete assessment runs'
          : !stateDeletable
            ? 'Active or queued runs must be cancelled before deletion'
            : `Delete run ${r.id}`;
        return (
          <div className="flex justify-end">
            <DeleteIconButton
              label={`Delete run ${r.id}`}
              title={title}
              disabled={!canDelete}
              onClick={() => {
                deleteMut.reset();
                setRunToDelete(r);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Assessments' }]}
        title="Assessment Runs"
        description="Track queued, active, cancelled, partial, and completed assessments with bound scope snapshots."
        actions={
          roleCapabilities.canLaunchAssessment && (
            <Button variant="primary" onClick={() => navigate('/app/assessments/new')}>
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              New Assessment
            </Button>
          )
        }
      />

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by Run ID, project, or target...">
        <select
          aria-label="Run state filter"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All States</option>
          <option value="running">Running</option>
          <option value="queued">Queued</option>
          <option value="cancellation_requested">Cancellation Requested</option>
          <option value="partial">Partial</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </FilterToolbar>

      {runsQ.error ? (
        <ErrorState message="Failed to load assessment runs." onRetry={() => runsQ.refetch()} />
      ) : runsQ.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching runs" description="Adjust filters or launch a new bounded assessment." />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/assessments/${r.id}/monitor`)}
        />
      )}

      <ConfirmDialog
        open={Boolean(runToDelete)}
        title="Delete Assessment Run"
        description={
          runToDelete
            ? `Delete assessment run ${runToDelete.id} (${runToDelete.targetName}, state: ${runToDelete.state}) from the runs history?`
            : ''
        }
        confirmLabel="Delete Run"
        isPending={deleteMut.isPending}
        onConfirm={() => runToDelete && deleteMut.mutate(runToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setRunToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete assessment run.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

type MonitorTab = 'overview' | 'activity' | 'assets' | 'findings' | 'evidence' | 'config';

export function AssessmentRunMonitorPage() {
  const { runId = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<MonitorTab>('overview');
  const [cancelOpen, setCancelOpen] = useState(false);

  const runQ = useQuery({
    queryKey: ['run', runId],
    queryFn: () => apiClient.getRunById(runId),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const state = query.state.data?.run.state;
      return state === 'running' || state === 'queued' || state === 'cancellation_requested' ? 1200 : false;
    },
  });

  const runnerHealthQ = useQuery({
    queryKey: ['runner-health'],
    queryFn: () => apiClient.getRunnerHealth(),
  });

  const cancelMut = useMutation({
    mutationFn: () => apiClient.requestRunCancellation(runId),
    onSuccess: () => {
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ['run', runId] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  useEffect(() => {
    if (runQ.data?.run.state === 'partial' || runQ.data?.run.state === 'cancelled') {
      qc.invalidateQueries({ queryKey: ['runs'] });
    }
  }, [runQ.data?.run.state, qc]);

  if (runQ.isLoading) return <LoadingSkeleton rows={6} />;
  if (runQ.error || !runQ.data) {
    return <ErrorState message={`Assessment run "${runId}" could not be loaded.`} onRetry={() => runQ.refetch()} />;
  }

  const { run, discoveredUrls, findings, evidence } = runQ.data;
  const canCancel = run.state === 'running' || run.state === 'queued';
  const isCancelling = run.state === 'cancellation_requested';

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Assessments', to: '/app/assessments' },
          { label: run.id },
        ]}
        title={`Run Monitor: ${run.id}`}
        description={`${run.targetName} (${run.baseUrl}) · ${formatEnvironmentLabel(run.environment)} · Scope ${run.scopeVersionLabel}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => runQ.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh Status
            </Button>
            {canCancel && (
              <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                <StopCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Cancel Run
              </Button>
            )}
          </>
        }
      />

      {/* Status & Progress Banner */}
      <Panel className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <RunStateBadge state={run.state} />
              <span className="text-sm font-medium text-slate-200">{run.currentPhase}</span>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              Started: {formatTimestamp(run.startedAt)} · Duration: {formatDurationSeconds(run.durationSeconds)} · Initiated by: {run.initiatedBy}
            </div>
          </div>
          <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
            <div>
              Requests: <span className="font-semibold text-slate-100">{run.requestCount}</span> / {run.requestBudget}
            </div>
            <div className="text-slate-400">
              In-scope URLs: {run.inScopeUrlsCount} · Blocked redirects: {run.blockedRedirectsCount}
            </div>
          </div>
        </div>

        {/* Progress Bar (honest determinate vs indeterminate) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isCancelling ? 'Waiting for backend worker cancellation confirmation...' : run.currentPhase}</span>
            <span className="font-mono tabular-nums">
              {typeof run.progressPercent === 'number' ? `${run.progressPercent}%` : 'Indeterminate'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
            {typeof run.progressPercent === 'number' ? (
              <div
                className={`h-full transition-all duration-300 ${
                  run.state === 'failed'
                    ? 'bg-red-500'
                    : run.state === 'partial' || run.state === 'cancelled' || isCancelling
                      ? 'bg-amber-500'
                      : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, run.progressPercent))}%` }}
              />
            ) : (
              <div className="h-full w-1/3 animate-pulse bg-slate-500" />
            )}
          </div>
        </div>

        {run.retainedSummary && (
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            {run.retainedSummary}
          </div>
        )}
      </Panel>

      <TabBar
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'activity', label: 'Activity Log', count: run.events.length },
          { id: 'assets', label: 'Discovered Assets', count: discoveredUrls.length },
          { id: 'findings', label: 'Findings & Observations', count: findings.length },
          { id: 'evidence', label: 'Evidence Summary', count: evidence.length },
          { id: 'config', label: 'Run Configuration' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">Execution Phase Timeline</h2>
            <RunStateTimeline phases={run.phases} />
          </Panel>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Discovered URLs" value={run.discoveredUrlsCount} subtext={`${run.inScopeUrlsCount} in scope`} />
              <MetricCard label="Excluded / Duplicates" value={`${run.excludedUrlsCount} / ${run.duplicateUrlsCount}`} subtext={`${run.blockedRedirectsCount} blocked redirects`} />
            </div>
            <RunnerReadinessPanel readiness={runnerHealthQ.data} isLoading={runnerHealthQ.isLoading} />
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Sanitized Controller & Runner Events</h2>
          <div className="divide-y divide-slate-800">
            {run.events.map((ev) => (
              <div key={ev.id} className="py-2.5 flex flex-wrap items-start justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="font-mono text-teal-400">[{ev.phase}]</span>{' '}
                  <span className={ev.level === 'error' ? 'text-red-300' : ev.level === 'warning' ? 'text-amber-300' : 'text-slate-200'}>
                    {ev.message}
                  </span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">{formatTimestamp(ev.timestamp)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'assets' && (
        <Panel className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Discovered URLs & Routes</h2>
            <Link to="/app/inventory/urls" className="text-xs text-teal-400 hover:text-teal-300">
              Open Full URL Inventory &rarr;
            </Link>
          </div>
          {discoveredUrls.length === 0 ? (
            <p className="text-xs text-slate-400">No URLs discovered in this run.</p>
          ) : (
            <ul className="divide-y divide-slate-800 text-xs">
              {discoveredUrls.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2.5">
                  <Link to={`/app/inventory/urls/${u.id}`} className="font-mono text-teal-400 hover:underline truncate">
                    {u.method ?? 'GET'} {u.normalizedUrl}
                  </Link>
                  <span className="font-mono text-slate-400 shrink-0">{u.scopeStatus}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'findings' && (
        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Findings Recorded in {run.id}</h2>
          {findings.length === 0 ? (
            <p className="text-xs text-slate-400">
              Zero findings recorded in this run. Note: bounded discovery/passive runs do not prove target security.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800 text-xs">
              {findings.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2.5">
                  <Link to={`/app/findings/${f.id}`} className="font-medium text-slate-100 hover:text-teal-400">
                    {f.id} · {f.title}
                  </Link>
                  <span className="font-mono text-slate-400">{f.severity}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'evidence' && (
        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Redacted Evidence Snapshots</h2>
          {evidence.length === 0 ? (
            <p className="text-xs text-slate-400">No evidence records captured for this run.</p>
          ) : (
            <div className="space-y-3">
              {evidence.map((ev) => (
                <div key={ev.id} className="rounded border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <Link to={`/app/evidence/${ev.id}`} className="font-mono text-teal-400 hover:underline">
                      {ev.id} · {ev.operationOrUrl}
                    </Link>
                    <span className="font-mono text-slate-400">{ev.redactionStatus}</span>
                  </div>
                  <SafeText text={ev.redactedRequestSummary} mono maxChars={400} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'config' && (
        <Panel className="p-5 space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Immutable Run Snapshot</h2>
          <div>Target: <span className="font-mono text-slate-200">{run.baseUrl}</span></div>
          <div>Scope Version: <span className="font-mono text-slate-200">{run.scopeVersionLabel}</span></div>
          <div>Modules: <span className="font-mono text-slate-200">{run.modules.join(', ')}</span></div>
          <div>Request Budget: <span className="font-mono text-slate-200 tabular-nums">{run.requestBudget}</span></div>
        </Panel>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={`Cancel Assessment ${run.id}?`}
        description={`This sends a cancellation request to the backend controller for "${run.targetName}". The run will transition to "Cancellation Requested" until the isolated worker confirms termination and retains partial results.`}
        confirmLabel="Request Cancellation"
        isPending={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate()}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}
