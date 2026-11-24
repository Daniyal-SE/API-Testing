import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DataTable, FilterToolbar, MetricCard, Pagination } from '@/src/components/data-display/DataDisplay';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SafeText, SemanticBadge } from '@/src/components/security/StatusBadges';
import { Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';
import type { DiscoveredUrlItem } from '@/src/types/domain';

export function UrlInventoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const urlsQ = useQuery({ queryKey: ['urls'], queryFn: () => apiClient.getUrls() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (urlsQ.data ?? []).filter((u) => {
      const mMethod = methodFilter === 'all' || (u.method ?? 'GET') === methodFilter;
      const mSource = sourceFilter === 'all' || u.source === sourceFilter;
      const mScope = scopeFilter === 'all' || u.scopeStatus === scopeFilter;
      const mQuery =
        !q ||
        u.normalizedUrl.toLowerCase().includes(q) ||
        u.path.toLowerCase().includes(q) ||
        u.host.toLowerCase().includes(q);
      return mMethod && mSource && mScope && mQuery;
    });
  }, [urlsQ.data, search, methodFilter, sourceFilter, scopeFilter]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const summary = useMemo(() => {
    const list = urlsQ.data ?? [];
    return {
      total: list.length,
      inScope: list.filter((u) => u.scopeStatus === 'in_scope').length,
      excluded: list.filter((u) => u.scopeStatus === 'excluded_pattern').length,
      blockedRedirects: list.filter((u) => u.scopeStatus === 'blocked_redirect').length,
    };
  }, [urlsQ.data]);

  const columns = [
    {
      key: 'url',
      header: 'URL / Path',
      render: (u: DiscoveredUrlItem) => (
        <div className="min-w-0 max-w-md">
          <Link to={`/app/inventory/urls/${u.id}`} className="font-mono text-xs text-teal-400 hover:underline break-all">
            {u.path}
          </Link>
          <div className="font-mono text-[11px] text-slate-500 truncate">{u.host}</div>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (u: DiscoveredUrlItem) => <span className="font-mono text-xs text-slate-200">{u.method ?? 'GET'}</span>,
    },
    {
      key: 'type',
      header: 'Asset Type',
      render: (u: DiscoveredUrlItem) => <span className="text-xs text-slate-300">{u.assetType}</span>,
    },
    {
      key: 'source',
      header: 'Provenance',
      render: (u: DiscoveredUrlItem) => <span className="font-mono text-xs text-slate-300">{u.source}</span>,
    },
    {
      key: 'scope',
      header: 'Scope Eligibility',
      render: (u: DiscoveredUrlItem) => (
        <SemanticBadge
          label={u.scopeStatus.replace(/_/g, ' ')}
          tone={u.scopeStatus === 'in_scope' ? 'success' : u.scopeStatus === 'blocked_redirect' ? 'error' : 'warning'}
        />
      ),
    },
    {
      key: 'test',
      header: 'Test Status',
      render: (u: DiscoveredUrlItem) => (
        <SemanticBadge
          label={u.testStatus.replace(/_/g, ' ')}
          tone={
            u.testStatus === 'tested_passive'
              ? 'info'
              : u.testStatus === 'blocked'
                ? 'error'
                : 'neutral'
          }
        />
      ),
    },
    {
      key: 'seen',
      header: 'Last Seen',
      render: (u: DiscoveredUrlItem) => <span className="font-mono text-xs text-slate-400 tabular-nums">{formatTimestamp(u.lastSeenAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Discovery' }, { label: 'URL Inventory' }]}
        title="URL Discovery & Inventory"
        description="Bounded pages, routes, forms, and endpoints recorded during discovery. Discovery never grants automatic active test eligibility."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Discovered Assets" value={summary.total} />
        <MetricCard label="In-Scope Eligible" value={summary.inScope} />
        <MetricCard label="Excluded by Scope" value={summary.excluded} />
        <MetricCard label="Blocked Redirects" value={summary.blockedRedirects} />
      </div>

      <FilterToolbar searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search by path, host, or URL...">
        <select
          aria-label="HTTP method filter"
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        <select
          aria-label="Provenance filter"
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Sources</option>
          <option value="crawler">crawler</option>
          <option value="link">link</option>
          <option value="form">form</option>
          <option value="sitemap">sitemap</option>
          <option value="openapi">openapi</option>
        </select>
        <select
          aria-label="Scope eligibility filter"
          value={scopeFilter}
          onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}
          className="h-8 rounded border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
        >
          <option value="all">All Scope States</option>
          <option value="in_scope">In Scope</option>
          <option value="excluded_pattern">Excluded Pattern</option>
          <option value="blocked_redirect">Blocked Redirect</option>
        </select>
      </FilterToolbar>

      {urlsQ.error ? (
        <ErrorState message="Failed to load URL inventory." onRetry={() => urlsQ.refetch()} />
      ) : urlsQ.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No URLs matched your filters" description="Adjust discovery filters or run bounded URL discovery." />
      ) : (
        <>
          <DataTable columns={columns} rows={paged} rowKey={(u) => u.id} onRowClick={(u) => navigate(`/app/inventory/urls/${u.id}`)} />
          <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export function UrlDetailPage() {
  const { urlId = '' } = useParams();
  const detailQ = useQuery({
    queryKey: ['url-detail', urlId],
    queryFn: () => apiClient.getUrlById(urlId),
    enabled: Boolean(urlId),
  });

  if (detailQ.isLoading) return <LoadingSkeleton rows={4} />;
  if (detailQ.error || !detailQ.data) {
    return <ErrorState message="Discovered URL record not found." onRetry={() => detailQ.refetch()} />;
  }

  const { url, relatedFindings, zapAlerts } = detailQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'URL Inventory', to: '/app/inventory/urls' },
          { label: url.path },
        ]}
        title={url.path}
        description="Normalized discovered URL provenance, scope eligibility rationale, and associated passive observations."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Provenance & Scope Eligibility</h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2">
              <dt className="text-slate-400">Normalized URL</dt>
              <dd className="mt-1">
                <SafeText text={url.normalizedUrl} mono />
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">HTTP Method</dt>
              <dd className="mt-0.5 font-mono text-slate-200">{url.method ?? 'GET'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Asset Type / Source</dt>
              <dd className="mt-0.5 font-mono text-slate-200">
                {url.assetType} · {url.source}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">First Seen</dt>
              <dd className="mt-0.5 font-mono text-slate-300 tabular-nums">{formatTimestamp(url.firstSeenAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last Seen</dt>
              <dd className="mt-0.5 font-mono text-slate-300 tabular-nums">{formatTimestamp(url.lastSeenAt)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Scope Decision Rationale</dt>
              <dd className="mt-0.5 text-slate-200">{url.scopeReason}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Discovery Run</dt>
              <dd className="mt-0.5">
                <Link to={`/app/assessments/${url.runId}/monitor`} className="font-mono text-teal-400 hover:underline">
                  {url.runId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Test Eligibility</dt>
              <dd className="mt-0.5 font-mono text-slate-200">{url.testStatus}</dd>
            </div>
          </dl>
        </Panel>

        <Panel className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">Collected Parameters & Forms</h2>
          <div>
            <div className="text-xs text-slate-400 mb-1">Query / Path Parameters</div>
            {url.parameters.length === 0 ? (
              <p className="text-xs text-slate-500">None recorded.</p>
            ) : (
              <div className="font-mono text-xs text-slate-200">{url.parameters.join(', ')}</div>
            )}
          </div>
          {url.formFields && url.formFields.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Form Inputs Discovered</div>
              <div className="font-mono text-xs text-slate-200">{url.formFields.join(', ')}</div>
            </div>
          )}
          <div className="border-t border-slate-800 pt-3">
            <div className="text-xs font-medium text-slate-300 mb-1.5">Related Findings & Passive Alerts</div>
            {relatedFindings.length === 0 && zapAlerts.length === 0 ? (
              <p className="text-xs text-slate-500">No findings or passive alerts linked to this URL.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {relatedFindings.map((f) => (
                  <li key={f.id}>
                    <Link to={`/app/findings/${f.id}`} className="text-teal-400 hover:underline">
                      {f.id}: {f.title}
                    </Link>
                  </li>
                ))}
                {zapAlerts.map((z) => (
                  <li key={z.id} className="text-slate-300">
                    ZAP Passive: {z.title} ({z.severity})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
