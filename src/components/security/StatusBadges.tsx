import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  Lock,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { VisualTone } from '@/src/lib/status-mappers';
import {
  mapFindingStatus,
  mapRunState,
  mapScopeApprovalState,
  mapSeverity,
  mapTargetAuthStatus,
} from '@/src/lib/status-mappers';
import { boundUntrustedText, formatTimestamp } from '@/src/lib/formatters';
import type { RunPhaseStep, RunnerReadiness } from '@/src/types/domain';

function toneClasses(tone: VisualTone): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-700/40 bg-emerald-950/50 text-emerald-300 dark:text-emerald-300 light:text-emerald-800';
    case 'warning':
      return 'border-amber-600/40 bg-amber-950/50 text-amber-300';
    case 'error':
      return 'border-red-700/50 bg-red-950/60 text-red-300';
    case 'info':
      return 'border-sky-700/50 bg-sky-950/50 text-sky-300';
    case 'unknown':
      return 'border-slate-600/60 bg-slate-800/80 text-slate-300';
    case 'neutral':
    default:
      return 'border-slate-700 bg-slate-800/70 text-slate-300';
  }
}

function ToneIcon({ tone }: { tone: VisualTone }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (tone) {
    case 'success':
      return <CheckCircle2 className={cls} aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className={cls} aria-hidden="true" />;
    case 'error':
      return <XCircle className={cls} aria-hidden="true" />;
    case 'info':
      return <Info className={cls} aria-hidden="true" />;
    case 'unknown':
      return <HelpCircle className={cls} aria-hidden="true" />;
    default:
      return <Clock className={cls} aria-hidden="true" />;
  }
}

export function SemanticBadge({ label, tone }: { label: string; tone: VisualTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${toneClasses(tone)}`}
    >
      <ToneIcon tone={tone} />
      <span>{label}</span>
    </span>
  );
}

export function RunStateBadge({ state }: { state?: string | null }) {
  const mapped = mapRunState(state);
  return <SemanticBadge label={mapped.label} tone={mapped.tone} />;
}

export function TargetAuthBadge({ status }: { status?: string | null }) {
  const mapped = mapTargetAuthStatus(status);
  return <SemanticBadge label={mapped.label} tone={mapped.tone} />;
}

export function ScopeApprovalBadge({ state }: { state?: string | null }) {
  const mapped = mapScopeApprovalState(state);
  return <SemanticBadge label={mapped.label} tone={mapped.tone} />;
}

export function FindingStatusBadge({ status }: { status?: string | null }) {
  const mapped = mapFindingStatus(status);
  return <SemanticBadge label={mapped.label} tone={mapped.tone} />;
}

export function SeverityBadge({ severity }: { severity?: string | null }) {
  const mapped = mapSeverity(severity);
  return <SemanticBadge label={mapped.label} tone={mapped.tone} />;
}

export function ScopeVersionBadge({
  versionLabel,
  approvalState,
}: {
  versionLabel?: string | null;
  approvalState?: string | null;
}) {
  const mapped = mapScopeApprovalState(approvalState);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 whitespace-nowrap">
      <span>{versionLabel ?? 'No scope'}</span>
      <span aria-hidden="true">·</span>
      <span className={mapped.isApproved ? 'text-emerald-400' : 'text-amber-400'}>{mapped.label}</span>
    </span>
  );
}

export function SafeText({
  text,
  maxChars = 1600,
  mono = false,
  className = '',
}: {
  text?: string | null;
  maxChars?: number;
  mono?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const bounded = boundUntrustedText(text, expanded ? 12000 : maxChars);

  return (
    <div className={className}>
      <pre
        className={`whitespace-pre-wrap break-words text-xs leading-relaxed ${
          mono ? 'font-mono text-slate-200' : 'font-sans text-slate-200'
        }`}
      >
        {bounded.text || '—'}
      </pre>
      {bounded.truncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-medium text-teal-400 hover:text-teal-300"
        >
          {expanded
            ? 'Collapse preview'
            : `Show more (${bounded.originalLength.toLocaleString()} chars total, bounded preview)`}
        </button>
      )}
    </div>
  );
}

export function RunnerReadinessPanel({
  readiness,
  isLoading,
  compact = false,
}: {
  readiness?: RunnerReadiness | null;
  isLoading?: boolean;
  compact?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
        Checking backend runner readiness...
      </div>
    );
  }
  if (!readiness) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
        Runner readiness telemetry unavailable from backend.
      </div>
    );
  }

  const rows = [
    { label: 'Controller Availability', value: readiness.controllerStatus },
    { label: 'Worker Queue Status', value: readiness.workerQueueStatus },
    { label: 'Scope Validation Gate', value: readiness.scopeValidationOutcome },
    { label: 'DNS / Host Policy Gate', value: readiness.dnsHostPolicyOutcome },
    { label: 'Budget Validation Gate', value: readiness.budgetValidationOutcome },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {readiness.overallReady ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
          )}
          <h3 className="text-sm font-semibold text-slate-100">Safe Test Runner Readiness</h3>
        </div>
        <SemanticBadge
          label={readiness.overallReady ? 'Backend Gates Passed' : 'Launch Blocked'}
          tone={readiness.overallReady ? 'success' : 'warning'}
        />
      </div>

      <p className="text-xs text-slate-300">{readiness.diagnosticMessage}</p>

      <dl
        className={`grid grid-cols-1 gap-2 text-xs ${
          compact ? '' : 'sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
          >
            <dt className="text-slate-400 min-w-0 truncate">{row.label}</dt>
            <dd className="font-mono font-medium text-slate-200 shrink-0">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-slate-400 min-w-0 truncate">Local Lab Exception</dt>
          <dd className="font-mono font-medium text-slate-200 shrink-0">
            {readiness.localLabExceptionActive ? 'Active (Loopback)' : 'Disabled'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1 border-t border-slate-800/80">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Runner controls remain server-side only (no browser-to-target traffic)</span>
        </span>
        <span className="font-mono tabular-nums">Last check: {formatTimestamp(readiness.lastHealthCheckAt)}</span>
      </div>
    </div>
  );
}

export function RunStateTimeline({ phases }: { phases: RunPhaseStep[] }) {
  return (
    <ol className="space-y-3" aria-label="Assessment phase timeline">
      {phases.map((phase, idx) => {
        const tone: VisualTone =
          phase.status === 'completed'
            ? 'success'
            : phase.status === 'running'
              ? 'info'
              : phase.status === 'cancelled'
                ? 'warning'
                : phase.status === 'failed'
                  ? 'error'
                  : 'neutral';
        return (
          <li
            key={phase.id}
            className="flex items-start justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/50 px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <span className="font-mono text-xs text-slate-500 tabular-nums">0{idx + 1}.</span>
                <span>{phase.label}</span>
              </div>
              {phase.detail && <p className="mt-0.5 text-xs text-slate-400">{phase.detail}</p>}
            </div>
            <SemanticBadge label={phase.status} tone={tone} />
          </li>
        );
      })}
    </ol>
  );
}
