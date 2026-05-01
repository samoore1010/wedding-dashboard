import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../utils';

const inputBase =
  'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors ' +
  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cn(inputBase, className)} {...rest} />
));
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...rest }, ref) => (
    <select ref={ref} className={cn(inputBase, 'cursor-pointer', className)} {...rest}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputBase, 'resize-y leading-relaxed', className)}
      {...rest}
    />
  )
);
Textarea.displayName = 'Textarea';

interface LabeledFieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}
export function LabeledField({ label, hint, children, className }: LabeledFieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-semibold text-muted uppercase tracking-wider">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
