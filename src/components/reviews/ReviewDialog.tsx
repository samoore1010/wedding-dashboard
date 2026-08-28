import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useShallowStore } from '../../store';
import { useViewer } from '../../viewer';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, LabeledField } from '../ui/Field';
import { ViewerPicker } from './ViewerPicker';
import { noTarget, otherPartner, partnerName, PARTNER_IDS } from '../../reviews';
import { cn } from '../../utils';
import type { PartnerId, ReviewRequest, ReviewTarget } from '../../types';

/**
 * Compose a call-out: who should look, and what at.
 *
 * Used both from a record's own page (the target and title come in fixed) and
 * from the overview, where a free-standing call-out carries its own title and
 * link instead.
 */
export function ReviewDialog({
  open,
  onClose,
  target = noTarget(),
  title = '',
  existing,
}: {
  open: boolean;
  onClose: () => void;
  /** The record being handed over. Omit for a free-standing call-out. */
  target?: ReviewTarget;
  /** Name of that record — becomes the call-out's headline. */
  title?: string;
  /** Editing an existing call-out rather than writing a new one. */
  existing?: ReviewRequest;
}) {
  const { settings, addReviewRequest, updateReviewRequest } = useShallowStore((s) => ({
    settings: s.settings,
    addReviewRequest: s.addReviewRequest,
    updateReviewRequest: s.updateReviewRequest,
  }));
  const viewer = useViewer((s) => s.viewer);

  const suggestedTo = existing?.to ?? (viewer ? otherPartner(viewer) : 'p2');
  const [to, setTo] = useState<PartnerId>(suggestedTo);
  const [ask, setAsk] = useState(existing?.ask ?? '');
  const [headline, setHeadline] = useState(existing?.title ?? title);
  const [url, setUrl] = useState(existing?.url ?? '');

  // Reopening the dialog starts from the current record / viewer again.
  useEffect(() => {
    if (!open) return;
    setTo(existing?.to ?? (viewer ? otherPartner(viewer) : 'p2'));
    setAsk(existing?.ask ?? '');
    setHeadline(existing?.title ?? title);
    setUrl(existing?.url ?? '');
  }, [open, existing, title, viewer]);

  const freeStanding = (existing?.target ?? target).kind === 'none';
  const finalTitle = (freeStanding ? headline : title).trim();

  const submit = () => {
    if (!finalTitle) {
      toast.error('Give it a name so it reads well on the overview');
      return;
    }
    if (existing) {
      updateReviewRequest(existing.id, { to, ask: ask.trim(), title: finalTitle, url: url.trim() });
      toast.success('Call-out updated');
    } else {
      addReviewRequest({
        to,
        // Whoever is at this browser is asking; fall back to the other slot.
        from: viewer ?? otherPartner(to),
        title: finalTitle,
        ask: ask.trim(),
        url: url.trim(),
        target,
      });
      toast.success(`Sent to ${partnerName(settings, to)}`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit call-out' : 'Ask for a review'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{existing ? 'Save' : 'Send it over'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!viewer && (
          <ViewerPicker
            label="First — who are you?"
            hint="Kept on this device so the dashboard knows what's waiting on you."
            className="pb-4 border-b border-border"
          />
        )}

        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
            Who should look?
          </div>
          <div className="flex gap-2">
            {PARTNER_IDS.map((p) => (
              <button
                key={p}
                onClick={() => setTo(p)}
                className={cn(
                  'flex-1 h-9 rounded-lg border text-sm font-medium transition-colors',
                  to === p
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-ink hover:border-primary-soft'
                )}
              >
                {partnerName(settings, p)}
              </button>
            ))}
          </div>
        </div>

        {freeStanding ? (
          <>
            <LabeledField label="What is it?">
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Audio guestbook idea"
                autoFocus
              />
            </LabeledField>
            <LabeledField label="Link (optional)">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </LabeledField>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-bg/50 px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">About</div>
            <div className="text-sm text-ink truncate">{title || 'This item'}</div>
          </div>
        )}

        <LabeledField label="What should they do?" hint="They'll see this on the overview.">
          <Textarea
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            rows={4}
            placeholder="Take a look at the design options and tell me what you think…"
            autoFocus={!freeStanding}
          />
        </LabeledField>
      </div>
    </Modal>
  );
}
