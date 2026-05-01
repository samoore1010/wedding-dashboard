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

// Custom CSS chevron so the OS dropdown indicator doesn't clip long option
// text on Windows/Linux (where native <select> ignores padding-right).
const selectChevron =
  "appearance-none pr-8 bg-no-repeat bg-[length:14px_14px] [background-position:right_0.6rem_center] " +
  "[background-image:url(\"data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%20fill='%237A756E'%3e%3cpath%20fill-rule='evenodd'%20d='M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z'%20clip-rule='evenodd'/%3e%3c/svg%3e\")]";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cn(inputBase, className)} {...rest} />
));
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(inputBase, selectChevron, 'cursor-pointer', className)}
      {...rest}
    >
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
