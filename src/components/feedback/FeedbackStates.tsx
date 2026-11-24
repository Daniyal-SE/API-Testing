import React from 'react';
import { AlertCircle, Ban, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/src/components/ui/Primitives';

export function DemoBanner() {
  return (
    <div
      role="status"
      className="inline-flex items-center gap-1.5 sm:gap-2 rounded border border-amber-600/40 bg-amber-950/40 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium text-amber-300 whitespace-nowrap shrink-0"
      title="Frontend is running against the isolated local demo adapter; no live target scanning traffic is sent."
    >
      <span className="font-mono tracking-tight sm:hidden">DEMO</span>
      <span className="font-mono tracking-tight hidden sm:inline">DEMO DATA</span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <span className="hidden sm:inline text-amber-200/80">Isolated Local Adapter</span>
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 w-full animate-pulse rounded-md border border-slate-800 bg-slate-900/70" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-500" aria-hidden="true" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-4 rounded-lg border border-red-800/60 bg-red-950/30 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-red-200">{title}</h3>
          <p className="mt-0.5 text-xs text-red-300/90">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function ForbiddenState({
  title = 'Access Restricted',
  message = 'Your current role does not permit this operation. Backend permissions remain authoritative.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-4"
    >
      <Ban className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-semibold text-amber-200">{title}</h3>
        <p className="mt-0.5 text-xs text-amber-200/80">{message}</p>
      </div>
    </div>
  );
}
