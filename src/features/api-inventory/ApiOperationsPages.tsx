import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DataTable, FilterToolbar } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { RunStateBadge, SafeText, SemanticBadge } from '@/src/components/security/StatusBadges';
import { Panel, SideDrawer } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { ApiOperation, ContractTestCase, ContractTestRun } from '@/src/types/domain';

export function ApiOperationsPage() {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');

  const opsQ = useQuery({ queryKey: ['api-operations'], queryFn: () => apiClient.getOperations() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (opsQ.data ?? []).filter((op) => {
      const mMethod = methodFilter === 'all' || op.method === methodFilter;
      const mElig =
        eligibilityFilter === 'all' ||
        (eligibilityFilter === 'eligible' ? op.scopeEligible : !op.scopeEligible);
      const mQ =
        !q ||
        op.path.toLowerCase().includes(q) ||
        op.operationId.toLowerCase().includes(q) ||
        op.tags.some((t) => t.toLowerCase().includes(q));
      return mMethod && mElig && mQ;
    });
  }, [opsQ.data, search, methodFilter, eligibilityFilter]);

  const columns = [
    {
      key: 'method',
      header: 'Method',
      render: (op: ApiOperation) => (
        <span className={`font-mono text-xs font-semibold ${op.stateChanging ? 'text-amber-400' : 'text-teal-400'}`}>
          {op.method}
        </span>
      ),
    },
    {
      key: 'path',
      header: 'Path / Operation ID',
      render: (op: ApiOperation) => (
        <div>
          <div className="font-mono text-xs text-slate-100">{op.path}</div>
          <div className="text-[11px] text-slate-400">{op.operationId} · {op.tags.join(', ')}</div>
        </div>
      ),
    },
    { key: 'auth', header: 'Security Scheme', render: (op: ApiOperation) => <span className="font-mono text-xs text-slate-300">{op.authScheme}</span> },
    {
      key: 'schemas',
      header: 'Req / Resp Schema',
      render: (op: ApiOperation) => (
        <span className="font-mono text-xs text-slate-300">
          {op.hasRequestSchema ? 'Req' : '—'} / {op.hasResponseSchema ? 'Resp' : '—'}
        </span>
      ),
    },
    { key: 'contract', header: 'Contract', render: (op: ApiOperation) => <span className="text-xs text-slate-300">{op.contractName}</span> },
    {
      key: 'elig',
      header: 'Scope Eligible',
      render: (op: ApiOperation) => (
        <SemanticBadge
          label={op.scopeEligible ? 'Eligible (Read-Only)' : 'Disabled (State-Changing)'}
          tone={op.scopeEligible ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Test Status',
      render: (op: ApiOperation) => (
        <SemanticBadge
          label={op.testStatus.replace(/_/g, ' ')}
          tone={op.testStatus === 'passed' ? 'success' : op.testStatus === 'schema_mismatch' ? 'error' : 'neutral'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'API (Sem 8)' }, { label: 'API Operations' }]}
        title="API Operations Inventory"
        description="Filterable OpenAPI operations inventory showing security schemes, schema availability, and read-only vs state-changing scope eligibility."
      />

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by path, operationId, or tag...">
        <select
          aria-label="Filter by HTTP method"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        <select
          aria-label="Filter by scope eligibility"
          value={eligibilityFilter}
          onChange={(e) => setEligibilityFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Eligibility</option>
          <option value="eligible">Scope Eligible</option>
          <option value="disabled">State-Changing Disabled</option>
        </select>
      </FilterToolbar>

      {opsQ.error ? (
        <ErrorState message="Failed to load API operations." onRetry={() => opsQ.refetch()} />
      ) : opsQ.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching operations" description="Import an OpenAPI contract or adjust your filters." />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(o) => o.id} />
      )}
    </div>
  );
}

export function ContractTestsListPage() {
  const navigate = useNavigate();
  const runsQ = useQuery({ queryKey: ['contract-test-runs'], queryFn: () => apiClient.getContractTestRuns() });

  const columns = [
    {
      key: 'id',
      header: 'Run ID',
      render: (r: ContractTestRun) => <span className="font-mono text-xs font-semibold text-teal-400">{r.id}</span>,
    },
    { key: 'contract', header: 'Contract / Target', render: (r: ContractTestRun) => <span className="text-xs text-slate-200">{r.contractName} · {r.targetName}</span> },
    { key: 'cats', header: 'Categories', render: (r: ContractTestRun) => <span className="font-mono text-xs text-slate-300">{r.categories.join(', ')}</span> },
    { key: 'seed', header: 'Seed / Identity', render: (r: ContractTestRun) => <span className="font-mono text-xs text-slate-400">#{r.seed} · {r.identityLabel}</span> },
    { key: 'state', header: 'State', render: (r: ContractTestRun) => <RunStateBadge state={r.state} /> },
    {
      key: 'cases',
      header: 'Pass / Fail / Total',
      align: 'right' as const,
      render: (r: ContractTestRun) => <span className="font-mono text-xs tabular-nums">{r.passedCases} / {r.failedCases} / {r.totalCases}</span>,
    },
    { key: 'started', header: 'Started', render: (r: ContractTestRun) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(r.startedAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'API (Sem 8)' }, { label: 'Contract Testing' }]}
        title="API Contract & Schema Testing"
        description="Schema-driven positive, negative, type, and boundary test runs with deterministic reproducibility seeds."
      />

      {runsQ.error ? (
        <ErrorState message="Failed to load contract test runs." onRetry={() => runsQ.refetch()} />
      ) : runsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <DataTable
          columns={columns}
          rows={runsQ.data ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/api-tests/${r.id}`)}
        />
      )}
    </div>
  );
}

export function ContractTestRunDetailPage() {
  const { runId = '' } = useParams();
  const [selectedCase, setSelectedCase] = useState<ContractTestCase | null>(null);

  const runQ = useQuery({
    queryKey: ['contract-test-run', runId],
    queryFn: () => apiClient.getContractTestRunById(runId),
    enabled: Boolean(runId),
  });

  if (runQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (runQ.error || !runQ.data) return <ErrorState message="Contract test run not found." />;

  const run = runQ.data;

  const columns = [
    {
      key: 'op',
      header: 'Operation',
      render: (c: ContractTestCase) => (
        <div className="font-mono text-xs">
          <span className="text-teal-400 font-semibold">{c.method}</span> {c.path}
        </div>
      ),
    },
    { key: 'cat', header: 'Category', render: (c: ContractTestCase) => <span className="font-mono text-xs text-slate-300">{c.category}</span> },
    {
      key: 'req',
      header: 'Redacted Request',
      render: (c: ContractTestCase) => <span className="font-mono text-xs text-slate-400 truncate max-w-xs block">{c.redactedRequestSummary}</span>,
    },
    {
      key: 'status',
      header: 'HTTP Status',
      align: 'right' as const,
      render: (c: ContractTestCase) => <span className="font-mono text-xs tabular-nums">{c.responseStatus ?? '—'}</span>,
    },
    { key: 'schema', header: 'Schema Result', render: (c: ContractTestCase) => <span className="font-mono text-xs text-slate-300">{c.schemaResult}</span> },
    {
      key: 'dur',
      header: 'Duration',
      align: 'right' as const,
      render: (c: ContractTestCase) => <span className="font-mono text-xs tabular-nums">{c.durationMs}ms</span>,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (c: ContractTestCase) => (
        <SemanticBadge
          label={c.outcome}
          tone={c.outcome === 'passed' ? 'success' : c.outcome === 'failed' ? 'error' : 'warning'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Contract Testing', to: '/app/api-tests' },
          { label: run.id },
        ]}
        title={`Contract Test Run: ${run.id}`}
        description={`${run.contractName} · Scope ${run.scopeVersionLabel} · Reproducibility Seed #${run.seed} · Identity: ${run.identityLabel}`}
      />

      <Panel className="p-4 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
        <span>
          State-changing operations remain disabled unless explicitly authorized by a separate backend policy.
        </span>
        <Link to="/app/api-operations" className="text-teal-400 hover:underline">
          View Operations Inventory
        </Link>
      </Panel>

      <DataTable columns={columns} rows={run.cases} rowKey={(c) => c.id} onRowClick={(c) => setSelectedCase(c)} />

      <SideDrawer
        open={Boolean(selectedCase)}
        title={selectedCase ? `${selectedCase.method} ${selectedCase.path}` : ''}
        subtitle={selectedCase ? `Category: ${selectedCase.category} · Schema: ${selectedCase.schemaResult}` : ''}
        onClose={() => setSelectedCase(null)}
      >
        {selectedCase && (
          <div className="space-y-4 text-xs">
            <div>
              <div className="font-semibold text-slate-200 mb-1">Redacted Request Summary</div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <SafeText text={selectedCase.redactedRequestSummary} mono />
              </div>
              {selectedCase.redactedFields.length > 0 && (
                <p className="mt-1 text-slate-400">Redacted headers/fields: {selectedCase.redactedFields.join(', ')}</p>
              )}
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-1">Expected Result</div>
              <SafeText text={selectedCase.expectedSummary} />
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-1">Observed Result</div>
              <SafeText text={selectedCase.observedSummary} />
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
