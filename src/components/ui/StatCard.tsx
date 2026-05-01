import type { ReactNode } from 'react';
import { cn } from '../../utils';

type Tone = 'default' | 'accent' | 'rose' | 'sage' | 'warning' | 'danger';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}

const tones: Record<Tone, string> = {
  default: 'text-primary',
  accent: 'text-accent',
  rose: 'text-rose',
  sage: 'text-sage',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function StatCard({ label, value, hint, tone = 'default', icon }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl2 p-4 shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-muted">
          {label}
        </div>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
      <div className={cn('text-2xl md:text-3xl font-bold leading-tight', tones[tone])}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}
