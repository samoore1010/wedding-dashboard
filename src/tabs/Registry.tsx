import { useState } from 'react';
import { Plus, Trash2, ChevronDown, FolderPlus } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EditableText } from '../components/ui/EditableText';
import { Badge } from '../components/ui/Badge';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';

export function Registry() {
  const {
    registryCats,
    registryChecked,
    addRegCat,
    removeRegCat,
    addRegItem,
    updateRegItem,
    removeRegItem,
    toggleRegChecked,
  } = useShallowStore((s) => ({
    registryCats: s.registryCats,
    registryChecked: s.registryChecked,
    addRegCat: s.addRegCat,
    removeRegCat: s.removeRegCat,
    addRegItem: s.addRegItem,
    updateRegItem: s.updateRegItem,
    removeRegItem: s.removeRegItem,
    toggleRegChecked: s.toggleRegChecked,
  }));

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [newCat, setNewCat] = useState('');
  const [showCatDialog, setShowCatDialog] = useState(false);

  const totalItems = Object.values(registryCats).reduce((s, items) => s + items.length, 0);
  const purchased = Object.values(registryChecked).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Items" value={totalItems} />
        <StatCard label="Purchased" value={purchased} tone="sage" />
        <StatCard label="Still Needed" value={Math.max(0, totalItems - purchased)} tone="accent" />
      </div>

      <Card
        title="Registry Checklist"
        action={
          <Button icon={<FolderPlus size={14} />} size="sm" onClick={() => setShowCatDialog(true)}>
            Add Category
          </Button>
        }
      >
        <div className="space-y-2">
          {Object.entries(registryCats).map(([cat, items]) => {
            const done = items.filter((it) => registryChecked[it.id]).length;
            const isOpen = open[cat] === true;
            return (
              <div key={cat} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-bg/50 px-3 py-2">
                  <button
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => setOpen((o) => ({ ...o, [cat]: !isOpen }))}
                  >
                    <ChevronDown
                      size={14}
                      className={cn('transition-transform text-muted', !isOpen && '-rotate-90')}
                    />
                    <span className="text-sm font-semibold">{cat}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={done === items.length && items.length > 0 ? 'yes' : 'pending'}
                    >
                      {done}/{items.length}
                    </Badge>
                    <IconButton
                      tone="danger"
                      onClick={async () => {
                        if (
                          await confirmAction({
                            title: 'Remove category?',
                            message: `Remove "${cat}" and ${items.length} item(s)?`,
                            confirmLabel: 'Remove',
                            variant: 'danger',
                          })
                        ) {
                          removeRegCat(cat);
                        }
                      }}
                      aria-label="Remove category"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
                {isOpen && (
                  <div className="px-3 py-2 space-y-1">
                    {items.map((it) => {
                      const checked = !!registryChecked[it.id];
                      return (
                        <div
                          key={it.id}
                          className="flex items-center gap-2 px-1 py-1 rounded hover:bg-bg/60"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleRegChecked(it.id, e.target.checked)}
                            className="h-4 w-4 accent-sage cursor-pointer flex-shrink-0"
                          />
                          <div
                            className={cn(
                              'flex-1',
                              checked && 'line-through text-muted'
                            )}
                          >
                            <EditableText
                              value={it.text}
                              onChange={(v) => updateRegItem(cat, it.id, { text: v })}
                              placeholder="Item"
                              className="text-sm"
                            />
                          </div>
                          <IconButton
                            tone="danger"
                            onClick={() => removeRegItem(cat, it.id)}
                            aria-label="Remove item"
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </div>
                      );
                    })}
                    <AddItemRow onAdd={(t) => addRegItem(cat, t)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        open={showCatDialog}
        onClose={() => {
          setShowCatDialog(false);
          setNewCat('');
        }}
        title="Add Category"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowCatDialog(false);
                setNewCat('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newCat.trim()) {
                  addRegCat(newCat.trim());
                  setOpen((o) => ({ ...o, [newCat.trim()]: true }));
                }
                setShowCatDialog(false);
                setNewCat('');
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="e.g. Outdoor Gear"
        />
      </Modal>
    </div>
  );
}

function AddItemRow({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState('');
  const submit = () => {
    if (!v.trim()) return;
    onAdd(v.trim());
    setV('');
  };
  return (
    <div className="flex gap-2 mt-1 pt-1 border-t border-border/40">
      <Input
        placeholder="+ Add item"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="text-sm"
      />
      <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={submit}>
        Add
      </Button>
    </div>
  );
}
