import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:brightness-95 active:brightness-90 shadow-sm border border-accent',
  outline:
    'bg-transparent border border-border text-ink hover:border-primary hover:bg-bg',
  ghost: 'bg-transparent text-ink hover:bg-bg',
  danger:
    'bg-transparent border border-danger text-danger hover:bg-danger hover:text-white',
  soft: 'bg-bg border border-border text-ink hover:bg-border/40',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, icon, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
