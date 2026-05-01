import { type ReactNode } from 'react';
import { cn } from '../../utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
}

export function Card({ children, className, title, action, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-xl2 shadow-soft',
        padded && 'p-5 md:p-6',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          {title && (
            <h2 className="font-display text-2xl text-primary leading-tight">
              {title}
            </h2>
          )}
          {action && <div className="flex gap-2 items-center">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
