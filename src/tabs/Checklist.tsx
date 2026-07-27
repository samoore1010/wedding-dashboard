import { useState } from 'react';
import { Plus, Trash2, ChevronDown, FolderPlus, StickyNote, Link2, CalendarDays } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn, pct } from '../utils';
import { ItemDetail } from './checklist/ItemDetail';
import type { ChecklistItem } from '../types';

export function Checklist() {
  const {
    checklistItems,
    checklist,
    toggleCheck,
    addCheckItem,
    updateCheckItem,
    removeCheckItem,
    addPhase,
    removePhase,
  } = useShallowStore((s) => ({
    checklistItems: s.checklistItems,
    checklist: s.checklist,
    toggleCheck: s.toggleCheck,
    addCheckItem: s.addCheckItem,
    updateCheckItem: s.updateCheckItem,
    removeCheckItem: s.removeCheckItem,
    addPhase: s.addPhase,
    removePhase: s.removePhase,
  }));

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(checklistItems).map((k) => [k, true]))
  );
  const [phaseDialog, setPhaseDialog] = useState(false);
  const [phaseName, setPhaseName] = useState('');
  /** Which task has its own page open, if any. */
  const [openItem, setOpenItem] = useState<{ phase: string; id: string } | null>(null);

  const detail = openItem
    ? (checklistItems[openItem.phase] ?? []).find((it) => it.id === openItem.id)
    : undefined;

  if (openItem && detail) {
    return (
      <ItemDetail
        phase={openItem.phase}
        item={detail}
        done={!!checklist[detail.id]}
        onBack={() => setOpenItem(null)}
        onToggle={(v) => toggleCheck(detail.id, v)}
        onSave={(patch) => updateCheckItem(openItem.phase, detail.id, patch)}
        onDelete={() => {
          removeCheckItem(openItem.phase, detail.id);
          setOpenItem(null);
        }}
      />
    );
  }

  let total = 0;
  let done = 0;
  Object.values(checklistItems).forEach((arr) =>
    arr.forEach((it) => {
      total++;
      if (checklist[it.id]) done++;
    })
  );

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h2 className="font-display text-2xl text-primary">Planning Checklist</h2>
          <span className="text-sm font-semibold text-sage">
            {done} / {total} complete ({pct(done, total)}%)
          </span>
        </div>
        <ProgressBar value={pct(done, total)} gradient height="lg" />
      </Card>

      {Object.entries(checklistItems).map(([phase, items]) => {
        const phDone = items.filter((it) => checklist[it.id]).length;
        const phP = pct(phDone, items.length);
        const isOpen = open[phase] !== false;

        return (
          <div
            key={phase}
            className="bg-surface border border-border rounded-xl2 shadow-soft overflow-hidden"
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-br from-primary to-primary-soft text-white"
              onClick={() => setOpen({ ...open, [phase]: !isOpen })}
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={16}
                  className={cn('transition-transform', !isOpen && '-rotate-90')}
                />
                <h3 className="text-sm font-semibold">{phase}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs opacity-90">
                <span>
                  {phDone} / {items.length}
                </span>
                <span className="bg-white/20 rounded-full px-2 py-0.5">{phP}%</span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      await confirmAction({
                        title: 'Delete phase?',
                        message: `Remove "${phase}" and all its tasks?`,
                        confirmLabel: 'Delete',
                        variant: 'danger',
                      })
                    ) {
                      removePhase(phase);
                    }
                  }}
                  className="hover:text-white text-white/70 p-1"
                  aria-label={`Delete phase ${phase}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </button>

            {isOpen && (
              <div className="p-3">
                <div>
                  {items.map((it) => {
                    const checked = !!checklist[it.id];
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg/60 transition-colors',
                          checked && 'opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleCheck(it.id, e.target.checked)}
                          className="h-4 w-4 accent-sage cursor-pointer flex-shrink-0"
                        />
                        <button
                          onClick={() => setOpenItem({ phase, id: it.id })}
                          className="flex-1 min-w-0 text-left group/task"
                        >
                          <span
                            className={cn(
                              'text-sm text-ink group-hover/task:text-accent transition-colors',
                              checked && 'line-through text-muted',
                              !it.text && 'text-muted/70'
                            )}
                          >
                            {it.text || 'Untitled task'}
                          </span>
                          <ItemMarkers item={it} />
                        </button>
                        <IconButton
                          tone="danger"
                          onClick={() => removeCheckItem(phase, it.id)}
                          aria-label="Delete task"
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    );
                  })}
                </div>
                <AddTaskRow onAdd={(t) => addCheckItem(phase, t)} />
              </div>
            )}
          </div>
        );
      })}

      <div className="text-center">
        <Button
          icon={<FolderPlus size={14} />}
          variant="outline"
          onClick={() => setPhaseDialog(true)}
        >
          Add New Phase
        </Button>
      </div>

      <Modal
        open={phaseDialog}
        onClose={() => {
          setPhaseDialog(false);
          setPhaseName('');
        }}
        title="Add Phase"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPhaseDialog(false);
                setPhaseName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (phaseName.trim()) {
                  addPhase(phaseName.trim());
                  setOpen((o) => ({ ...o, [phaseName.trim()]: true }));
                }
                setPhaseDialog(false);
                setPhaseName('');
              }}
            >
              Add Phase
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          placeholder='e.g. "2 Weeks Out"'
          value={phaseName}
          onChange={(e) => setPhaseName(e.target.value)}
        />
      </Modal>
    </div>
  );
}

/** Small hints that a task has detail worth opening. */
function ItemMarkers({ item }: { item: ChecklistItem }) {
  const links = item.links?.length ?? 0;
  const hasNotes = !!item.notes?.trim();
  if (!hasNotes && !links && !item.due) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-2 align-middle text-[10px] text-muted">
      {item.due && (
        <span className="inline-flex items-center gap-0.5">
          <CalendarDays size={10} /> {item.due}
        </span>
      )}
      {hasNotes && <StickyNote size={10} aria-label="Has notes" />}
      {links > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <Link2 size={10} /> {links}
        </span>
      )}
    </span>
  );
}

function AddTaskRow({ onAdd }: { onAdd: (text: string) => void }) {
  const [val, setVal] = useState('');
  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal('');
  };
  return (
    <div className="flex gap-2 mt-2 pt-2 border-t border-border/40">
      <Input
        placeholder="+ Add a task…"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <Button variant="outline" icon={<Plus size={14} />} onClick={submit}>
        Add
      </Button>
    </div>
  );
}
