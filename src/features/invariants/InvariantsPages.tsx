import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Sparkles, Trash2 } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable } from '@/src/components/data-display/DataDisplay';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SemanticBadge } from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { BusinessInvariant, InvariantRunResult } from '@/src/types/domain';

function formatFamily(f: string): string {
  if (f === 'bola_ownership') return 'Object Ownership / BOLA';
  if (f === 'workflow_order') return 'Workflow-Order Testing';
  if (f === 'one_time_replay') return 'One-Time-Use & Replay';
  return f;
}

export function InvariantsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { capabilities, roleCapabilities } = useAppSession();
  const [invariantToDelete, setInvariantToDelete] = useState<BusinessInvariant | null>(null);
  const invQ = useQuery({ queryKey: ['invariants'], queryFn: () => apiClient.getInvariants() });
  const aiQ = useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: () => apiClient.getAiSuggestions(),
    enabled: capabilities.aiAdvisorEnabled,
  });

  const aiMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accepted_draft' | 'rejected' }) =>
      apiClient.reviewAiSuggestion(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (invariantId: string) => apiClient.deleteInvariant(invariantId),
    onSuccess: () => {
      setInvariantToDelete(null);
      qc.invalidateQueries({ queryKey: ['invariants'] });
      qc.invalidateQueries({ queryKey: ['invariant-runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const columns = [
    {
      key: 'name',
      header: 'Invariant Name',
      render: (inv: BusinessInvariant) => (
        <div>
          <Link to={`/app/invariants/${inv.id}`} className="font-medium text-slate-100 hover:text-teal-400">
            {inv.name}
          </Link>
          <div className="text-xs text-slate-400 line-clamp-1">{inv.description}</div>
        </div>
      ),
    },
    { key: 'family', header: 'SRS Family', render: (inv: BusinessInvariant) => <span className="text-xs text-slate-300">{formatFamily(inv.family)}</span> },
    { key: 'target', header: 'Target', render: (inv: BusinessInvariant) => <span className="text-xs text-slate-300">{inv.targetName}</span> },
    {
      key: 'approval',
      header: 'State-Change Approval',
      render: (inv: BusinessInvariant) => (
        <SemanticBadge
          label={inv.stateChangingApprovalState.replace(/_/g, ' ')}
          tone={inv.stateChangingApprovalState === 'approved' ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'ownerReview',
      header: 'Owner Review',
      render: (inv: BusinessInvariant) => (
        <SemanticBadge
          label={`v${inv.version} · ${inv.ownerReviewState}`}
          tone={inv.ownerReviewState === 'approved' ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (inv: BusinessInvariant) => (
        <div className="flex justify-end">
          <DeleteIconButton
            label={`Delete invariant ${inv.name}`}
            title={roleCapabilities.canDeleteRecords ? `Delete invariant ${inv.name}` : 'Read-only roles cannot delete invariants'}
            disabled={!roleCapabilities.canDeleteRecords}
            onClick={() => {
              deleteMut.reset();
              setInvariantToDelete(inv);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Business Logic (Sem 8)' }, { label: 'Invariants' }]}
        title="Business Invariants Library"
        description="Deterministic business-logic rules across BOLA ownership, workflow order, and one-time replay families."
        actions={
          <Button variant="primary" onClick={() => navigate('/app/invariants/new')}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New Invariant
          </Button>
        }
      />

      {invQ.error ? (
        <ErrorState message="Failed to load business invariants." onRetry={() => invQ.refetch()} />
      ) : invQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <DataTable columns={columns} rows={invQ.data ?? []} rowKey={(i) => i.id} onRowClick={(i) => navigate(`/app/invariants/${i.id}`)} />
      )}

      {/* Optional P3 AI Advisor Stretch Panel */}
      {capabilities.aiAdvisorEnabled && (aiQ.data?.length ?? 0) > 0 && (
        <Panel className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <span>Optional AI Invariant Advisor (Non-Authoritative Suggestions)</span>
            </div>
            <SemanticBadge label="Human Review Required" tone="info" />
          </div>
          <p className="text-xs text-slate-400">
            AI suggestions cannot launch tests, alter scope, access credentials, or override deterministic finding verdicts.
          </p>
          <div className="space-y-3">
            {(aiQ.data ?? []).map((sug) => (
              <div key={sug.id} className="rounded border border-slate-800 bg-slate-950/60 p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{sug.candidateName}</span>
                  <SemanticBadge label={`Suggestion: ${sug.reviewState.replace(/_/g, ' ')}`} tone="info" />
                </div>
                <div className="text-slate-300">
                  Actor: <span className="font-mono">{sug.actor}</span> · Sequence: <span className="font-mono">{sug.actionSequence.join(' -> ')}</span>
                </div>
                <div className="text-slate-400">Expected Oracle: {sug.expectedOracle}</div>
                <div className="text-slate-400">Rationale: {sug.rationale} ({sug.modelVersion})</div>
                {sug.reviewState === 'pending_review' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => aiMut.mutate({ id: sug.id, decision: 'accepted_draft' })}>
                      Accept as Draft
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => aiMut.mutate({ id: sug.id, decision: 'rejected' })}>
                      Reject Suggestion
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <ConfirmDialog
        open={Boolean(invariantToDelete)}
        title="Delete Business Invariant"
        description={
          invariantToDelete
            ? `Delete business invariant "${invariantToDelete.name}" and its execution history?`
            : ''
        }
        confirmLabel="Delete Invariant"
        isPending={deleteMut.isPending}
        onConfirm={() => invariantToDelete && deleteMut.mutate(invariantToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setInvariantToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete invariant.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

export function CreateInvariantPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const targetsQ = useQuery({ queryKey: ['targets'], queryFn: () => apiClient.getTargets() });

  const [targetId, setTargetId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [family, setFamily] = useState<'bola_ownership' | 'workflow_order' | 'one_time_replay'>('bola_ownership');
  const [actorsText, setActorsText] = useState('Alice (Customer Fixture A), Bob (Customer Fixture B)');
  const [preconditions, setPreconditions] = useState('');
  const [sequenceText, setSequenceText] = useState('GET /api/orders/{orderId} (Bob)');
  const [expectedOracle, setExpectedOracle] = useState('');
  const [maxExecutionBudget, setMaxExecutionBudget] = useState(5);
  const [resetProcedure, setResetProcedure] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const effectiveTargetId =
    (targetsQ.data ?? []).some((t) => t.id === targetId) ? targetId : (targetsQ.data?.[0]?.id ?? '');

  const mut = useMutation({
    mutationFn: apiClient.createInvariant,
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ['invariants'] });
      navigate(`/app/invariants/${inv.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTargetId) {
      setErr('Register a target before defining a business invariant.');
      return;
    }
    if (!name.trim() || !expectedOracle.trim() || !resetProcedure.trim()) {
      setErr('Name, expected business oracle, and disposable fixture reset procedure are required.');
      return;
    }
    setErr(null);
    mut.mutate({
      targetId: effectiveTargetId,
      name,
      description,
      family,
      actorIdentityLabels: actorsText.split(',').map((s) => s.trim()).filter(Boolean),
      preconditions,
      operationSequence: sequenceText.split('\n').map((s) => s.trim()).filter(Boolean),
      expectedOracle,
      maxExecutionBudget,
      resetProcedure,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Invariants', to: '/app/invariants' }, { label: 'New Invariant' }]}
        title="Define Business Invariant"
        description="Specify actor identities, operation sequence, deterministic oracle, and resettable fixture procedure."
      />

      <Panel className="max-w-3xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {err && <ErrorState message={err} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="inv-target" label="Target">
              <select id="inv-target" value={effectiveTargetId} onChange={(e) => setTargetId(e.target.value)} className={inputClassName}>
                {(targetsQ.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.displayName}</option>
                ))}
              </select>
            </FormField>
            <FormField id="inv-family" label="Invariant Family">
              <select
                id="inv-family"
                value={family}
                onChange={(e) => setFamily(e.target.value as typeof family)}
                className={inputClassName}
              >
                <option value="bola_ownership">1. Object Ownership / BOLA</option>
                <option value="workflow_order">2. Workflow-Order Testing</option>
                <option value="one_time_replay">3. One-Time-Use & Replay</option>
              </select>
            </FormField>
          </div>
          <FormField id="inv-name" label="Invariant Name" required>
            <input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField id="inv-desc" label="Description">
            <textarea id="inv-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField id="inv-actors" label="Actor / Test Identity Labels (comma-separated)">
            <input id="inv-actors" value={actorsText} onChange={(e) => setActorsText(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField id="inv-pre" label="Preconditions / Initial State">
            <input id="inv-pre" value={preconditions} onChange={(e) => setPreconditions(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField id="inv-seq" label="Authorized Operation Sequence (one step per line)">
            <textarea id="inv-seq" rows={3} value={sequenceText} onChange={(e) => setSequenceText(e.target.value)} className={`${inputClassName} font-mono`} />
          </FormField>
          <FormField id="inv-oracle" label="Expected Business Rule / Oracle" required>
            <input id="inv-oracle" value={expectedOracle} onChange={(e) => setExpectedOracle(e.target.value)} className={inputClassName} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="inv-budget" label="Max Execution Budget">
              <input
                id="inv-budget"
                type="number"
                value={maxExecutionBudget}
                onChange={(e) => setMaxExecutionBudget(Number(e.target.value))}
                className={`${inputClassName} font-mono`}
              />
            </FormField>
            <FormField id="inv-reset" label="Disposable Fixture / Reset Procedure" required>
              <input id="inv-reset" value={resetProcedure} onChange={(e) => setResetProcedure(e.target.value)} className={inputClassName} />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/app/invariants')}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={mut.isPending}>Save Invariant Draft</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export function InvariantDetailPage() {
  const { invariantId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailQ = useQuery({
    queryKey: ['invariant', invariantId],
    queryFn: () => apiClient.getInvariantById(invariantId),
    enabled: Boolean(invariantId),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiClient.deleteInvariant(invariantId),
    onSuccess: () => {
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ['invariants'] });
      qc.invalidateQueries({ queryKey: ['invariant-runs'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate('/app/invariants');
    },
  });

  if (detailQ.isLoading) return <LoadingSkeleton rows={4} />;
  if (detailQ.error || !detailQ.data) return <ErrorState message="Business invariant not found." />;

  const { invariant, runs } = detailQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Invariants', to: '/app/invariants' }, { label: invariant.name }]}
        title={invariant.name}
        description={invariant.description}
        actions={
          roleCapabilities.canDeleteRecords && (
            <Button
              variant="danger"
              onClick={() => {
                deleteMut.reset();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete Invariant
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Specification & Safety Safeguards</h2>
          <div>Family: <span className="text-slate-200">{formatFamily(invariant.family)}</span></div>
          <div>Actors: <span className="font-mono text-slate-200">{invariant.actorIdentityLabels.join(', ')}</span></div>
          <div>Preconditions: <span className="text-slate-300">{invariant.preconditions}</span></div>
          <div>
            Operation Sequence:
            <ol className="mt-1 list-decimal list-inside font-mono text-slate-200 space-y-1">
              {invariant.operationSequence.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
          <div>Expected Oracle: <span className="text-teal-300">{invariant.expectedOracle}</span></div>
          <div>Reset Procedure: <span className="font-mono text-slate-300">{invariant.resetProcedure}</span></div>
        </Panel>

        <Panel className="p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Execution History ({runs.length})</h2>
          {runs.length === 0 ? (
            <p className="text-slate-400">No executions recorded for this invariant yet.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {runs.map((r) => (
                <div key={r.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <SemanticBadge
                      label={r.outcome.replace(/_/g, ' ')}
                      tone={r.outcome === 'passed' ? 'success' : r.outcome === 'violated' ? 'error' : 'warning'}
                    />
                    <span className="font-mono text-slate-400 tabular-nums">{formatTimestamp(r.executedAt)}</span>
                  </div>
                  <p className="text-slate-300">{r.summary}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Business Invariant"
        description={`Delete business invariant "${invariant.name}" and its ${runs.length} recorded run(s)?`}
        confirmLabel="Delete Invariant"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => {
          deleteMut.reset();
          setDeleteOpen(false);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete invariant.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

export function InvariantRunsPage() {
  const runsQ = useQuery({ queryKey: ['invariant-runs'], queryFn: () => apiClient.getInvariantRuns() });

  const columns = [
    {
      key: 'inv',
      header: 'Invariant',
      render: (r: InvariantRunResult) => (
        <Link to={`/app/invariants/${r.invariantId}`} className="font-medium text-slate-100 hover:text-teal-400">
          {r.invariantName}
        </Link>
      ),
    },
    { key: 'family', header: 'Family', render: (r: InvariantRunResult) => <span className="text-xs text-slate-300">{formatFamily(r.family)}</span> },
    {
      key: 'outcome',
      header: 'Verdict',
      render: (r: InvariantRunResult) => (
        <SemanticBadge
          label={r.outcome.replace(/_/g, ' ')}
          tone={r.outcome === 'passed' ? 'success' : r.outcome === 'violated' ? 'error' : 'warning'}
        />
      ),
    },
    {
      key: 'reset',
      header: 'Fixture Reset Status',
      render: (r: InvariantRunResult) => (
        <SemanticBadge
          label={r.resetStatus.replace(/_/g, ' ')}
          tone={r.resetStatus === 'reset_failed' ? 'error' : 'success'}
        />
      ),
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: (r: InvariantRunResult) =>
        r.evidenceId ? (
          <Link to={`/app/evidence/${r.evidenceId}`} className="font-mono text-xs text-teal-400 hover:underline">
            {r.evidenceId}
          </Link>
        ) : (
          <span className="text-xs text-slate-500">None</span>
        ),
    },
    { key: 'summary', header: 'Summary', render: (r: InvariantRunResult) => <span className="text-xs text-slate-300">{r.summary}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Business Logic (Sem 8)' }, { label: 'Invariant Runs' }]}
        title="Business Invariant Run Results"
        description="Outcomes of deterministic invariant sequences. Failed resets or missing oracles are never reported as passed."
      />

      {runsQ.error ? (
        <ErrorState message="Failed to load invariant run results." />
      ) : runsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <DataTable columns={columns} rows={runsQ.data ?? []} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
