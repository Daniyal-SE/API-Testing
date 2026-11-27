import { ArrowLeft, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ComingSoonPageProps {
  title?: string;
}

/**
 * Centered placeholder page for Semester 8 features that are not yet active.
 */
export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] w-full items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/60 px-8 py-10 text-center shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400">
          <Clock className="h-6 w-6" aria-hidden="true" />
        </div>

        <span className="mt-4 inline-block rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-300">
          Semester 8
        </span>

        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-100">
          Coming Soon
        </h1>

        {title && (
          <p className="mt-1.5 text-sm font-medium text-teal-400">{title}</p>
        )}

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          This module is planned for Semester 8 and is currently under development.
        </p>

        <div className="mt-6">
          <Link
            to="/app/dashboard"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800/90 px-4 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
