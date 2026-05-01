import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-6">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-bg text-muted mb-3">
        {icon}
      </div>
      <h4 className="font-display text-xl text-primary mb-1">{title}</h4>
      {description && (
        <p className="text-sm text-muted max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}
