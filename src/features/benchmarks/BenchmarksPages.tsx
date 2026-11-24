import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from '@/src/components/data-display/DataDisplay';
import { ErrorState, LoadingSkeleton } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';
import { SemanticBadge } from '@/src/components/security/StatusBadges';
import { Panel } from '@/src/components/ui/Primitives';
import { apiClient } from '@/src/lib/api-client';
import { formatTimestamp } from '@/src/lib/formatters';

export function BenchmarksPage() {
  const { benchmarkId } = useParams();
  const benchQ = useQuery({ queryKey: ['benchmarks'], queryFn: () => apiClient.getBenchmarks() });

  if (benchQ.isLoading) return <LoadingSkeleton rows={5} />;
  if (benchQ.error || !benchQ.data) return <ErrorState message="Failed to load benchmark evaluations." />;

  const active = benchmarkId
    ? benchQ.data.find((b) => b.id === benchmarkId) ?? benchQ.data[0]
    : benchQ.data[0];

  if (!active) return <ErrorState message="No benchmark evaluations available." />;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Research (Sem 8)' }, { label: 'Benchmarks & Evaluation' }]}
        title={`Benchmark Evaluation: ${active.name}`}
        description={`Version ${active.version} · Fixture: ${active.fixtureTargetName} · Sample Denominator: n=${active.metrics.sampleDenominator} · Evaluated ${formatTimestamp(active.evaluatedAt)}`}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {benchQ.data.map((b) => (
          <Link
            key={b.id}
            to={`/app/benchmarks/${b.id}`}
            className={`rounded border px-3 py-1.5 ${
              b.id === active.id
                ? 'border-teal-500 bg-teal-950/50 text-teal-300'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }`}
          >
            {b.name} (v{b.version})
          </Link>
        ))}
        <SemanticBadge label={active.groundTruthStatus.replace(/_/g, ' ')} tone="info" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Precision" value={`${Math.round(active.metrics.precision * 100)}%`} subtext={`n=${active.metrics.sampleDenominator}`} />
        <MetricCard label="Recall" value={`${Math.round(active.metrics.recall * 100)}%`} subtext={active.metrics.baselineComparisonDelta} />
        <MetricCard label="False-Positive Rate" value={`${Math.round(active.metrics.falsePositiveRate * 100)}%`} subtext={`v${active.version}`} />
        <MetricCard label="Operation Coverage" value={`${active.metrics.coveragePercent}%`} subtext="In-scope ops" />
        <MetricCard label="Reproducibility" value={`${active.metrics.reproducibilityPercent}%`} subtext="5 repeat trials" />
        <MetricCard label="Time-to-Triage" value={`${active.metrics.meanTimeToTriageMinutes}m`} subtext="Median per finding" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Metric Definitions & Sample Context</h2>
          <dl className="divide-y divide-slate-800">
            {Object.entries(active.metricDefinitions).map(([name, def]) => (
              <div key={name} className="py-2.5">
                <dt className="font-semibold text-slate-200">{name}</dt>
                <dd className="mt-0.5 text-slate-400">{def}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Evaluation Protocol & Academic Limitations</h2>
          <div>Reset Protocol: <span className="text-slate-200">{active.resetProtocol}</span></div>
          <div>Comparison Runs: <span className="font-mono text-teal-400">{active.comparisonRunIds.join(', ')}</span></div>
          <div className="rounded border border-amber-700/40 bg-amber-950/30 p-3 text-amber-200 leading-relaxed">
            {active.limitationsNote}
          </div>
        </Panel>
      </div>
    </div>
  );
}
