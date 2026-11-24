import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DataTable, FilterToolbar } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SemanticBadge } from '@/src/components/security/StatusBadges';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import { formatRoleLabel } from '@/src/lib/status-mappers';
import type { AuditLogEntry } from '@/src/types/domain';

export function AuditHistoryPage() {
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const auditQ = useQuery({ queryKey: ['audit-logs'], queryFn: () => apiClient.getAuditLogs() });

  const actionTypes = useMemo(
    () => Array.from(new Set((auditQ.data ?? []).map((a) => a.action))),
    [auditQ.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (auditQ.data ?? []).filter((entry) => {
      const mOut = outcomeFilter === 'all' || entry.outcome === outcomeFilter;
      const mAct = actionFilter === 'all' || entry.action === actionFilter;
      const mQ =
        !q ||
        entry.actorEmail.toLowerCase().includes(q) ||
        entry.detail.toLowerCase().includes(q) ||
        entry.resourceId.toLowerCase().includes(q) ||
        (entry.targetName ?? '').toLowerCase().includes(q);
      return mOut && mAct && mQ;
    });
  }, [auditQ.data, search, outcomeFilter, actionFilter]);

  const columns = [
    {
      key: 'ts',
      header: 'Timestamp',
      render: (e: AuditLogEntry) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(e.timestamp)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (e: AuditLogEntry) => (
        <div>
          <div className="font-mono text-xs text-slate-200">{e.actorEmail}</div>
          <div className="text-[11px] text-slate-400">{formatRoleLabel(e.actorRole)}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (e: AuditLogEntry) => <span className="font-mono text-xs text-teal-400">{e.action}</span>,
    },
    {
      key: 'resource',
      header: 'Resource / Run',
      render: (e: AuditLogEntry) => (
        <div className="text-xs">
          <span className="text-slate-300">{e.resourceType}</span>
          <span className="mx-1 text-slate-600">/</span>
          <span className="font-mono text-slate-200">{e.resourceId}</span>
          {e.correlationRunId && (
            <div>
              <Link to={`/app/assessments/${e.correlationRunId}/monitor`} className="font-mono text-[11px] text-teal-400 hover:underline">
                Run: {e.correlationRunId}
              </Link>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (e: AuditLogEntry) => (
        <SemanticBadge
          label={e.outcome}
          tone={e.outcome === 'success' ? 'success' : e.outcome === 'blocked' ? 'warning' : 'error'}
        />
      ),
    },
    {
      key: 'detail',
      header: 'Details',
      render: (e: AuditLogEntry) => <span className="text-xs text-slate-300">{e.detail}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Governance' }, { label: 'Audit History' }]}
        title="Audit & Governance History"
        description="Chronological record of user authentication, target authorization decisions, scope approvals, assessment launches, and finding reviews."
      />

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Filter by actor, target, resource ID, or detail...">
        <select
          aria-label="Action type filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Actions</option>
          {actionTypes.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
        <select
          aria-label="Outcome filter"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Outcomes</option>
          <option value="success">Success</option>
          <option value="blocked">Blocked</option>
          <option value="failed">Failed</option>
        </select>
      </FilterToolbar>

      {auditQ.error ? (
        <ErrorState message="Failed to load audit log." onRetry={() => auditQ.refetch()} />
      ) : auditQ.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audit events match your filter" description="Broaden your search or outcome filter." />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(e) => e.id} />
      )}
    </div>
  );
}
