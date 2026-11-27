import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2 } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable } from '@/src/components/data-display/DataDisplay';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SafeText, SemanticBadge } from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { AssessmentReport, ReportFormat } from '@/src/types/domain';

export function ReportsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [reportToDelete, setReportToDelete] = useState<AssessmentReport | null>(null);
  const reportsQ = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiClient.getReports(),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r) => r.state === 'queued' || r.state === 'generating') ? 600 : false,
  });
  const runsQ = useQuery({ queryKey: ['runs'], queryFn: () => apiClient.getRuns() });

  const [selectedRunId, setSelectedRunId] = useState('');
  const [format, setFormat] = useState<ReportFormat>('html');
  const effectiveRunId =
    (runsQ.data ?? []).some((r) => r.id === selectedRunId) ? selectedRunId : (runsQ.data?.[0]?.id ?? '');

  const exportMut = useMutation({
    mutationFn: () => apiClient.generateReport(effectiveRunId, format),
    onSuccess: (rep) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate(`/app/reports/${rep.id}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (reportId: string) => apiClient.deleteReport(reportId),
    onSuccess: () => {
      setReportToDelete(null);
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const columns = [
    {
      key: 'id',
      header: 'Report ID',
      render: (r: AssessmentReport) => (
        <Link to={`/app/reports/${r.id}`} className="font-mono text-xs font-semibold text-teal-400 hover:underline">
          {r.id}
        </Link>
      ),
    },
    { key: 'target', header: 'Project / Target', render: (r: AssessmentReport) => <span className="text-xs text-slate-200">{r.projectName} · {r.targetName}</span> },
    {
      key: 'run',
      header: 'Run / Scope',
      render: (r: AssessmentReport) => (
        <div className="flex items-center gap-2 font-mono text-xs">
          <span>{r.runId} ({r.scopeVersionLabel})</span>
          {r.isPartialRun && <SemanticBadge label="Partial Run" tone="warning" />}
        </div>
      ),
    },
    { key: 'fmt', header: 'Format', render: (r: AssessmentReport) => <span className="font-mono text-xs uppercase text-slate-200">{r.format}</span> },
    {
      key: 'state',
      header: 'Export Lifecycle',
      render: (r: AssessmentReport) => (
        <SemanticBadge
          label={r.state}
          tone={r.state === 'ready' ? 'success' : r.state === 'failed' ? 'error' : 'info'}
        />
      ),
    },
    { key: 'date', header: 'Generated', render: (r: AssessmentReport) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(r.generatedAt)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (r: AssessmentReport) => (
        <div className="flex justify-end">
          <DeleteIconButton
            label={`Delete report ${r.id}`}
            title={roleCapabilities.canDeleteRecords ? `Delete report ${r.id}` : 'Read-only roles cannot delete reports'}
            disabled={!roleCapabilities.canDeleteRecords}
            onClick={() => {
              deleteMut.reset();
              setReportToDelete(r);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Results (Sem 8)' }, { label: 'Reports' }]}
        title="Assessment Reports & Export"
        description="Generate redacted HTML and JSON assessment reports with explicit scope snapshots, tool versions, and partial-run warnings."
      />

      <Panel className="p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor="rep-run" className="block text-xs font-medium text-slate-300">Assessment Run</label>
          <select
            id="rep-run"
            value={effectiveRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="h-9 rounded border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100"
          >
            {(runsQ.data ?? []).map((run) => (
              <option key={run.id} value={run.id}>
                {run.id} — {run.targetName} ({run.state})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="rep-fmt" className="block text-xs font-medium text-slate-300">Export Format</label>
          <select
            id="rep-fmt"
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            className="h-9 rounded border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100"
          >
            <option value="html">HTML Report</option>
            <option value="json">JSON Export</option>
          </select>
        </div>

        <Button variant="primary" disabled={!effectiveRunId || exportMut.isPending} onClick={() => exportMut.mutate()}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {exportMut.isPending ? 'Queuing Export...' : 'Queue Report Export'}
        </Button>
      </Panel>

      {reportsQ.error ? (
        <ErrorState message="Failed to load reports." />
      ) : reportsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <DataTable columns={columns} rows={reportsQ.data ?? []} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/app/reports/${r.id}`)} />
      )}

      <ConfirmDialog
        open={Boolean(reportToDelete)}
        title="Delete Report"
        description={
          reportToDelete
            ? `Delete exported report ${reportToDelete.id} (${reportToDelete.format.toUpperCase()}) for run ${reportToDelete.runId}?`
            : ''
        }
        confirmLabel="Delete Report"
        isPending={deleteMut.isPending}
        onConfirm={() => reportToDelete && deleteMut.mutate(reportToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setReportToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete report.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

export function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const repQ = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => apiClient.getReportById(reportId),
    enabled: Boolean(reportId),
    refetchInterval: (q) => (q.state.data && q.state.data.state !== 'ready' && q.state.data.state !== 'failed' ? 600 : false),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiClient.deleteReport(reportId),
    onSuccess: () => {
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate('/app/reports');
    },
  });

  if (repQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (repQ.error || !repQ.data) return <ErrorState message="Report not found." />;

  const rep = repQ.data;

  const handleSafeDownload = () => {
    const blob = new Blob([rep.redactedPreviewJson], {
      type: rep.format === 'json' ? 'application/json' : 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rep.id.toLowerCase()}-redacted.${rep.format === 'json' ? 'json' : 'html'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Reports', to: '/app/reports' }, { label: rep.id }]}
        title={`Report ${rep.id} (${rep.format.toUpperCase()})`}
        description={`${rep.projectName} · ${rep.targetName} · Run ${rep.runId} (Scope ${rep.scopeVersionLabel})`}
        actions={
          <>
            <Button variant="primary" disabled={rep.state !== 'ready'} onClick={handleSafeDownload}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {rep.state === 'ready' ? `Download ${rep.format.toUpperCase()}` : `Status: ${rep.state}`}
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
                Delete Report
              </Button>
            )}
          </>
        }
      />

      {rep.isPartialRun && (
        <div role="status" className="rounded-md border border-amber-700/50 bg-amber-950/30 p-3.5 text-xs text-amber-200">
          PARTIAL RUN REPORT: The underlying assessment run did not finish its full authorized budget. Limitations are documented below.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Coverage & Tool Provenance</h2>
          <div>Export Lifecycle: <SemanticBadge label={rep.state} tone={rep.state === 'ready' ? 'success' : 'info'} /></div>
          <div>Modules Covered: <span className="font-mono text-slate-200">{rep.modulesCovered.join(', ')}</span></div>
          <div>
            Tool Versions:
            <ul className="mt-1 font-mono text-slate-300 space-y-0.5">
              {Object.entries(rep.toolVersions).map(([k, v]) => (
                <li key={k}>{k}: {v}</li>
              ))}
            </ul>
          </div>
          <div className="border-t border-slate-800 pt-3">
            <div className="font-semibold text-slate-200 mb-1">Scope & Assessment Limitations</div>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              {rep.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </Panel>

        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Redacted Export Preview (Zero Secrets)</h2>
          <div className="rounded border border-slate-800 bg-slate-950 p-3.5">
            <SafeText text={rep.redactedPreviewJson} mono />
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Report"
        description={`Delete exported report ${rep.id} (${rep.format.toUpperCase()}) for run ${rep.runId}?`}
        confirmLabel="Delete Report"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => {
          deleteMut.reset();
          setDeleteOpen(false);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete report.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}
