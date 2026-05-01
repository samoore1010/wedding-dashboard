import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger' | 'accent';
}

const tones = {
  default: 'text-muted hover:text-ink hover:bg-bg',
  danger: 'text-muted hover:text-danger hover:bg-danger/10',
  accent: 'text-accent hover:bg-accent/10',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = 'default', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        tones[tone],
        className
      )}
      {...rest}
    />
  )
);
IconButton.displayName = 'IconButton';
