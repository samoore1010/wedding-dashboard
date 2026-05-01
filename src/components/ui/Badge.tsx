import type { ReactNode } from 'react';
import { cn } from '../../utils';

type BadgeTone =
  | 'yes'
  | 'no'
  | 'waiting'
  | 'done'
  | 'pending'
  | 'neutral'
  | 'accent';

const tones: Record<BadgeTone, string> = {
  yes: 'bg-success/15 text-success border-success/25',
  no: 'bg-danger/10 text-danger border-danger/25',
  waiting: 'bg-warning/15 text-warning border-warning/30',
  done: 'bg-sage/20 text-sage border-sage/30',
  pending: 'bg-accent/15 text-accent border-accent/30',
  neutral: 'bg-bg border-border text-muted',
  accent: 'bg-accent/15 text-accent border-accent/30',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
