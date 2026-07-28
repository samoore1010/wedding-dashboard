import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { useShallowStore } from '../../store';
import { useViewer } from '../../viewer';
import { Button } from '../ui/Button';
import { ReviewDialog } from './ReviewDialog';
import { ReviewRow } from './ReviewRow';
import { otherPartner, partnerName, requestsForTarget } from '../../reviews';
import type { ReviewTarget } from '../../types';

/**
 * "Ask Drew to review" — hands the record you're looking at to your partner.
 * Drop it anywhere a single record is on screen.
 */
export function AskReviewButton({
  target,
  title,
  size = 'sm',
  variant = 'outline',
}: {
  target: ReviewTarget;
  title: string;
  size?: 'sm' | 'md';
  variant?: 'outline' | 'soft' | 'primary';
}) {
  const settings = useShallowStore((s) => s.settings);
  const viewer = useViewer((s) => s.viewer);
  const [open, setOpen] = useState(false);
  // Before anyone says who they are, the button stays generic.
  const them = viewer ? partnerName(settings, otherPartner(viewer)) : '';

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon={<UserCheck size={14} />}
        onClick={() => setOpen(true)}
      >
        {them ? `Ask ${them} to review` : 'Ask for a review'}
      </Button>
      <ReviewDialog open={open} onClose={() => setOpen(false)} target={target} title={title} />
    </>
  );
}

/**
 * Every call-out attached to one record, plus the way to add another. Shown on
 * the record's own page so the conversation lives next to the thing itself.
 */
export function ReviewPanel({ target, title }: { target: ReviewTarget; title: string }) {
  const requests = useShallowStore((s) => requestsForTarget(s.reviewRequests, target));

  return (
    <div className="space-y-3">
      {requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((r) => (
            <ReviewRow key={r.id} request={r} />
          ))}
        </div>
      )}
      {!requests.length && (
        <p className="text-sm text-muted/70">
          Nobody's been asked to look at this yet.
        </p>
      )}
      <AskReviewButton target={target} title={title} />
    </div>
  );
}
