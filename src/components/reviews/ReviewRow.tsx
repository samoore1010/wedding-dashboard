import { useState } from 'react';
import { ArrowRight, Check, ExternalLink, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useShallowStore } from '../../store';
import { useViewer } from '../../viewer';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Textarea } from '../ui/Field';
import { ReviewDialog } from './ReviewDialog';
import { partnerName, targetLabel, timeAgo } from '../../reviews';
import { cn } from '../../utils';
import type { ReviewRequest } from '../../types';

/** Add https:// so a pasted bare domain still opens. */
const href = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

/**
 * One call-out, as it reads on the overview and on the item's own page.
 *
 * Who can do what follows from who's at the keyboard: the person it was sent
 * to answers it, the person who sent it can edit or withdraw it.
 */
export function ReviewRow({
  request: r,
  onOpen,
  compact,
}: {
  request: ReviewRequest;
  /** Jump to the record this points at. Omitted when you're already on it. */
  onOpen?: () => void;
  compact?: boolean;
}) {
  const { settings, resolveReview, removeReviewRequest } = useShallowStore((s) => ({
    settings: s.settings,
    resolveReview: s.resolveReview,
    removeReviewRequest: s.removeReviewRequest,
  }));
  const viewer = useViewer((s) => s.viewer);

  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);

  const done = r.status === 'done';
  // With nobody identified yet, show every control rather than hiding the
  // feature behind a question the couple hasn't been asked.
  const mine = !viewer || viewer === r.to;
  const sentByMe = !viewer || viewer === r.from;
  const label = targetLabel(r.target);

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-colors',
        done ? 'border-border bg-bg/40' : 'border-accent/30 bg-accent/[0.04]',
        compact && 'px-3 py-2'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {onOpen ? (
            <button
              onClick={onOpen}
              className="text-left group/open inline-flex items-center gap-1 min-w-0 max-w-full"
            >
              <span
                className={cn(
                  'text-sm font-semibold truncate group-hover/open:text-accent transition-colors',
                  done ? 'text-muted' : 'text-ink'
                )}
              >
                {r.title}
              </span>
              <ArrowRight
                size={12}
                className="shrink-0 text-muted opacity-0 group-hover/open:opacity-100 transition-opacity"
              />
            </button>
          ) : (
            <span className={cn('text-sm font-semibold', done ? 'text-muted' : 'text-ink')}>
              {r.title}
            </span>
          )}
          <div className="text-[11px] text-muted mt-0.5">
            {partnerName(settings, r.from)} → {partnerName(settings, r.to)}
            {label && ` · ${label}`}
            {` · ${timeAgo(r.createdAt)}`}
          </div>
        </div>
        <Badge tone={done ? 'done' : 'pending'}>{done ? 'Reviewed' : 'Waiting'}</Badge>
      </div>

      {r.ask.trim() && (
        <p className="text-sm text-ink/90 whitespace-pre-wrap mt-1.5 leading-relaxed">{r.ask}</p>
      )}

      {r.url.trim() && (
        <a
          href={href(r.url)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-accent mt-1.5 break-all"
        >
          <ExternalLink size={12} className="shrink-0" />
          {r.url}
        </a>
      )}

      {done && r.reply.trim() && (
        <p className="text-sm text-ink/90 whitespace-pre-wrap mt-2 pl-3 border-l-2 border-sage/50">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-0.5">
            {partnerName(settings, r.to)} said
          </span>
          {r.reply}
        </p>
      )}

      {replying ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            autoFocus
            placeholder={`Anything to tell ${partnerName(settings, r.from)}? (optional)`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={<Check size={13} />}
              onClick={() => {
                resolveReview(r.id, true, reply.trim());
                setReplying(false);
                setReply('');
              }}
            >
              Mark reviewed
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {!done && mine && (
            <Button
              size="sm"
              variant="soft"
              icon={<Check size={13} />}
              onClick={() => {
                setReply(r.reply);
                setReplying(true);
              }}
            >
              Mark reviewed
            </Button>
          )}
          {done && (
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={13} />}
              onClick={() => resolveReview(r.id, false)}
            >
              Reopen
            </Button>
          )}
          {onOpen && (
            <Button size="sm" variant="ghost" onClick={onOpen}>
              Open
            </Button>
          )}
          <span className="flex-1" />
          {sentByMe && !done && (
            <IconButton aria-label="Edit call-out" onClick={() => setEditing(true)}>
              <Pencil size={13} />
            </IconButton>
          )}
          {sentByMe && (
            <IconButton
              tone="danger"
              aria-label="Delete call-out"
              onClick={() => removeReviewRequest(r.id)}
            >
              <Trash2 size={13} />
            </IconButton>
          )}
        </div>
      )}

      <ReviewDialog open={editing} onClose={() => setEditing(false)} existing={r} title={r.title} />
    </div>
  );
}
