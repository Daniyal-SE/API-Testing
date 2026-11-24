import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck } from 'lucide-react';
import { useAppSession } from '@/src/app/providers';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { ScopeApprovalBadge } from '@/src/components/security/StatusBadges';
import { Button, FormField, Panel, inputClassName } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import { buildNormalizedScopePreview, validateScopeBudgets } from '@/src/lib/validators';
import type { HttpMethodOption, ScopeBudgets } from '@/src/types/domain';

const ALL_METHODS: HttpMethodOption[] = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function ScopeConfigPage() {
  const { targetId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roleCapabilities } = useAppSession();

  const targetQ = useQuery({
    queryKey: ['target', targetId],
    queryFn: () => apiClient.getTargetById(targetId),
    enabled: Boolean(targetId),
  });

  const latest = targetQ.data?.scopeVersions[0];

  const [hostsText, setHostsText] = useState<string | null>(null);
  const [portsText, setPortsText] = useState<string | null>(null);
  const [prefixesText, setPrefixesText] = useState<string | null>(null);
  const [exclusionsText, setExclusionsText] = useState<string | null>(null);
  const [followRedirectsInScopeOnly, setFollowRedirectsInScopeOnly] = useState<boolean | null>(null);
  const [allowedMethods, setAllowedMethods] = useState<HttpMethodOption[] | null>(null);
  const [blockPrivate, setBlockPrivate] = useState<boolean | null>(null);
  const [localLabException, setLocalLabException] = useState<boolean | null>(null);
  const [budgets, setBudgets] = useState<ScopeBudgets | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const effectiveHosts = (hostsText ?? (latest?.allowedHosts.join(', ') || 'localhost'))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const effectivePorts = (portsText ?? (latest?.allowedPorts.join(', ') || '8080'))
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const effectivePrefixes = (prefixesText ?? (latest?.allowedPathPrefixes.join(', ') || '/api'))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const effectiveExclusions = (exclusionsText ?? (latest?.excludedPaths.join(', ') || ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const effectiveMethods = allowedMethods ?? latest?.allowedMethods ?? ['GET', 'HEAD', 'OPTIONS'];
  const effectiveBlockPrivate = blockPrivate ?? latest?.blockPrivateAndLinkLocal ?? true;
  const effectiveLocalLab =
    localLabException ?? latest?.localLabExceptionActive ?? targetQ.data?.target.environment === 'local_lab';
  const effectiveRedirects = followRedirectsInScopeOnly ?? latest?.followRedirectsInScopeOnly ?? true;
  const effectiveBudgets: ScopeBudgets = budgets ??
    latest?.budgets ?? {
      maxCrawlDepth: 3,
      maxRequests: 400,
      perHostRateRps: 2,
      concurrency: 2,
      maxWallClockSeconds: 240,
    };

  const normalizedPreview = useMemo(
    () =>
      buildNormalizedScopePreview({
        allowedHosts: effectiveHosts,
        allowedPorts: effectivePorts,
        allowedPathPrefixes: effectivePrefixes,
        excludedPaths: effectiveExclusions,
        allowedMethods: effectiveMethods,
        blockPrivateAndLinkLocal: effectiveBlockPrivate,
        localLabExceptionActive: effectiveLocalLab,
        budgets: effectiveBudgets,
      }),
    [
      effectiveHosts,
      effectivePorts,
      effectivePrefixes,
      effectiveExclusions,
      effectiveMethods,
      effectiveBlockPrivate,
      effectiveLocalLab,
      effectiveBudgets,
    ],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      apiClient.saveScopeVersion(targetId, {
        allowedHosts: effectiveHosts,
        allowedPorts: effectivePorts,
        allowedPathPrefixes: effectivePrefixes,
        excludedPaths: effectiveExclusions,
        followRedirectsInScopeOnly: effectiveRedirects,
        allowedMethods: effectiveMethods,
        stateChangingMethodsEnabled: effectiveMethods.some((m) => !['GET', 'HEAD', 'OPTIONS'].includes(m)),
        blockPrivateAndLinkLocal: effectiveBlockPrivate,
        localLabExceptionActive: effectiveLocalLab,
        budgets: effectiveBudgets,
        changeSummary: changeSummary.trim() || 'Updated target scope boundaries and budgets.',
      }),
    onSuccess: () => {
      setChangeSummary('');
      qc.invalidateQueries({ queryKey: ['target', targetId] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const approveMut = useMutation({
    mutationFn: ({ scopeId, decision }: { scopeId: string; decision: 'approved' | 'rejected' }) =>
      apiClient.approveScopeVersion(scopeId, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target', targetId] });
      qc.invalidateQueries({ queryKey: ['targets'] });
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  if (targetQ.isLoading) return <LoadingSkeleton rows={6} />;
  if (targetQ.error || !targetQ.data) {
    return <ErrorState message="Could not load target scope configuration." onRetry={() => targetQ.refetch()} />;
  }

  const { target } = targetQ.data;

  const toggleMethod = (method: HttpMethodOption) => {
    const next = effectiveMethods.includes(method)
      ? effectiveMethods.filter((m) => m !== method)
      : [...effectiveMethods, method];
    if (next.length > 0) setAllowedMethods(next);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (effectiveHosts.length === 0) errs.push('Specify at least one allowed host.');
    errs.push(...validateScopeBudgets(effectiveBudgets));
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    saveMut.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Targets', to: '/app/targets' },
          { label: target.displayName, to: `/app/targets/${target.id}` },
          { label: 'Scope Configuration' },
        ]}
        title={`Scope Configuration: ${target.displayName}`}
        description="Define target host boundaries, exclusions, read-only method defaults, network policy, and provisional execution budgets."
        actions={
          <Button variant="secondary" onClick={() => navigate(`/app/targets/${target.id}/scope/versions`)}>
            Version History ({targetQ.data.scopeVersions.length})
          </Button>
        }
      />

      {latest && (
        <Panel className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-semibold text-slate-100">Latest Version: {latest.versionLabel}</span>
              <ScopeApprovalBadge state={latest.approvalState} />
            </div>
            <p className="text-xs text-slate-400">
              {latest.changeSummary} · Created by {latest.createdBy} on {formatTimestamp(latest.createdAt)}
            </p>
          </div>
          {roleCapabilities.canApproveScope && latest.approvalState === 'pending_approval' && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={approveMut.isPending}
                onClick={() => approveMut.mutate({ scopeId: latest.id, decision: 'approved' })}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Approve {latest.versionLabel}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={approveMut.isPending}
                onClick={() => approveMut.mutate({ scopeId: latest.id, decision: 'rejected' })}
              >
                Reject
              </Button>
            </div>
          )}
        </Panel>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {validationErrors.length > 0 && (
            <div role="alert" className="rounded-md border border-red-800/60 bg-red-950/40 p-3.5 text-xs text-red-200 space-y-1">
              {validationErrors.map((err) => (
                <div key={err}>• {err}</div>
              ))}
            </div>
          )}

          {/* 1. Target Boundary */}
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">1. Target Boundary</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="scope-hosts" label="Allowed Hosts (comma-separated)" required>
                <input
                  id="scope-hosts"
                  value={hostsText ?? (latest?.allowedHosts.join(', ') || 'localhost')}
                  onChange={(e) => setHostsText(e.target.value)}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
              <FormField id="scope-ports" label="Allowed Ports">
                <input
                  id="scope-ports"
                  value={portsText ?? (latest?.allowedPorts.join(', ') || '8080')}
                  onChange={(e) => setPortsText(e.target.value)}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
              <FormField id="scope-prefixes" label="Allowed Path Prefixes" className="sm:col-span-2" hint="Paths outside these prefixes are never crawled.">
                <input
                  id="scope-prefixes"
                  value={prefixesText ?? (latest?.allowedPathPrefixes.join(', ') || '/api')}
                  onChange={(e) => setPrefixesText(e.target.value)}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
            </div>
          </Panel>

          {/* 2. Exclusions & Redirects */}
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">2. Exclusions & Redirect Policy</h2>
            <FormField id="scope-excl" label="Excluded Paths / Patterns" hint="Administrative, destructive, or logout endpoints.">
              <input
                id="scope-excl"
                value={exclusionsText ?? (latest?.excludedPaths.join(', ') || '')}
                onChange={(e) => setExclusionsText(e.target.value)}
                disabled={!roleCapabilities.canEditScope}
                className={`${inputClassName} font-mono`}
              />
            </FormField>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={effectiveRedirects}
                onChange={(e) => setFollowRedirectsInScopeOnly(e.target.checked)}
                disabled={!roleCapabilities.canEditScope}
              />
              Follow HTTP redirects only when destination host remains within approved scope boundary
            </label>
          </Panel>

          {/* 3. HTTP Methods & Network Policy */}
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">3. HTTP Methods & Network Policy</h2>
            <p className="text-xs text-slate-400">
              Safe read-only methods (GET, HEAD, OPTIONS) are enabled by default. State-changing methods require explicit policy review.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_METHODS.map((method) => {
                const active = effectiveMethods.includes(method);
                const stateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={!roleCapabilities.canEditScope}
                    onClick={() => toggleMethod(method)}
                    className={`rounded border px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                      active
                        ? stateChanging
                          ? 'border-amber-600/60 bg-amber-950/60 text-amber-300'
                          : 'border-teal-600/60 bg-teal-950/60 text-teal-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={effectiveBlockPrivate}
                  onChange={(e) => setBlockPrivate(e.target.checked)}
                  disabled={!roleCapabilities.canEditScope}
                />
                Block private / link-local IP ranges (SSRF guard)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={effectiveLocalLab}
                  onChange={(e) => setLocalLabException(e.target.checked)}
                  disabled={!roleCapabilities.canEditScope}
                />
                Local Lab loopback exception active
              </label>
            </div>
          </Panel>

          {/* 4. Provisional Budgets */}
          <Panel className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">4. Execution Budgets (Provisional SRS Limits)</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FormField id="b-depth" label="Max Crawl Depth">
                <input
                  id="b-depth"
                  type="number"
                  value={effectiveBudgets.maxCrawlDepth}
                  onChange={(e) => setBudgets({ ...effectiveBudgets, maxCrawlDepth: Number(e.target.value) })}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
              <FormField id="b-reqs" label="Max Requests">
                <input
                  id="b-reqs"
                  type="number"
                  value={effectiveBudgets.maxRequests}
                  onChange={(e) => setBudgets({ ...effectiveBudgets, maxRequests: Number(e.target.value) })}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
              <FormField id="b-rate" label="Rate Limit (req/s)">
                <input
                  id="b-rate"
                  type="number"
                  step="0.5"
                  value={effectiveBudgets.perHostRateRps}
                  onChange={(e) => setBudgets({ ...effectiveBudgets, perHostRateRps: Number(e.target.value) })}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
              <FormField id="b-conc" label="Concurrency">
                <input
                  id="b-conc"
                  type="number"
                  value={effectiveBudgets.concurrency}
                  onChange={(e) => setBudgets({ ...effectiveBudgets, concurrency: Number(e.target.value) })}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
              <FormField id="b-ttl" label="Max Duration (sec)">
                <input
                  id="b-ttl"
                  type="number"
                  value={effectiveBudgets.maxWallClockSeconds}
                  onChange={(e) => setBudgets({ ...effectiveBudgets, maxWallClockSeconds: Number(e.target.value) })}
                  disabled={!roleCapabilities.canEditScope}
                  className={`${inputClassName} font-mono`}
                />
              </FormField>
            </div>
          </Panel>
        </div>

        {/* Right column: Normalized Preview + Save Version */}
        <div className="space-y-6">
          <Panel className="p-5 space-y-4 sticky top-20">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Shield className="h-4 w-4 text-teal-400" aria-hidden="true" />
              <span>Normalized Scope Preview</span>
            </div>
            <pre className="rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {normalizedPreview}
            </pre>
            <p className="text-xs text-slate-400">
              Frontend validation provides immediate feedback only; the backend controller and restricted runner enforce
              authoritative DNS/IP and scope boundaries.
            </p>

            {roleCapabilities.canEditScope && (
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <FormField id="scope-summary" label="Change Summary (New Version)">
                  <input
                    id="scope-summary"
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    placeholder="Reason for new immutable scope version..."
                    className={inputClassName}
                  />
                </FormField>
                <Button type="submit" variant="primary" className="w-full" disabled={saveMut.isPending}>
                  {saveMut.isPending ? 'Saving Version...' : 'Save as New Scope Version'}
                </Button>
                <p className="text-[11px] text-slate-500">
                  Saving creates a new version in Pending Approval state. Project Owner approval is required before running assessments.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </form>
    </div>
  );
}

export function ScopeVersionsPage() {
  const { targetId = '' } = useParams();
  const { roleCapabilities } = useAppSession();
  const qc = useQueryClient();

  const targetQ = useQuery({
    queryKey: ['target', targetId],
    queryFn: () => apiClient.getTargetById(targetId),
    enabled: Boolean(targetId),
  });

  const approveMut = useMutation({
    mutationFn: ({ scopeId, decision }: { scopeId: string; decision: 'approved' | 'rejected' }) =>
      apiClient.approveScopeVersion(scopeId, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target', targetId] });
      qc.invalidateQueries({ queryKey: ['targets'] });
    },
  });

  if (targetQ.isLoading) return <LoadingSkeleton rows={4} />;
  if (targetQ.error || !targetQ.data) return <ErrorState message="Scope versions could not be loaded." />;

  const { target, scopeVersions } = targetQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Targets', to: '/app/targets' },
          { label: target.displayName, to: `/app/targets/${target.id}` },
          { label: 'Scope Versions' },
        ]}
        title={`Scope Version History: ${target.displayName}`}
        description="Immutable scope snapshots retained for run reproducibility and Project Owner approval governance."
        actions={
          <Link
            to={`/app/targets/${target.id}/scope`}
            className="inline-flex h-9 items-center rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-500"
          >
            Edit / Create New Version
          </Link>
        }
      />

      <div className="space-y-4">
        {scopeVersions.map((sv) => (
          <Panel key={sv.id} className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-semibold text-slate-100">{sv.versionLabel}</span>
                <ScopeApprovalBadge state={sv.approvalState} />
              </div>
              <div className="flex items-center gap-2">
                {roleCapabilities.canApproveScope && sv.approvalState === 'pending_approval' && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => approveMut.mutate({ scopeId: sv.id, decision: 'approved' })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => approveMut.mutate({ scopeId: sv.id, decision: 'rejected' })}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-300">{sv.changeSummary}</p>
            <div className="text-xs text-slate-400">
              Created by <span className="font-mono">{sv.createdBy}</span> at {formatTimestamp(sv.createdAt)}
              {sv.approvedBy && (
                <>
                  {' · '}Reviewed by <span className="font-mono">{sv.approvedBy}</span> at {formatTimestamp(sv.approvedAt)}
                </>
              )}
            </div>
            <pre className="rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {sv.normalizedPreview}
            </pre>
          </Panel>
        ))}
      </div>
    </div>
  );
}
