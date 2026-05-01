import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-surface rounded-xl2 shadow-lift border border-border w-full ${widths[size]} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-xl text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-border bg-bg/50 rounded-b-xl2 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
