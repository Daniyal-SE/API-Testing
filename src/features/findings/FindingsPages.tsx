import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSession } from '@/src/app/providers';
import { DataTable, FilterToolbar } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { FindingStatusBadge, SafeText, SeverityBadge } from '@/src/components/security/StatusBadges';
import { Button, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { Finding, FindingReviewStatus } from '@/src/types/domain';

export function FindingsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const findingsQ = useQuery({ queryKey: ['findings'], queryFn: () => apiClient.getFindings() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (findingsQ.data ?? []).filter((f) => {
      const mSev = severityFilter === 'all' || f.severity === severityFilter;
      const mStat = statusFilter === 'all' || f.status === statusFilter;
      const mQ =
        !q ||
        f.id.toLowerCase().includes(q) ||
        f.title.toLowerCase().includes(q) ||
        f.affectedAsset.toLowerCase().includes(q);
      return mSev && mStat && mQ;
    });
  }, [findingsQ.data, search, severityFilter, statusFilter]);

  const columns = [
    {
      key: 'title',
      header: 'Finding / Category',
      render: (f: Finding) => (
        <div>
          <Link to={`/app/findings/${f.id}`} className="font-medium text-slate-100 hover:text-teal-400">
            <span className="font-mono text-xs text-teal-400 mr-2">{f.id}</span>
            {f.title}
          </Link>
          <div className="text-xs text-slate-400">{f.category} · {f.targetName}</div>
        </div>
      ),
    },
    { key: 'sev', header: 'Severity', render: (f: Finding) => <SeverityBadge severity={f.severity} /> },
    { key: 'conf', header: 'Confidence', render: (f: Finding) => <span className="text-xs text-slate-300">{f.confidence}</span> },
    { key: 'status', header: 'Review State', render: (f: Finding) => <FindingStatusBadge status={f.status} /> },
    { key: 'asset', header: 'Affected URL / Operation', render: (f: Finding) => <span className="font-mono text-xs text-slate-300">{f.affectedAsset}</span> },
    { key: 'updated', header: 'Updated', render: (f: Finding) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(f.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Results (Sem 8)' }, { label: 'Findings' }]}
        title="Findings & Triage"
        description="Review raw alerts, candidate observations, validated findings, and regression verification states."
      />

      <FilterToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search findings by ID, title, or endpoint...">
        <select
          aria-label="Filter by severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Statuses</option>
          <option value="raw_alert">Raw Alert</option>
          <option value="candidate_observation">Candidate Observation</option>
          <option value="needs_review">Needs Review</option>
          <option value="validated_finding">Validated Finding</option>
          <option value="false_positive">False Positive</option>
          <option value="retest_pending">Retest Pending</option>
          <option value="fixed">Fixed (Verified)</option>
        </select>
      </FilterToolbar>

      {findingsQ.error ? (
        <ErrorState message="Failed to load findings." onRetry={() => findingsQ.refetch()} />
      ) : findingsQ.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No findings match current filters" description="Zero visible findings does not prove target security." />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(f) => f.id} onRowClick={(f) => navigate(`/app/findings/${f.id}`)} />
      )}
    </div>
  );
}

export function FindingDetailPage() {
  const { findingId = '' } = useParams();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();

  const detailQ = useQuery({
    queryKey: ['finding', findingId],
    queryFn: () => apiClient.getFindingById(findingId),
    enabled: Boolean(findingId),
  });

  const [nextStatus, setNextStatus] = useState<FindingReviewStatus>('validated_finding');
  const [rationale, setRationale] = useState('');
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const reviewMut = useMutation({
    mutationFn: () => apiClient.updateFindingReview(findingId, nextStatus, rationale),
    onSuccess: () => {
      setRationale('');
      qc.invalidateQueries({ queryKey: ['finding', findingId] });
      qc.invalidateQueries({ queryKey: ['findings'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  if (detailQ.isLoading) return <LoadingSkeleton rows={6} />;
  if (detailQ.error || !detailQ.data) return <ErrorState message="Finding not found." />;

  const { finding, evidence, auditLogs } = detailQ.data;

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rationale.trim().length < 5) {
      setValidationMsg('Provide a short reviewer rationale (at least 5 characters) for the audit trail.');
      return;
    }
    setValidationMsg(null);
    reviewMut.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Findings', to: '/app/findings' },
          { label: finding.id },
        ]}
        title={`${finding.id}: ${finding.title}`}
        description={`${finding.category} · ${finding.targetName} · Run ${finding.runId} (Scope ${finding.scopeVersionLabel})`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel className="p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity={finding.severity} />
              <FindingStatusBadge status={finding.status} />
              <span className="text-slate-400">Confidence: {finding.confidence}</span>
              <span className="font-mono text-slate-400">Tool: {finding.toolProvenance}</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{finding.description}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-slate-800 pt-4">
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Expected Result</h3>
                <SafeText text={finding.expectedResult} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Observed Result</h3>
                <SafeText text={finding.observedResult} />
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <h3 className="font-semibold text-slate-200 mb-1.5">Reproduction Steps</h3>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                {finding.reproductionSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <h3 className="font-semibold text-slate-200 mb-1">Remediation Guidance</h3>
              <p className="text-slate-300">{finding.remediationNotes}</p>
            </div>
          </Panel>

          {evidence && (
            <Panel className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Redacted Proof ({evidence.id})</h2>
                <Link to={`/app/evidence/${evidence.id}`} className="text-xs text-teal-400 hover:underline">
                  Open Evidence Explorer &rarr;
                </Link>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <SafeText text={evidence.boundedResponseExcerpt} mono maxChars={600} />
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">Finding Triage Review</h2>
            {finding.reviewerRationale && (
              <div className="rounded border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                <div className="text-slate-400 mb-0.5">Latest Rationale</div>
                {finding.reviewerRationale}
              </div>
            )}

            {roleCapabilities.canTriageFindings ? (
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                {validationMsg && <p role="alert" className="text-xs text-red-400">{validationMsg}</p>}
                <FormField id="triage-state" label="Transition Review State">
                  <select
                    id="triage-state"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as FindingReviewStatus)}
                    className={inputClassName}
                  >
                    <option value="validated_finding">Validated Finding</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="false_positive">False Positive</option>
                    <option value="retest_pending">Request Regression Retest</option>
                  </select>
                </FormField>
                <FormField id="triage-rationale" label="Reviewer Rationale" required>
                  <textarea
                    id="triage-rationale"
                    rows={3}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Document verification basis before updating status..."
                    className={inputClassName}
                  />
                </FormField>
                <Button type="submit" variant="primary" className="w-full" disabled={reviewMut.isPending}>
                  {reviewMut.isPending ? 'Saving Review...' : 'Update Review State'}
                </Button>
                <p className="text-[11px] text-slate-500">
                  Findings transition to Fixed only after backend regression re-verification succeeds.
                </p>
              </form>
            ) : (
              <p className="text-xs text-slate-400">
                Read-only view: your role can inspect evidence and audit history but cannot alter triage status.
              </p>
            )}
          </Panel>

          <Panel className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Related Audit Trail</h2>
            <ul className="divide-y divide-slate-800 text-xs">
              {auditLogs.map((a) => (
                <li key={a.id} className="py-2 space-y-0.5">
                  <div className="font-mono text-teal-400">{a.action}</div>
                  <div className="text-slate-300">{a.detail}</div>
                  <div className="font-mono text-[11px] text-slate-500 tabular-nums">{formatTimestamp(a.timestamp)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
