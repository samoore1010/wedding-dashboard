import { create } from 'zustand';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'primary';
  resolver: ((v: boolean) => void) | null;
}

const useConfirm = create<
  ConfirmState & {
    ask: (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      variant?: 'danger' | 'primary';
    }) => Promise<boolean>;
    answer: (v: boolean) => void;
  }
>((set, get) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  variant: 'primary',
  resolver: null,
  ask: ({ title, message, confirmLabel = 'Confirm', variant = 'primary' }) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, title, message, confirmLabel, variant, resolver: resolve });
    }),
  answer: (v) => {
    const r = get().resolver;
    set({ open: false, resolver: null });
    r?.(v);
  },
}));

export const confirmAction = (opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}) => useConfirm.getState().ask(opts);

export function ConfirmDialog() {
  const { open, title, message, confirmLabel, variant, answer } = useConfirm();
  return (
    <Modal
      open={open}
      onClose={() => answer(false)}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => answer(false)}>
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => answer(true)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink/85 leading-relaxed">{message}</p>
    </Modal>
  );
}
