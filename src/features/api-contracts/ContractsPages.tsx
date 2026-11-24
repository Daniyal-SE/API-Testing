import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileUp, PlusCircle, Trash2 } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { DataTable } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SafeText, SemanticBadge } from '@/src/components/security/StatusBadges';
import { Button, ConfirmDialog, DeleteIconButton, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatBytes, formatTimestamp } from '@/src/lib/formatters';
import { validateOpenApiFileCandidate } from '@/src/lib/validators';
import type { OpenApiContract } from '@/src/types/domain';

export function ContractsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [contractToDelete, setContractToDelete] = useState<OpenApiContract | null>(null);
  const contractsQ = useQuery({ queryKey: ['contracts'], queryFn: () => apiClient.getContracts() });

  const deleteMut = useMutation({
    mutationFn: (contractId: string) => apiClient.deleteContract(contractId),
    onSuccess: () => {
      setContractToDelete(null);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const columns = [
    {
      key: 'name',
      header: 'Contract Name',
      render: (c: OpenApiContract) => (
        <div>
          <Link to={`/app/contracts/${c.id}`} className="font-medium text-slate-100 hover:text-teal-400">
            {c.name}
          </Link>
          <div className="font-mono text-xs text-slate-400">{c.sourceFilename}</div>
        </div>
      ),
    },
    { key: 'target', header: 'Target', render: (c: OpenApiContract) => <span className="text-xs text-slate-300">{c.targetName}</span> },
    {
      key: 'ver',
      header: 'OpenAPI',
      render: (c: OpenApiContract) => <span className="font-mono text-xs text-slate-200">{c.openApiVersion}</span>,
    },
    {
      key: 'ops',
      header: 'Operations',
      align: 'right' as const,
      render: (c: OpenApiContract) => <span className="font-mono text-xs tabular-nums">{c.operationCount}</span>,
    },
    {
      key: 'status',
      header: 'Import Status',
      render: (c: OpenApiContract) => (
        <SemanticBadge
          label={c.status.replace(/_/g, ' ')}
          tone={c.status === 'parsed' ? 'success' : c.status === 'partial_warnings' ? 'warning' : 'error'}
        />
      ),
    },
    {
      key: 'warnings',
      header: 'Warnings',
      align: 'right' as const,
      render: (c: OpenApiContract) => <span className="font-mono text-xs tabular-nums">{c.warnings.length}</span>,
    },
    {
      key: 'date',
      header: 'Imported',
      render: (c: OpenApiContract) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(c.importedAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (c: OpenApiContract) => (
        <div className="flex justify-end">
          <DeleteIconButton
            label={`Delete contract ${c.name}`}
            title={roleCapabilities.canDeleteRecords ? `Delete contract ${c.name}` : 'Read-only roles cannot delete contracts'}
            disabled={!roleCapabilities.canDeleteRecords}
            onClick={() => {
              deleteMut.reset();
              setContractToDelete(c);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'API (Sem 8)' }, { label: 'OpenAPI Contracts' }]}
        title="OpenAPI Contracts"
        description="Imported JSON/YAML API specifications, detected OpenAPI versions, and parser warning summaries."
        actions={
          <Button variant="primary" onClick={() => navigate('/app/contracts/import')}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Import Contract
          </Button>
        }
      />

      {contractsQ.error ? (
        <ErrorState message="Failed to load OpenAPI contracts." onRetry={() => contractsQ.refetch()} />
      ) : contractsQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (contractsQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No OpenAPI specifications imported"
          description="Upload a JSON or YAML OpenAPI 3.x specification to populate API operations."
          action={
            <Button variant="primary" onClick={() => navigate('/app/contracts/import')}>
              Import Contract
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} rows={contractsQ.data ?? []} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/app/contracts/${c.id}`)} />
      )}

      <ConfirmDialog
        open={Boolean(contractToDelete)}
        title="Delete OpenAPI Contract"
        description={
          contractToDelete
            ? `Delete contract "${contractToDelete.name}" (${contractToDelete.sourceFilename}) and remove its ${contractToDelete.operationCount} normalized operation record(s)?`
            : ''
        }
        confirmLabel="Delete Contract"
        isPending={deleteMut.isPending}
        onConfirm={() => contractToDelete && deleteMut.mutate(contractToDelete.id)}
        onClose={() => {
          deleteMut.reset();
          setContractToDelete(null);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete contract.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}

const SAMPLE_YAML = `openapi: 3.0.3
info:
  title: Lab Checkout Sample API
  version: 1.0.0
paths:
  /api/orders:
    get:
      summary: List orders
  /api/orders/{id}:
    get:
      summary: Get single order
`;

export function ImportContractPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const targetsQ = useQuery({ queryKey: ['targets'], queryFn: () => apiClient.getTargets() });

  const [targetId, setTargetId] = useState('');
  const [filename, setFilename] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [sizeBytes, setSizeBytes] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [importedContract, setImportedContract] = useState<OpenApiContract | null>(null);

  const effectiveTargetId =
    (targetsQ.data ?? []).some((t) => t.id === targetId) ? targetId : (targetsQ.data?.[0]?.id ?? '');

  const importMut = useMutation({
    mutationFn: async () => {
      setUploadProgress(45);
      const res = await apiClient.importOpenApiContract({ targetId: effectiveTargetId, filename, rawContent, sizeBytes });
      setUploadProgress(100);
      return res;
    },
    onSuccess: (contract) => {
      setImportedContract(contract);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const handleFileChange = (file?: File | null) => {
    if (!file) return;
    const err = validateOpenApiFileCandidate({ name: file.name, size: file.size });
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    setFilename(file.name);
    setSizeBytes(file.size);
    const reader = new FileReader();
    reader.onload = () => {
      setRawContent(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  };

  const loadSampleSpec = () => {
    setFileError(null);
    setFilename('lab-checkout-sample.yaml');
    setRawContent(SAMPLE_YAML);
    setSizeBytes(new Blob([SAMPLE_YAML]).size);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'OpenAPI Contracts', to: '/app/contracts' }, { label: 'Import Contract' }]}
        title="Import OpenAPI Specification"
        description="Upload an OpenAPI JSON or YAML document (max 5.0 MB). Remote $ref fetching is disabled by safe import policy."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-6 space-y-4">
          <FormField id="cnt-target" label="Target Association" required>
            <select id="cnt-target" value={effectiveTargetId} onChange={(e) => setTargetId(e.target.value)} className={inputClassName}>
              {(targetsQ.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName} ({t.normalizedBaseUrl})
                </option>
              ))}
            </select>
          </FormField>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-200">Specification File (.json, .yaml, .yml)</div>
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center space-y-3">
              <FileUp className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <div className="text-xs text-slate-300">
                Select a local OpenAPI JSON/YAML file (provisional size cap: 5.0 MB)
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  className="sr-only"
                  aria-label="Choose OpenAPI specification file"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />
                <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Choose File
                </Button>
                <Button size="sm" variant="ghost" onClick={loadSampleSpec}>
                  Load Sample YAML Fixture
                </Button>
              </div>
              {filename && (
                <div className="font-mono text-xs text-teal-400">
                  Selected: {filename} ({formatBytes(sizeBytes)})
                </div>
              )}
            </div>
            {fileError && (
              <p role="alert" className="text-xs font-medium text-red-400">
                {fileError}
              </p>
            )}
          </div>

          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Parser Upload Progress</span>
                <span className="font-mono tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
                <div className="h-full bg-teal-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/app/contracts')}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!filename || !rawContent || Boolean(fileError) || importMut.isPending}
              onClick={() => importMut.mutate()}
            >
              {importMut.isPending ? 'Parsing...' : 'Upload & Parse Contract'}
            </Button>
          </div>
        </Panel>

        <Panel className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">Parser Summary & Warnings</h2>
          {!importedContract ? (
            <p className="text-xs text-slate-400">
              Upload a JSON or YAML specification to inspect detected OpenAPI version, operation count, parser errors, and partial-import warnings.
            </p>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">{importedContract.name}</span>
                <SemanticBadge
                  label={importedContract.status.replace(/_/g, ' ')}
                  tone={importedContract.status === 'parsed' ? 'success' : importedContract.status === 'partial_warnings' ? 'warning' : 'error'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-slate-300">
                <div>Version: {importedContract.openApiVersion}</div>
                <div>Operations: {importedContract.operationCount}</div>
              </div>
              {importedContract.parserErrors.length > 0 && (
                <div role="alert" className="rounded border border-red-800/60 bg-red-950/40 p-3 text-red-200 space-y-1">
                  <div className="font-semibold">Parser Errors</div>
                  {importedContract.parserErrors.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              )}
              {importedContract.warnings.length > 0 && (
                <div className="rounded border border-amber-700/50 bg-amber-950/30 p-3 text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Partial Import Warnings</span>
                  </div>
                  {importedContract.warnings.map((w, i) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}
              <Link to={`/app/contracts/${importedContract.id}`} className="inline-block font-medium text-teal-400 hover:underline">
                View Contract Detail &rarr;
              </Link>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailQ = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => apiClient.getContractById(contractId),
    enabled: Boolean(contractId),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiClient.deleteContract(contractId),
    onSuccess: () => {
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      navigate('/app/contracts');
    },
  });

  if (detailQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (detailQ.error || !detailQ.data) return <ErrorState message="Contract not found." />;

  const { contract, operations } = detailQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'OpenAPI Contracts', to: '/app/contracts' }, { label: contract.name }]}
        title={contract.name}
        description={`${contract.sourceFilename} · OpenAPI ${contract.openApiVersion} · Target: ${contract.targetName}`}
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
              Delete Contract
            </Button>
          )
        }
      />

      {contract.warnings.length > 0 && (
        <Panel className="p-4 border-amber-700/50 bg-amber-950/20 space-y-1.5 text-xs text-amber-200">
          <div className="font-semibold">Parser & Import Warnings (Partial Import)</div>
          {contract.warnings.map((w, i) => (
            <div key={i}>• <SafeText text={w} /></div>
          ))}
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Security Schemes</h2>
          {contract.securitySchemes.length === 0 ? (
            <p className="text-xs text-slate-400">No securitySchemes defined.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {contract.securitySchemes.map((s) => (
                <li key={s.name} className="rounded border border-slate-800 bg-slate-950/60 p-2.5">
                  <div className="font-mono font-semibold text-teal-400">{s.name}</div>
                  <div className="text-slate-400">
                    type: {s.type} {s.scheme ? `· scheme: ${s.scheme}` : ''} {s.in ? `· in: ${s.in}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5 space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-100">Normalized Operations ({operations.length})</h2>
          {operations.length === 0 ? (
            <p className="text-xs text-slate-400">No operations extracted from this specification.</p>
          ) : (
            <ul className="divide-y divide-slate-800 text-xs">
              {operations.map((op) => (
                <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-teal-400 w-14">{op.method}</span>
                    <span className="font-mono text-slate-200">{op.path}</span>
                    <span className="text-slate-500">({op.operationId})</span>
                  </div>
                  <span className="font-mono text-slate-400">{op.authScheme}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete OpenAPI Contract"
        description={`Delete "${contract.name}" (${contract.sourceFilename}) and its ${operations.length} normalized operation record(s)?`}
        confirmLabel="Delete Contract"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => {
          deleteMut.reset();
          setDeleteOpen(false);
        }}
      >
        {deleteMut.error && (
          <ErrorState message={deleteMut.error instanceof Error ? deleteMut.error.message : 'Unable to delete contract.'} />
        )}
      </ConfirmDialog>
    </div>
  );
}
