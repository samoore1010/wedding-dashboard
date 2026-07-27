import { ArrowLeft, Trash2, Plus, X, ExternalLink, CalendarDays, Link2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { EditControls } from '../../components/ui/EditControls';
import { useEditSession } from '../../components/ui/useEditSession';
import { confirmAction } from '../../components/ui/ConfirmDialog';
import type { ChecklistItem, ChecklistLink } from '../../types';
import { cn, uid } from '../../utils';

/** Add https:// when someone types a bare domain, so the link actually opens. */
const href = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

const prettyDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

/**
 * One checklist task on its own page: its name, when it's due, free-form notes
 * and any number of links. Everything here is locked until Edit is pressed —
 * only the done/not-done checkbox stays one click, since that's the whole point
 * of a checklist.
 */
export function ItemDetail({
  phase,
  item,
  done,
  onBack,
  onToggle,
  onSave,
  onDelete,
}: {
  phase: string;
  item: ChecklistItem;
  done: boolean;
  onBack: () => void;
  onToggle: (done: boolean) => void;
  onSave: (patch: Partial<ChecklistItem>) => void;
  onDelete: () => void;
}) {
  const s = useEditSession(item, (next) =>
    onSave({
      text: next.text.trim() || item.text,
      notes: next.notes,
      due: next.due,
      // Drop links that were added but never filled in.
      links: next.links.filter((l) => l.url.trim()),
    })
  );
  const draft = s.shown;

  const setLink = (id: string, patch: Partial<ChecklistLink>) =>
    s.set({ links: draft.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-accent"
        >
          <ArrowLeft size={15} /> Back to checklist
        </button>
        <EditControls session={s} what="this task" />
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-5 w-5 mt-1 accent-sage cursor-pointer shrink-0"
            aria-label="Mark task done"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">{phase}</div>
            {s.editing ? (
              <Input
                value={draft.text}
                onChange={(e) => s.set({ text: e.target.value })}
                placeholder="Task name"
                className="text-lg"
                autoFocus
              />
            ) : (
              <h2
                className={cn(
                  'font-display text-2xl text-primary leading-tight',
                  done && 'line-through text-muted'
                )}
              >
                {item.text || 'Untitled task'}
              </h2>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<CalendarDays size={13} />} title="Due date" />
        {s.editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={draft.due}
              onChange={(e) => s.set({ due: e.target.value })}
              className="max-w-[200px]"
            />
            {draft.due && (
              <Button variant="ghost" size="sm" onClick={() => s.set({ due: '' })}>
                Clear
              </Button>
            )}
          </div>
        ) : (
          <p className={cn('text-sm', item.due ? 'text-ink' : 'text-muted/70')}>
            {item.due ? prettyDate(item.due) : 'No date set'}
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle title="Notes" />
        {s.editing ? (
          <Textarea
            value={draft.notes}
            onChange={(e) => s.set({ notes: e.target.value })}
            rows={8}
            placeholder="Anything worth remembering — decisions, quotes, who you spoke to…"
          />
        ) : item.notes.trim() ? (
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{item.notes}</p>
        ) : (
          <p className="text-sm text-muted/70">No notes yet.</p>
        )}
      </Card>

      <Card>
        <SectionTitle icon={<Link2 size={13} />} title="Links" />
        {s.editing ? (
          <div className="space-y-2">
            {draft.links.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <Input
                  value={l.label}
                  onChange={(e) => setLink(l.id, { label: e.target.value })}
                  placeholder="Label (optional)"
                  className="sm:max-w-[220px]"
                />
                <Input
                  value={l.url}
                  onChange={(e) => setLink(l.id, { url: e.target.value })}
                  placeholder="https://…"
                  className="flex-1"
                />
                <button
                  onClick={() => s.set({ links: draft.links.filter((x) => x.id !== l.id) })}
                  className="shrink-0 p-1.5 text-muted hover:text-danger rounded"
                  aria-label="Remove link"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                s.set({ links: [...draft.links, { id: 'l_' + uid(), label: '', url: '' }] })
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent"
            >
              <Plus size={12} /> Add link
            </button>
          </div>
        ) : item.links.length ? (
          <ul className="space-y-1.5">
            {item.links.map((l) => (
              <li key={l.id}>
                <a
                  href={href(l.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-accent break-all"
                >
                  <ExternalLink size={13} className="shrink-0" />
                  {l.label.trim() || l.url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted/70">No links yet.</p>
        )}
      </Card>

      <div>
        <Button
          variant="ghost"
          className="text-danger"
          icon={<Trash2 size={14} />}
          onClick={async () => {
            if (
              await confirmAction({
                title: 'Delete task?',
                message: `Remove "${item.text}" and everything on this page?`,
                confirmLabel: 'Delete',
                variant: 'danger',
              })
            ) {
              onDelete();
            }
          }}
        >
          Delete task
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
      {icon}
      {title}
    </div>
  );
}
