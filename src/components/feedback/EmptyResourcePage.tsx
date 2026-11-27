import { Link } from 'react-router-dom';
import { EmptyState } from '@/src/components/feedback/FeedbackStates';
import { PageHeader } from '@/src/components/layout/AppShell';

interface EmptyResourcePageProps {
  breadcrumbs: { label: string; to?: string }[];
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
  actionTo: string;
}

/**
 * Dedicated page shown when a nested resource view is opened before any parent record exists.
 */
export function EmptyResourcePage({
  breadcrumbs,
  title,
  description,
  emptyTitle,
  emptyDescription,
  actionLabel,
  actionTo,
}: EmptyResourcePageProps) {
  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={breadcrumbs} title={title} description={description} />
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Link
            to={actionTo}
            className="inline-flex h-9 items-center justify-center rounded-md border border-teal-500/40 bg-teal-600 px-4 text-xs font-medium text-white transition-colors hover:bg-teal-500"
          >
            {actionLabel}
          </Link>
        }
      />
    </div>
  );
}
