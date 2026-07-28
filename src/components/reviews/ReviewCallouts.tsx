import { useState } from 'react';
import { Plus, UserCheck } from 'lucide-react';
import { useShallowStore } from '../../store';
import { useViewer } from '../../viewer';
import { focusTarget } from '../../navigation';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ReviewDialog } from './ReviewDialog';
import { ReviewRow } from './ReviewRow';
import { ViewerPicker } from './ViewerPicker';
import {
  openFor,
  openFrom,
  otherPartner,
  partnerName,
  recentlyDone,
  targetTab,
} from '../../reviews';
import { cn } from '../../utils';
import type { ReviewRequest, TabId } from '../../types';

type Lane = 'inbox' | 'sent' | 'done';

/**
 * The couple's hand-off list, front and centre on the overview.
 *
 * They plan in parallel, so this answers the two questions that come out of
 * that: what is my partner waiting on me to look at, and what have I asked
 * them for that hasn't come back yet.
 */
export function ReviewCallouts({ onJump }: { onJump: (tab: TabId) => void }) {
  const { settings, reviewRequests } = useShallowStore((s) => ({
    settings: s.settings,
    reviewRequests: s.reviewRequests,
  }));
  const viewer = useViewer((s) => s.viewer);

  const [lane, setLane] = useState<Lane>('inbox');
  const [composing, setComposing] = useState(false);

  const them = viewer ? partnerName(settings, otherPartner(viewer)) : 'them';

  // Until someone says who they are, every open call-out goes in one list —
  // the widget still works, it just can't say which are yours.
  const allOpen = reviewRequests
    .filter((r) => r.status === 'open')
    .sort((a, b) => a.createdAt - b.createdAt);

  const inbox = viewer ? openFor(reviewRequests, viewer) : allOpen;
  const sent = viewer ? openFrom(reviewRequests, viewer) : [];
  const done = viewer
    ? recentlyDone(reviewRequests, viewer).slice(0, 10)
    : reviewRequests.filter((r) => r.status === 'done').sort((a, b) => b.resolvedAt - a.resolvedAt).slice(0, 10);

  const shown: ReviewRequest[] = lane === 'inbox' ? inbox : lane === 'sent' ? sent : done;

  const open = (r: ReviewRequest) => {
    if (r.target.kind === 'none') return;
    focusTarget(r.target);
    onJump(targetTab(r.target));
  };

  const lanes: { id: Lane; label: string; count: number }[] = [
    { id: 'inbox', label: viewer ? 'For you' : 'Open', count: inbox.length },
    { id: 'sent', label: `Waiting on ${them}`, count: sent.length },
    { id: 'done', label: 'Reviewed', count: done.length },
  ];

  return (
    <Card
      title="Review Call-Outs"
      action={
        <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setComposing(true)}>
          New call-out
        </Button>
      }
    >
      {!viewer && (
        <ViewerPicker
          hint="So the dashboard can tell you what's waiting on you, not just what's waiting."
          className="mb-4 pb-4 border-b border-border"
        />
      )}

      <div className="flex gap-1 mb-3 flex-wrap">
        {lanes
          .filter((l) => viewer || l.id !== 'sent')
          .map((l) => (
            <button
              key={l.id}
              onClick={() => setLane(l.id)}
              className={cn(
                'px-2.5 h-7 rounded-full text-xs font-semibold transition-colors border',
                lane === l.id
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'border-transparent text-muted hover:text-ink hover:bg-bg'
              )}
            >
              {l.label}
              {l.count > 0 && <span className="ml-1 opacity-70">{l.count}</span>}
            </button>
          ))}
      </div>

      <div className="space-y-2 max-h-[19rem] overflow-y-auto pr-0.5">
        {shown.length ? (
          shown.map((r) => (
            <ReviewRow
              key={r.id}
              request={r}
              compact
              onOpen={r.target.kind === 'none' ? undefined : () => open(r)}
            />
          ))
        ) : (
          <EmptyLane lane={lane} them={them} onCompose={() => setComposing(true)} />
        )}
      </div>

      <ReviewDialog open={composing} onClose={() => setComposing(false)} />
    </Card>
  );
}

function EmptyLane({
  lane,
  them,
  onCompose,
}: {
  lane: Lane;
  them: string;
  onCompose: () => void;
}) {
  const copy =
    lane === 'inbox'
      ? { title: 'Nothing to review', body: "You're all caught up." }
      : lane === 'sent'
      ? { title: `Nothing with ${them}`, body: `Anything you hand to ${them} shows up here until they've looked.` }
      : { title: 'Nothing reviewed yet', body: 'Answered call-outs collect here.' };

  return (
    <div className="text-center py-8 px-4">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-bg text-muted mb-2">
        <UserCheck size={18} />
      </div>
      <div className="font-display text-lg text-primary">{copy.title}</div>
      <p className="text-xs text-muted max-w-xs mx-auto mt-0.5">{copy.body}</p>
      {lane !== 'done' && (
        <button onClick={onCompose} className="text-xs font-semibold text-accent hover:underline mt-3">
          Ask for a review →
        </button>
      )}
    </div>
  );
}
