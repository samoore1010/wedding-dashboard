import { useEffect, useRef, useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { Select } from './Field';
import { cn } from '../../utils';

/**
 * The {@link EditableText} pattern for a fixed set of choices: the value reads
 * as text until you click it, then Save commits and Cancel discards. Picking an
 * option on its own changes nothing until Save.
 */
export function EditableSelect({
  value,
  options,
  onChange,
  className,
  displayClassName,
  ariaLabel,
  blank = '—',
}: {
  value: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  onChange: (next: string) => void;
  className?: string;
  /** Extra classes for the read-mode label, e.g. a status colour. */
  displayClassName?: string;
  ariaLabel?: string;
  blank?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = items.find((o) => o.value === value);

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Edit'}
        onClick={() => setEditing(true)}
        className={cn(
          'inline-edit group/edit cursor-pointer text-left w-full flex items-center gap-1',
          className
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-muted/70', displayClassName)}>
          {current?.label || blank}
        </span>
        <Pencil
          size={11}
          className="shrink-0 opacity-0 group-hover/edit:opacity-60 group-focus-visible/edit:opacity-60 transition-opacity"
        />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Select
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (draft !== value) onChange(draft);
            setEditing(false);
          }
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn('min-w-0 flex-1', className)}
      >
        {items.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => {
          if (draft !== value) onChange(draft);
          setEditing(false);
        }}
        aria-label="Save"
        className="p-1 rounded text-success hover:bg-success/10 shrink-0"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
        aria-label="Cancel"
        className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10 shrink-0"
      >
        <X size={14} />
      </button>
    </span>
  );
}
