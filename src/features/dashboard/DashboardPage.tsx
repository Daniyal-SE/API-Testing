import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PlayCircle, PlusCircle, ShieldAlert } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable, MetricCard, SeverityDistributionChart } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { RunStateBadge, TargetAuthBadge } from '@/src/components/security/StatusBadges';
import { Button, Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatDurationSeconds, formatTimestamp } from '@/src/lib/formatters';
import { formatEnvironmentLabel } from '@/src/lib/status-mappers';
import type { AssessmentRun } from '@/src/types/domain';

export function DashboardPage() {
  const { activeWorkspaceId, activeWorkspace, roleCapabilities } = useAppSession();
  const navigate = useNavigate();
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  const projectsQ = useQuery({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: () => apiClient.getProjects(activeWorkspaceId),
  });
  const targetsQ = useQuery({ queryKey: ['targets'], queryFn: () => apiClient.getTargets() });
  const runsQ = useQuery({ queryKey: ['runs'], queryFn: () => apiClient.getRuns() });
  const findingsQ = useQuery({ queryKey: ['findings'], queryFn: () => apiClient.getFindings() });
  const auditQ = useQuery({ queryKey: ['audit-logs'], queryFn: () => apiClient.getAuditLogs() });

  const workspaceProjectIds = useMemo(
    () => new Set((projectsQ.data ?? []).map((p) => p.id)),
    [projectsQ.data],
  );

  const filteredRuns = useMemo(() => {
    const base = (runsQ.data ?? []).filter((r) => workspaceProjectIds.has(r.projectId));
    const byProject = selectedProjectFilter === 'all' ? base : base.filter((r) => r.projectId === selectedProjectFilter);
    if (timeRange === '7d') {
      const cutoff = Date.now() - 7 * 86400_000;
      return byProject.filter((r) => new Date(r.startedAt).getTime() >= cutoff);
    }
    if (timeRange === '30d') {
      const cutoff = Date.now() - 30 * 86400_000;
      return byProject.filter((r) => new Date(r.startedAt).getTime() >= cutoff);
    }
    return byProject;
  }, [runsQ.data, workspaceProjectIds, selectedProjectFilter, timeRange]);

  const workspaceTargets = useMemo(
    () =>
      (targetsQ.data ?? []).filter(
        (t) => workspaceProjectIds.has(t.projectId) && (selectedProjectFilter === 'all' || t.projectId === selectedProjectFilter),
      ),
    [targetsQ.data, workspaceProjectIds, selectedProjectFilter],
  );

  const workspaceFindings = useMemo(
    () =>
      (findingsQ.data ?? []).filter(
        (f) => workspaceProjectIds.has(f.projectId) && (selectedProjectFilter === 'all' || f.projectId === selectedProjectFilter),
      ),
    [findingsQ.data, workspaceProjectIds, selectedProjectFilter],
  );

  const pendingTargets = workspaceTargets.filter((t) => t.authorizationStatus !== 'authorized');
  const activeJobs = filteredRuns.filter((r) => r.state === 'running' || r.state === 'queued' || r.state === 'cancellation_requested');

  const isLoading = projectsQ.isLoading || targetsQ.isLoading || runsQ.isLoading;
  const hasError = projectsQ.error || targetsQ.error || runsQ.error;

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of workspaceFindings) {
      const s = f.severity.toLowerCase();
      if (s === 'critical') counts.critical += 1;
      else if (s === 'high') counts.high += 1;
      else if (s === 'medium') counts.medium += 1;
      else if (s === 'low') counts.low += 1;
      else counts.info += 1;
    }
    return [
      { label: 'Critical', count: counts.critical, colorClass: 'bg-red-500' },
      { label: 'High', count: counts.high, colorClass: 'bg-orange-500' },
      { label: 'Medium', count: counts.medium, colorClass: 'bg-amber-500' },
      { label: 'Low', count: counts.low, colorClass: 'bg-sky-500' },
      { label: 'Informational', count: counts.info, colorClass: 'bg-slate-500' },
    ];
  }, [workspaceFindings]);

  const runColumns = [
    {
      key: 'id',
      header: 'Run ID',
      render: (r: AssessmentRun) => <span className="font-mono text-xs font-medium text-teal-400 whitespace-nowrap">{r.id}</span>,
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
      header: 'Environment',
      render: (r: AssessmentRun) => <span className="text-xs text-slate-300 whitespace-nowrap">{formatEnvironmentLabel(r.environment)}</span>,
    },
    {
      key: 'state',
      header: 'State',
      render: (r: AssessmentRun) => <RunStateBadge state={r.state} />,
    },
    {
      key: 'timing',
      header: 'Start / Duration',
      render: (r: AssessmentRun) => (
        <div className="font-mono text-xs tabular-nums whitespace-nowrap">
          <div>{formatTimestamp(r.startedAt)}</div>
          <div className="text-slate-400">{formatDurationSeconds(r.durationSeconds)}</div>
        </div>
      ),
    },
    {
      key: 'modules',
      header: 'Modules',
      render: (r: AssessmentRun) => <span className="font-mono text-xs text-slate-300">{r.modules.join(', ')}</span>,
    },
    {
      key: 'findings',
      header: 'Findings / Obs',
      align: 'right' as const,
      render: (r: AssessmentRun) => (
        <span className="font-mono text-xs tabular-nums">
          {r.findingsCount} / {r.observationsCount}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right' as const,
      render: (r: AssessmentRun) => (
        <Link
          to={`/app/assessments/${r.id}/monitor`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: activeWorkspace?.name ?? 'Workspace' }, { label: 'Dashboard' }]}
        title="Assessment Operations Dashboard"
        description="Permission-filtered overview of authorized targets, bounded assessment runs, findings distribution, and audit history."
        actions={
          <>
            {roleCapabilities.canCreateProject && (
              <Button variant="secondary" onClick={() => navigate('/app/projects/new')}>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New Project
              </Button>
            )}
            {roleCapabilities.canLaunchAssessment && (
              <Button variant="primary" onClick={() => navigate('/app/assessments/new')}>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                New Assessment
              </Button>
            )}
          </>
        }
      />

      {/* Context Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label htmlFor="dash-project-filter" className="text-slate-400">
            Project scope:
          </label>
          <select
            id="dash-project-filter"
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
          >
            <option value="all">All Accessible Projects ({projectsQ.data?.length ?? 0})</option>
            {(projectsQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-slate-950 p-1 border border-slate-800" role="group" aria-label="Time range filter">
          {[
            { id: '7d' as const, label: 'Last 7d' },
            { id: '30d' as const, label: 'Last 30d' },
            { id: 'all' as const, label: 'All Time' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTimeRange(opt.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                timeRange === opt.id ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {hasError && (
        <ErrorState
          message="Failed to load workspace dashboard metrics."
          onRetry={() => {
            projectsQ.refetch();
            targetsQ.refetch();
            runsQ.refetch();
          }}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (projectsQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No projects in this workspace yet"
          description="Create your first project, register a Local Lab or Staging target, record authorization, and configure an approved scope before running assessments."
          action={
            roleCapabilities.canCreateProject ? (
              <Button variant="primary" onClick={() => navigate('/app/projects/new')}>
                Create First Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Accessible Projects" value={projectsQ.data?.length ?? 0} subtext={activeWorkspace?.semesterLabel} />
            <MetricCard
              label="Registered Targets"
              value={workspaceTargets.length}
              subtext={`${workspaceTargets.filter((t) => t.authorizationStatus === 'authorized').length} authorized`}
            />
            <MetricCard label="Assessment Runs" value={filteredRuns.length} subtext={`Filter: ${timeRange}`} />
            <MetricCard
              label="Active Jobs"
              value={activeJobs.length}
              subtext={activeJobs.length > 0 ? 'Monitoring in progress' : 'No running jobs'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Finding Severity Distribution */}
            <SeverityDistributionChart
              title="Finding Severity Distribution"
              subtitle={`Filter: ${selectedProjectFilter === 'all' ? 'All projects' : selectedProjectFilter} · Window: ${timeRange}`}
              items={severityCounts}
            />

            {/* Targets Awaiting Authorization */}
            <Panel className="p-4 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Targets Requiring Authorization or Revalidation</h3>
                  <p className="text-xs text-slate-400">
                    Registered targets remain blocked from assessment launch until approved by a Project Owner.
                  </p>
                </div>
                <Link to="/app/targets" className="text-xs font-medium text-teal-400 hover:text-teal-300">
                  All Targets
                </Link>
              </div>
              {pendingTargets.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">All visible targets have active authorization records.</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {pendingTargets.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link to={`/app/targets/${t.id}/authorization`} className="text-sm font-medium text-slate-200 hover:text-teal-400">
                          {t.displayName}
                        </Link>
                        <div className="font-mono text-xs text-slate-400 truncate">{t.normalizedBaseUrl}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <TargetAuthBadge status={t.authorizationStatus} />
                        <Link
                          to={`/app/targets/${t.id}/authorization`}
                          className="text-xs font-medium text-teal-400 hover:text-teal-300"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Recent Assessment Runs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-100">Recent Assessment Runs</h2>
              <Link to="/app/assessments" className="text-xs font-medium text-teal-400 hover:text-teal-300">
                View All Runs
              </Link>
            </div>
            {filteredRuns.length === 0 ? (
              <EmptyState
                title="No assessment runs in selected window"
                description="Adjust the time filter or launch a bounded assessment on an authorized target."
              />
            ) : (
              <DataTable
                columns={runColumns}
                rows={filteredRuns.slice(0, 6)}
                rowKey={(r) => r.id}
                onRowClick={(r) => navigate(`/app/assessments/${r.id}/monitor`)}
              />
            )}
          </div>

          {/* Recent Audit Activity + Safety Caveat */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel className="p-4 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Recent Audit Activity</h2>
                <Link to="/app/audit" className="text-xs font-medium text-teal-400 hover:text-teal-300">
                  Full Audit Log
                </Link>
              </div>
              <ul className="divide-y divide-slate-800/80 text-xs">
                {(auditQ.data ?? []).slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <span className="font-mono text-teal-400">{entry.action}</span>
                      <span className="mx-2 text-slate-600">·</span>
                      <span className="text-slate-200">{entry.detail}</span>
                    </div>
                    <span className="font-mono text-slate-500 tabular-nums shrink-0">{formatTimestamp(entry.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>Assessment Interpretation Notice</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                All metrics reflect bounded, permission-filtered runs executed inside approved scopes. Zero findings or
                completed passive checks never prove that a target application is free of business-logic vulnerabilities.
              </p>
              <div className="pt-1">
                <Link to="/app/targets/new" className="text-xs font-medium text-teal-400 hover:text-teal-300">
                  Register a new target &rarr;
                </Link>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
