import { cn } from '../../utils';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  tone?: 'accent' | 'sage' | 'primary' | 'danger';
  height?: 'sm' | 'md' | 'lg';
  gradient?: boolean;
}

export function ProgressBar({
  value,
  className,
  tone = 'accent',
  height = 'md',
  gradient = false,
}: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, value));
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };
  const fill = gradient
    ? 'bg-gradient-to-r from-sage to-accent'
    : tone === 'sage'
    ? 'bg-sage'
    : tone === 'primary'
    ? 'bg-primary'
    : tone === 'danger'
    ? 'bg-danger'
    : 'bg-accent';

  return (
    <div
      className={cn(
        'w-full bg-border/70 rounded-full overflow-hidden',
        heights[height],
        className
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', fill)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
