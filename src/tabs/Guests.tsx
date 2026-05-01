import { useMemo, useState } from 'react';
import { Plus, Trash2, Search, UserPlus, Download } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select, LabeledField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EditableText } from '../components/ui/EditableText';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import type { Guest, GuestGroup, GuestSide, GuestStatus } from '../types';
import { cn, downloadJson } from '../utils';

const FILTERS = ['All', 'Yes', 'Waiting', 'No'] as const;
const GROUPS: GuestGroup[] = [
  'Couple Friends',
  'Bride Family',
  'Groom Family',
  'Bride Friends',
  'Groom Friends',
  'Work',
  'Other',
];

export function Guests() {
  const { guests, addGuest, updateGuest, removeGuest } = useShallowStore((s) => ({
    guests: s.guests,
    addGuest: s.addGuest,
    updateGuest: s.updateGuest,
    removeGuest: s.removeGuest,
  }));

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => {
    const total = guests.reduce((s, g) => s + (Number(g.qty) || 1), 0);
    const yes = guests.filter((g) => g.status === 'Yes').reduce((s, g) => s + (g.qty || 1), 0);
    const waiting = guests
      .filter((g) => g.status === 'Waiting')
      .reduce((s, g) => s + (g.qty || 1), 0);
    const no = guests.filter((g) => g.status === 'No').reduce((s, g) => s + (g.qty || 1), 0);
    return { total, yes, waiting, no };
  }, [guests]);

  const filtered = guests.filter((g) => {
    if (filter !== 'All' && g.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !g.name.toLowerCase().includes(q) &&
        !g.group.toLowerCase().includes(q) &&
        !g.notes.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const exportCsv = () => {
    const rows = [
      ['Name', 'Group', 'Side', 'Party Size', 'RSVP', 'Meal', 'Table', 'Notes'],
      ...guests.map((g) => [
        g.name,
        g.group,
        g.side,
        String(g.qty),
        g.status,
        g.meal,
        g.table,
        g.notes,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guests.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Invited" value={stats.total} />
        <StatCard label="Confirmed" value={stats.yes} tone="sage" />
        <StatCard label="Awaiting" value={stats.waiting} tone="warning" />
        <StatCard label="Declined" value={stats.no} tone="rose" />
      </div>

      <Card
        title="Guest List"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCsv}>
              CSV
            </Button>
            <Button icon={<UserPlus size={14} />} size="sm" onClick={() => setAdding(true)}>
              Add Guest
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search guests, groups, notes…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-bg p-1 rounded-full">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                  filter === f
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-ink'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={22} />}
            title="No guests in this view"
            description="Try clearing the filter, or add your first guest."
            action={<Button onClick={() => setAdding(true)}>Add Guest</Button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Group</th>
                  <th className="px-2 py-2">Side</th>
                  <th className="px-2 py-2 text-center">Party</th>
                  <th className="px-2 py-2">RSVP</th>
                  <th className="px-2 py-2">Meal</th>
                  <th className="px-2 py-2">Table</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((g) => (
                  <GuestRow
                    key={g.id}
                    guest={g}
                    onUpdate={(patch) => updateGuest(g.id, patch)}
                    onDelete={async () => {
                      if (
                        await confirmAction({
                          title: 'Remove guest?',
                          message: g.name ? `Remove ${g.name} from your guest list?` : 'Remove this guest?',
                          confirmLabel: 'Remove',
                          variant: 'danger',
                        })
                      ) {
                        removeGuest(g.id);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddGuestModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(g) => {
          addGuest(g);
          setAdding(false);
        }}
      />
    </div>
  );
}

function GuestRow({
  guest,
  onUpdate,
  onDelete,
}: {
  guest: Guest;
  onUpdate: (patch: Partial<Guest>) => void;
  onDelete: () => void;
}) {
  const statusColor =
    guest.status === 'Yes' ? 'text-success' : guest.status === 'No' ? 'text-danger' : 'text-warning';
  return (
    <tr className="hover:bg-bg/40">
      <td className="px-2 py-1.5 min-w-[160px]">
        <EditableText
          value={guest.name}
          onChange={(v) => onUpdate({ name: v })}
          placeholder="Guest name"
          className="font-medium"
        />
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={guest.group}
          onChange={(e) => onUpdate({ group: e.target.value as GuestGroup })}
          className="text-xs"
        >
          {GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={guest.side}
          onChange={(e) => onUpdate({ side: e.target.value as GuestSide })}
          className="text-xs"
        >
          <option>Both</option>
          <option>Bride</option>
          <option>Groom</option>
        </Select>
      </td>
      <td className="px-2 py-1.5 text-center">
        <Input
          type="number"
          min={1}
          max={20}
          value={guest.qty || 1}
          onChange={(e) => onUpdate({ qty: Number(e.target.value) || 1 })}
          className="w-16 text-center"
        />
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={guest.status}
          onChange={(e) => onUpdate({ status: e.target.value as GuestStatus })}
          className={cn('text-xs font-semibold', statusColor)}
        >
          <option>Waiting</option>
          <option>Yes</option>
          <option>No</option>
        </Select>
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={guest.meal}
          onChange={(e) => onUpdate({ meal: e.target.value })}
          className="text-xs"
        >
          <option value="">—</option>
          <option>Chicken</option>
          <option>Beef</option>
          <option>Fish</option>
          <option>Vegetarian</option>
          <option>Vegan</option>
          <option>Kids</option>
        </Select>
      </td>
      <td className="px-2 py-1.5">
        <EditableText
          value={guest.table || ''}
          onChange={(v) => onUpdate({ table: v })}
          placeholder="—"
          className="w-20 text-xs"
        />
      </td>
      <td className="px-2 py-1.5">
        <EditableText
          value={guest.notes || ''}
          onChange={(v) => onUpdate({ notes: v })}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <IconButton tone="danger" onClick={onDelete} aria-label="Remove guest">
          <Trash2 size={14} />
        </IconButton>
      </td>
    </tr>
  );
}

function AddGuestModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (g: Partial<Guest>) => void;
}) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<GuestGroup>('Couple Friends');
  const [side, setSide] = useState<GuestSide>('Both');
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<GuestStatus>('Waiting');

  const reset = () => {
    setName('');
    setGroup('Couple Friends');
    setSide('Both');
    setQty(1);
    setStatus('Waiting');
  };

  const submit = () => {
    onAdd({ name, group, side, qty, status });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add Guest"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit}>Add Guest</Button>
        </>
      }
    >
      <div className="space-y-3">
        <LabeledField label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoFocus
          />
        </LabeledField>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="Group">
            <Select value={group} onChange={(e) => setGroup(e.target.value as GuestGroup)}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </LabeledField>
          <LabeledField label="Side">
            <Select value={side} onChange={(e) => setSide(e.target.value as GuestSide)}>
              <option>Both</option>
              <option>Bride</option>
              <option>Groom</option>
            </Select>
          </LabeledField>
          <LabeledField label="Party Size">
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
            />
          </LabeledField>
          <LabeledField label="RSVP">
            <Select value={status} onChange={(e) => setStatus(e.target.value as GuestStatus)}>
              <option>Waiting</option>
              <option>Yes</option>
              <option>No</option>
            </Select>
          </LabeledField>
        </div>
      </div>
    </Modal>
  );
}

void downloadJson; // re-export keeper
