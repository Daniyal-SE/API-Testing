import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { DataTable, FilterToolbar } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { FindingStatusBadge, SafeText, SemanticBadge, SeverityBadge } from '@/src/components/security/StatusBadges';
import { Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { ZapAlertItem } from '@/src/types/domain';

export function ZapResultsPage() {
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');

  const alertsQ = useQuery({ queryKey: ['zap-alerts'], queryFn: () => apiClient.getZapAlerts() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (alertsQ.data ?? []).filter((a) => {
      const mRev = reviewFilter === 'all' || a.reviewState === reviewFilter;
      const mQ =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.affectedUrl.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return mRev && mQ;
    });
  }, [alertsQ.data, search, reviewFilter]);

  const columns = [
    {
      key: 'title',
      header: 'Alert / Category',
      render: (z: ZapAlertItem) => (
        <div className="space-y-0.5">
          <div className="font-medium text-slate-100">{z.title}</div>
          <div className="text-xs text-slate-400">
            {z.category} · {z.toolName} {z.toolVersion}
          </div>
        </div>
      ),
    },
    {
      key: 'url',
      header: 'Affected URL',
      render: (z: ZapAlertItem) => <SafeText text={z.affectedUrl} mono maxChars={120} />,
    },
    {
      key: 'sev',
      header: 'Severity / Confidence',
      render: (z: ZapAlertItem) => (
        <div className="flex flex-col gap-1">
          <SeverityBadge severity={z.severity} />
          <span className="text-[11px] text-slate-400">Confidence: {z.confidence}</span>
        </div>
      ),
    },
    {
      key: 'profile',
      header: 'Check Profile',
      render: (z: ZapAlertItem) => (
        <SemanticBadge label={z.checkProfile.replace(/_/g, ' ')} tone="info" />
      ),
    },
    {
      key: 'review',
      header: 'Review Stage',
      render: (z: ZapAlertItem) => <FindingStatusBadge status={z.reviewState} />,
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: (z: ZapAlertItem) =>
        z.evidenceId ? (
          <Link to={`/app/evidence/${z.evidenceId}`} className="font-mono text-xs text-teal-400 hover:underline">
            {z.evidenceId}
          </Link>
        ) : (
          <span className="text-xs text-slate-500">None</span>
        ),
    },
    {
      key: 'detected',
      header: 'Detected',
      render: (z: ZapAlertItem) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(z.detectedAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Web Security (Sem 8)' }, { label: 'URL Security Results' }]}
        title="URL-Based Web Security & ZAP Results"
        description="Selected low-impact passive web checks executed within approved target scope. Active intrusive checks remain disabled unless policy-approved."
      />

      <Panel className="p-4 flex items-start gap-3 text-xs text-slate-300">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
        <div>
          <span className="font-semibold text-slate-100">Semester 8 Module · Demo Mode:</span> Raw scanner alerts and
          candidate observations are kept separate from validated findings until confirmed by evidence triage.
        </div>
      </Panel>

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search ZAP alerts by title, URL, or category...">
        <select
          aria-label="Filter by review stage"
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Stages</option>
          <option value="raw_alert">Raw Alert</option>
          <option value="candidate_observation">Candidate Observation</option>
          <option value="validated_finding">Validated Finding</option>
        </select>
      </FilterToolbar>

      {alertsQ.error ? (
        <ErrorState message="Failed to load ZAP passive results." onRetry={() => alertsQ.refetch()} />
      ) : alertsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No ZAP passive alerts matched" description="Run a passive web security module or clear filters." />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(z) => z.id} />
      )}
    </div>
  );
}
