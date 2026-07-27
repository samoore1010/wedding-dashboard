import { useCallback, useState } from 'react';

/**
 * Explicit edit/save for a panel of fields.
 *
 * Nothing typed reaches the store until `save()` is called, so a stray
 * keystroke can't quietly change saved data. While not editing, `shown` is the
 * live value straight from the store; while editing it's the local draft.
 *
 *   const s = useEditSession(vendor, (next) => updateVendor(vendor.id, next));
 *   <Input value={s.shown.name} disabled={!s.editing}
 *          onChange={(e) => s.set({ name: e.target.value })} />
 *   {s.editing ? <button onClick={s.save}>Save</button>
 *              : <button onClick={s.start}>Edit</button>}
 */
export interface EditSession<T> {
  /** Is the panel unlocked for editing? */
  editing: boolean;
  /** What the fields should display — the draft while editing, else the saved value. */
  shown: T;
  /** True once the draft differs from what's saved. */
  dirty: boolean;
  start: () => void;
  cancel: () => void;
  save: () => void;
  /** Patch one or more draft fields. Ignored when not editing. */
  set: (patch: Partial<T>) => void;
}

export function useEditSession<T extends object>(
  value: T,
  onSave: (next: T) => void
): EditSession<T> {
  // null means "not editing" — there is no draft at all, so nothing to leak.
  const [draft, setDraft] = useState<T | null>(null);

  const start = useCallback(() => setDraft(structuredClone(value)), [value]);
  const cancel = useCallback(() => setDraft(null), []);

  // Save outside the state updater: React may run an updater during a render
  // pass, and writing to the store from there updates other components mid-render.
  const save = useCallback(() => {
    if (draft) onSave(draft);
    setDraft(null);
  }, [draft, onSave]);

  const set = useCallback(
    (patch: Partial<T>) => setDraft((d) => (d ? { ...d, ...patch } : d)),
    []
  );

  return {
    editing: draft !== null,
    shown: draft ?? value,
    dirty: draft !== null && JSON.stringify(draft) !== JSON.stringify(value),
    start,
    cancel,
    save,
    set,
  };
}
