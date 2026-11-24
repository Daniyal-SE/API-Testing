import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, KeyRound, PlusCircle } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable } from '@/src/components/data-display/DataDisplay';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SemanticBadge } from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { TestIdentity } from '@/src/types/domain';

export function TestIdentitiesPage() {
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [identityToDelete, setIdentityToDelete] = useState<TestIdentity | null>(null);
  const identitiesQ = useQuery({ queryKey: ['test-identities'], queryFn: () => apiClient.getTestIdentities() });
  const targetsQ = useQuery({ queryKey: ['targets'], queryFn: () => apiClient.getTargets() });

  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [label, setLabel] = useState('');
  const [roleProfile, setRoleProfile] = useState('customer_standard');
  const [secretRefId, setSecretRefId] = useState('vault://fyp-lab/');
  const [notes, setNotes] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const effectiveTargetId =
    (targetsQ.data ?? []).some((t) => t.id === targetId) ? targetId : (targetsQ.data?.[0]?.id ?? '');

  const createMut = useMutation({
    mutationFn: apiClient.createTestIdentity,
    onSuccess: () => {
      setShowForm(false);
      setLabel('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['test-identities'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (identityId: string) => apiClient.deleteTestIdentity(identityId),
    onSuccess: () => {
      setIdentityToDelete(null);
      qc.invalidateQueries({ queryKey: ['test-identities'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTargetId) {
      setFormErr('Register a target before adding a synthetic test identity.');
      return;
    }
    if (label.trim().length < 2 || !secretRefId.trim().startsWith('vault://')) {
      setFormErr('Provide an identity label and a secret-store reference (e.g., vault://fyp-lab/...), never a raw password or token.');
      return;
    }
    setFormErr(null);
    createMut.mutate({ targetId: effectiveTargetId, label, roleProfile, secretRefId, notes });
  };

  const columns = [
    {
      key: 'label',
      header: 'Identity Label',
      render: (id: TestIdentity) => (
        <div>
          <div className="font-medium text-slate-100">{id.label}</div>
          <div className="text-xs text-slate-400">{id.notes}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role Profile', render: (id: TestIdentity) => <span className="font-mono text-xs text-slate-300">{id.roleProfile}</span> },
    { key: 'target', header: 'Target', render: (id: TestIdentity) => <span className="text-xs text-slate-300">{id.targetName}</span> },
    {
      key: 'secret',
      header: 'Secret Reference (No Raw Credentials)',
      render: (id: TestIdentity) => (
        <div className="space-y-1">
          <div className="font-mono text-xs text-slate-300">{id.secretRefId}</div>
          <SemanticBadge label={id.secretRefStatus} tone={id.secretRefStatus === 'configured' ? 'success' : 'warning'} />
        </div>
      ),
    },
    {
      key: 'enabled',
      header: 'State',
      render: (id: TestIdentity) => <SemanticBadge label={id.enabled ? 'Enabled' : 'Disabled'} tone={id.enabled ? 'success' : 'neutral'} />,
    },
    { key: 'updated', header: 'Updated', render: (id: TestIdentity) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(id.updatedAt)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (id: TestIdentity) => (
        <div className="flex justify-end">
          <DeleteIconButton
            label={`Delete identity ${id.label}`}
            title={roleCapabilities.canDeleteRecords ? `Delete identity ${id.label}` : 'Read-only roles cannot delete test identities'}
            disabled={!roleCapabilities.canDeleteRecords}
            onClick={() => {
              deleteMut.reset();
              setIdentityToDelete(id);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Business Logic (Sem 8)' }, { label: 'Test Identities' }]}
        title="Synthetic Test Identities"
        description="Configure non-production synthetic identity references for multi-actor BOLA and authorization invariant verification."
        actions={
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add Synthetic Identity
          </Button>
        }
      />

      <div className="rounded-md border border-amber-700/50 bg-amber-950/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
        <span>
          Never enter real customer credentials, API keys, session cookies, or raw passwords into UI notes or secret reference fields. Only store opaque server-side secret identifiers.
        </span>
      </div>

      {showForm && (
        <Panel className="p-5 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <KeyRound className="h-4 w-4 text-teal-400" aria-hidden="true" />
              <span>Register Synthetic Identity Reference</span>
            </div>
            {formErr && <p role="alert" className="text-xs text-red-400">{formErr}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="ti-target" label="Target">
                <select id="ti-target" value={effectiveTargetId} onChange={(e) => setTargetId(e.target.value)} className={inputClassName}>
                  {(targetsQ.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </FormField>
              <FormField id="ti-role" label="Role Profile">
                <input id="ti-role" value={roleProfile} onChange={(e) => setRoleProfile(e.target.value)} className={`${inputClassName} font-mono`} />
              </FormField>
              <FormField id="ti-label" label="Identity Label" required>
                <input id="ti-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Charlie (Fixture)" className={inputClassName} />
              </FormField>
              <FormField id="ti-ref" label="Secret Reference URI" required>
                <input id="ti-ref" value={secretRefId} onChange={(e) => setSecretRefId(e.target.value)} className={`${inputClassName} font-mono`} />
              </FormField>
            </div>
            <FormField id="ti-notes" label="Non-sensitive Notes">
              <input id="ti-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Synthetic test fixture notes..." className={inputClassName} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={createMut.isPending}>Save Identity Reference</Button>
            </div>
          </form>
        </Panel>
      )}

      {identitiesQ.error ? (
        <ErrorState message="Failed to load test identities." onRetry={() => identitiesQ.refetch()} />
      ) : identitiesQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <DataTable columns={columns} rows={identitiesQ.data ?? []} rowKey={(i) => i.id} />
      )}

      <ConfirmDialog
        open={Boolean(identityToDelete)}
        title="Delete Synthetic Identity"
        description={
          identityToDelete
            ? `Delete synthetic test identity reference "${identityToDelete.label}" (${identityToDelete.secretRefId})?`
            : ''
        }
        confirmLabel="Delete Identity"
        isPending={deleteMut.isPending}
        onConfirm={() => identityToDelete && deleteMut.mutate(identityToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setIdentityToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete test identity.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}
