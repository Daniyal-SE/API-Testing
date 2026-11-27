import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SafeText, SemanticBadge } from '@/src/components/security/StatusBadges';
import { Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';

export function EvidenceDetailPage() {
  const { evidenceId = '' } = useParams();
  const listQ = useQuery({ queryKey: ['evidence-list'], queryFn: () => apiClient.getEvidenceList() });
  const detailQ = useQuery({
    queryKey: ['evidence', evidenceId],
    queryFn: () => apiClient.getEvidenceById(evidenceId),
    enabled: Boolean(evidenceId),
  });

  if (detailQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (detailQ.error || !detailQ.data) {
    return <ErrorState message={`Evidence record "${evidenceId}" not found.`} onRetry={() => detailQ.refetch()} />;
  }

  const ev = detailQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Results (Sem 8)' },
          { label: 'Evidence Explorer', to: '/app/findings' },
          { label: ev.id },
        ]}
        title={`Evidence Record: ${ev.id}`}
        description={`${ev.operationOrUrl} · Target: ${ev.targetName} · Bounded & redacted safe text inspection`}
      />

      {/* Quick selector for other captured evidence items */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Available Records:</span>
        {(listQ.data ?? []).map((item) => (
          <Link
            key={item.id}
            to={`/app/evidence/${item.id}`}
            className={`rounded border px-2.5 py-1 font-mono ${
              item.id === ev.id
                ? 'border-teal-500 bg-teal-950/60 text-teal-300'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
            }`}
          >
            {item.id}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Provenance & Snapshot</h2>
            <SemanticBadge label={ev.redactionStatus} tone="success" />
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-slate-400">Run / Scope</dt>
              <dd className="font-mono text-slate-200">
                <Link to={`/app/assessments/${ev.runId}/monitor`} className="text-teal-400 hover:underline">
                  {ev.runId}
                </Link>{' '}
                · Scope {ev.scopeVersionLabel}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Source & Type</dt>
              <dd className="font-mono text-slate-200">{ev.source} · {ev.evidenceType}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Actor Identity Label</dt>
              <dd className="text-slate-200">{ev.identityLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Preconditions</dt>
              <dd className="text-slate-300">{ev.preconditions}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Timestamp</dt>
              <dd className="font-mono text-slate-300 tabular-nums">{formatTimestamp(ev.timestamp)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Redacted Fields</dt>
              <dd className="font-mono text-amber-300">{ev.redactedFields.join(', ') || 'None'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Stable SHA-256 Identifier</dt>
              <dd className="font-mono text-[11px] text-slate-400 break-all">{ev.sha256Hash}</dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-5 lg:col-span-2">
          <Panel className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ShieldCheck className="h-4 w-4 text-teal-400" aria-hidden="true" />
              <span>Redacted Request Summary</span>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3.5">
              <SafeText text={ev.redactedRequestSummary} mono />
            </div>
          </Panel>

          <Panel className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Bounded Response Excerpt (HTTP {ev.responseStatus})
              </h2>
              <span className="text-[11px] text-slate-400">Rendered strictly as safe text (untrusted HTML escaped)</span>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3.5">
              <SafeText text={ev.boundedResponseExcerpt} mono maxChars={1200} />
            </div>
          </Panel>

          <Panel className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">Expected Result</h3>
              <SafeText text={ev.expectedResult} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">Observed Result</h3>
              <SafeText text={ev.observedResult} />
            </div>
            <div className="sm:col-span-2 border-t border-slate-800 pt-3">
              <h3 className="font-semibold text-slate-200 mb-1">Reproduction Guidance</h3>
              <SafeText text={ev.reproductionGuidance} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
