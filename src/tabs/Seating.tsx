import { useMemo, useState, type DragEvent } from 'react';
import { Plus, Trash2, Crown, Heart, Users, Search } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import type { Guest, SeatingTable } from '../types';

type DragSource = { guestId: string; from: string | null }; // null = unseated panel

export function Seating() {
  const { seating, guests, addTable, updateTable, removeTable, setGuestTable } = useShallowStore(
    (s) => ({
      seating: s.seating,
      guests: s.guests,
      addTable: s.addTable,
      updateTable: s.updateTable,
      removeTable: s.removeTable,
      setGuestTable: s.setGuestTable,
    })
  );

  const [drag, setDrag] = useState<DragSource | null>(null);
  const [search, setSearch] = useState('');
  const [unseatedDragOver, setUnseatedDragOver] = useState(false);

  const guestById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);

  const seatedIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of seating) for (const id of t.guestIds ?? []) set.add(id);
    return set;
  }, [seating]);

  const unseatedGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests
      .filter((g) => g.name && !seatedIds.has(g.id))
      .filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [guests, seatedIds, search]);

  const totalPeople = guests.reduce((s, g) => s + (Number(g.qty) || 1), 0);
  const seatedPeople = guests
    .filter((g) => seatedIds.has(g.id))
    .reduce((s, g) => s + (Number(g.qty) || 1), 0);

  const onDragStart = (src: DragSource) => setDrag(src);
  const onDragEnd = () => setDrag(null);

  const dropOnTable = (tableId: string) => {
    if (drag) setGuestTable(drag.guestId, tableId);
    setDrag(null);
  };
  const dropOnUnseated = () => {
    if (drag && drag.from !== null) setGuestTable(drag.guestId, null);
    setDrag(null);
    setUnseatedDragOver(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="People Seated" value={seatedPeople} tone="sage" />
        <StatCard label="Tables" value={seating.length} />
        <StatCard
          label="Yet to Seat"
          value={Math.max(0, totalPeople - seatedPeople)}
          tone="warning"
          hint={totalPeople ? `of ${totalPeople} on guest list` : 'Add guests in the Guests tab'}
        />
      </div>

      {/* Unseated guests pool */}
      <Card
        title="Unseated Guests"
        action={
          <div className="text-xs text-muted">
            {unseatedGuests.length} of{' '}
            {guests.filter((g) => g.name).length} unseated
          </div>
        }
      >
        <p className="text-xs text-muted mb-3">
          Drag a guest to a table below. Each guest takes up{' '}
          <span className="font-semibold">party size</span> seats. Drop back here to unseat.
        </p>

        {guests.filter((g) => g.name).length > 0 && (
          <div className="relative max-w-sm mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search unseated…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (drag?.from !== null) setUnseatedDragOver(true);
          }}
          onDragLeave={() => setUnseatedDragOver(false)}
          onDrop={dropOnUnseated}
          className={cn(
            'min-h-[60px] rounded-lg border-2 border-dashed p-2 transition-colors',
            unseatedDragOver
              ? 'border-accent bg-accent/5'
              : unseatedGuests.length === 0
              ? 'border-border'
              : 'border-transparent'
          )}
        >
          {guests.filter((g) => g.name).length === 0 ? (
            <div className="flex items-center justify-center text-sm text-muted py-4 gap-2">
              <Users size={14} /> No guests yet — add some in the Guests tab.
            </div>
          ) : unseatedGuests.length === 0 ? (
            <div className="text-center text-sm text-muted py-4">
              {search ? 'No matches.' : 'Everyone is seated 🎉'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unseatedGuests.map((g) => (
                <GuestChip
                  key={g.id}
                  guest={g}
                  onDragStart={() => onDragStart({ guestId: g.id, from: null })}
                  onDragEnd={onDragEnd}
                  isDragging={drag?.guestId === g.id}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Tables */}
      <Card
        title="Seating Arrangement"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={() => addTable()}>
            Add Table
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {seating.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              guestById={guestById}
              dragOver={drag !== null}
              onRename={(name) => updateTable(t.id, { name })}
              onCapacity={(c) => updateTable(t.id, { capacity: c })}
              onType={(typ) => updateTable(t.id, { type: typ })}
              onDelete={async () => {
                if (
                  await confirmAction({
                    title: 'Remove table?',
                    message: `Delete ${t.name}? Any seated guests will be returned to the unseated list.`,
                    confirmLabel: 'Delete',
                    variant: 'danger',
                  })
                )
                  removeTable(t.id);
              }}
              onDrop={() => dropOnTable(t.id)}
              onDragStartGuest={(guestId) => onDragStart({ guestId, from: t.id })}
              onDragEndGuest={onDragEnd}
              dragSource={drag}
              onUnseatGuest={(guestId) => setGuestTable(guestId, null)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function GuestChip({
  guest,
  onDragStart,
  onDragEnd,
  isDragging,
  onRemove,
  compact,
}: {
  guest: Guest;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const companions = (guest.companions ?? []).filter(Boolean);
  const partySize = Number(guest.qty) || 1;
  const allNames = [guest.name, ...companions].filter(Boolean);
  const tooltip = allNames.length > 1 ? allNames.join(', ') : undefined;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={tooltip}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs cursor-grab active:cursor-grabbing transition-all',
        compact ? 'border-border' : 'border-border shadow-soft',
        isDragging && 'opacity-40 ring-2 ring-accent/40'
      )}
    >
      <span className="font-medium truncate max-w-[160px]">{guest.name}</span>
      {partySize > 1 && (
        <span className="text-[10px] font-bold tabular-nums bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
          ×{partySize}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-danger opacity-60 group-hover:opacity-100 transition-opacity ml-0.5"
          aria-label={`Unseat ${guest.name}`}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

function TableCard({
  table,
  guestById,
  dragOver,
  onRename,
  onCapacity,
  onType,
  onDelete,
  onDrop,
  onDragStartGuest,
  onDragEndGuest,
  dragSource,
  onUnseatGuest,
}: {
  table: SeatingTable;
  guestById: Map<string, Guest>;
  dragOver: boolean;
  onRename: (n: string) => void;
  onCapacity: (n: number) => void;
  onType: (t: SeatingTable['type']) => void;
  onDelete: () => void;
  onDrop: () => void;
  onDragStartGuest: (guestId: string) => void;
  onDragEndGuest: () => void;
  dragSource: DragSource | null;
  onUnseatGuest: (guestId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const seatedGuests = (table.guestIds ?? [])
    .map((id) => guestById.get(id))
    .filter((g): g is Guest => !!g);
  const cap = table.capacity ?? (table.type === 'sweetheart' ? 2 : 8);
  const peopleCount = seatedGuests.reduce((s, g) => s + (Number(g.qty) || 1), 0);
  const over = peopleCount > cap;
  const tableIcon =
    table.type === 'sweetheart' ? (
      <Heart size={14} />
    ) : table.type === 'kings' ? (
      <Crown size={14} />
    ) : null;

  return (
    <div
      onDragOver={(e) => {
        if (dragOver) {
          e.preventDefault();
          setHovered(true);
        }
      }}
      onDragLeave={() => setHovered(false)}
      onDrop={() => {
        setHovered(false);
        onDrop();
      }}
      className={cn(
        'rounded-xl2 border-2 p-4 bg-surface transition-all shadow-soft',
        table.type === 'sweetheart'
          ? 'border-accent bg-gradient-to-br from-accent-soft/30 to-surface'
          : table.type === 'kings'
          ? 'border-primary-soft'
          : 'border-border',
        hovered && 'ring-4 ring-accent/30 border-accent'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {tableIcon && <span className="text-accent">{tableIcon}</span>}
        <EditableText
          value={table.name}
          onChange={onRename}
          placeholder="Table name"
          className="font-display text-lg text-primary leading-tight flex-1"
        />
        <IconButton tone="danger" onClick={onDelete} aria-label="Delete table">
          <Trash2 size={14} />
        </IconButton>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <Select
          value={table.type}
          onChange={(e) => onType(e.target.value as SeatingTable['type'])}
          className="text-xs h-7 py-0 flex-1"
        >
          <option value="regular">Regular</option>
          <option value="kings">Kings</option>
          <option value="sweetheart">Sweetheart</option>
        </Select>
        <span className="text-muted whitespace-nowrap">Cap.</span>
        <Input
          type="number"
          min={1}
          value={cap}
          onChange={(e) => onCapacity(Number(e.target.value) || 1)}
          className="w-14 h-7 py-0 text-xs text-center"
        />
        <span
          className={cn(
            'text-xs whitespace-nowrap tabular-nums',
            over ? 'text-danger font-bold' : 'text-muted'
          )}
        >
          {peopleCount}/{cap}
        </span>
      </div>

      <div className="space-y-1 min-h-[48px]">
        {seatedGuests.length === 0 ? (
          <div
            className={cn(
              'text-xs italic px-2 py-3 border border-dashed rounded text-center transition-colors',
              hovered ? 'border-accent text-accent' : 'border-border text-muted/70'
            )}
          >
            {hovered ? 'Drop here' : 'Drag a guest here'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {seatedGuests.map((g) => (
              <GuestChip
                key={g.id}
                guest={g}
                onDragStart={() => onDragStartGuest(g.id)}
                onDragEnd={onDragEndGuest}
                isDragging={dragSource?.guestId === g.id}
                onRemove={() => onUnseatGuest(g.id)}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
