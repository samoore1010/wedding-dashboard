import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils';

interface EditableTextProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  numeric?: boolean;
  align?: 'left' | 'right' | 'center';
  ariaLabel?: string;
  blank?: string; // string to show in display mode when value is empty
}

export function EditableText({
  value,
  onChange,
  placeholder,
  className,
  multiline,
  numeric,
  align = 'left',
  ariaLabel,
  blank = '—',
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  };

  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={ariaLabel || placeholder}
        onClick={() => setEditing(true)}
        className={cn(
          'inline-edit cursor-text text-left w-full block',
          alignClass,
          !value && 'text-muted/70',
          className
        )}
        style={{ minHeight: multiline ? 56 : 32 }}
      >
        {value ? value : placeholder || blank}
      </button>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={ref as any}
        className={cn('inline-edit', alignClass, className)}
        style={{ minHeight: 56 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      ref={ref as any}
      className={cn('inline-edit', alignClass, className)}
      type={numeric ? 'number' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      placeholder={placeholder}
    />
  );
}
