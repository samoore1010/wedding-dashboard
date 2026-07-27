import { useEffect, useRef, useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
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

/**
 * A single value that reads as text until you choose to edit it.
 *
 * Editing is deliberate in both directions: click (or Enter/Space) to open the
 * editor, then Save or Enter to commit, Cancel or Escape to throw the draft
 * away. Clicking elsewhere does NOT commit and does NOT discard — the editor
 * simply stays open — so neither a stray keystroke nor a stray click can change
 * saved data.
 */
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

  // Keep the draft in step with outside changes while we're not editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ? `Edit ${ariaLabel}` : `Edit ${placeholder ?? 'value'}`}
        onClick={() => setEditing(true)}
        className={cn(
          'inline-edit group/edit cursor-pointer text-left w-full flex items-start gap-1',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
          !value && 'text-muted/70',
          className
        )}
        style={{ minHeight: multiline ? 56 : 32 }}
      >
        <span className={cn('min-w-0 flex-1 whitespace-pre-wrap', alignClass)}>
          {value ? value : placeholder || blank}
        </span>
        <Pencil
          size={11}
          className="shrink-0 mt-1 opacity-0 group-hover/edit:opacity-60 group-focus-visible/edit:opacity-60 transition-opacity"
        />
      </button>
    );
  }

  const actions = (
    <span className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={commit}
        aria-label="Save"
        className="p-1 rounded text-success hover:bg-success/10"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={cancel}
        aria-label="Cancel"
        className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10"
      >
        <X size={14} />
      </button>
    </span>
  );

  if (multiline) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          ref={ref as any}
          className={cn('inline-edit', alignClass, className)}
          style={{ minHeight: 56 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
            if (e.key === 'Escape') cancel();
          }}
          placeholder={placeholder}
        />
        <span className="flex justify-end">{actions}</span>
      </div>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        ref={ref as any}
        className={cn('inline-edit min-w-0 flex-1', alignClass, className)}
        type={numeric ? 'number' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        placeholder={placeholder}
      />
      {actions}
    </span>
  );
}
