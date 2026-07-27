import { Pencil, Check, X } from 'lucide-react';
import { Button } from './Button';
import { confirmAction } from './ConfirmDialog';
import type { EditSession } from './useEditSession';

/**
 * The Edit / Save + Cancel pair every editable panel shows. Locked panels get
 * one "Edit" button; unlocked ones get Save and Cancel, and cancelling with
 * unsaved changes asks first so edits aren't thrown away by a misclick.
 */
export function EditControls<T extends object>({
  session,
  label = 'Edit',
  size = 'md',
  what = 'these changes',
}: {
  session: EditSession<T>;
  label?: string;
  size?: 'sm' | 'md';
  /** Named in the discard prompt, e.g. "these contact details". */
  what?: string;
}) {
  const cancel = async () => {
    if (
      session.dirty &&
      !(await confirmAction({
        title: 'Discard changes?',
        message: `You haven't saved ${what}. Discard them?`,
        confirmLabel: 'Discard',
        variant: 'danger',
      }))
    ) {
      return;
    }
    session.cancel();
  };

  if (!session.editing) {
    return (
      <Button variant="outline" size={size} icon={<Pencil size={13} />} onClick={session.start}>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size={size} icon={<X size={13} />} onClick={cancel}>
        Cancel
      </Button>
      <Button size={size} icon={<Check size={13} />} onClick={session.save} disabled={!session.dirty}>
        Save
      </Button>
    </div>
  );
}
