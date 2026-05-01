import { useState } from 'react';
import { Plus, Trash2, Crown, Heart } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import type { SeatingTable } from '../types';

export function Seating() {
  const {
    seating,
    guests,
    addTable,
    updateTable,
    removeTable,
    addGuestToTable,
    removeGuestFromTable,
    moveGuestBetweenTables,
  } = useShallowStore((s) => ({
    seating: s.seating,
    guests: s.guests,
    addTable: s.addTable,
    updateTable: s.updateTable,
    removeTable: s.removeTable,
    addGuestToTable: s.addGuestToTable,
    removeGuestFromTable: s.removeGuestFromTable,
    moveGuestBetweenTables: s.moveGuestBetweenTables,
  }));

  const seated = seating.reduce((s, t) => s + t.guests.length, 0);
  const totalGuests = guests.reduce((s, g) => s + (g.qty || 1), 0);

  // simple drag state
  const [drag, setDrag] = useState<{ tableId: string; index: number } | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Guests Seated" value={seated} tone="sage" />
        <StatCard label="Tables" value={seating.length} />
        <StatCard
          label="Yet to Seat"
          value={Math.max(0, totalGuests - seated)}
          tone="warning"
          hint={totalGuests ? `of ${totalGuests} on guest list` : undefined}
        />
      </div>

      <Card
        title="Seating Arrangement"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={() => addTable()}>
            Add Table
          </Button>
        }
      >
        <p className="text-xs text-muted mb-4">
          Drag a guest's name to a different table to reseat them.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {seating.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              onRename={(name) => updateTable(t.id, { name })}
              onCapacity={(c) => updateTable(t.id, { capacity: c })}
              onType={(typ) => updateTable(t.id, { type: typ })}
              onDelete={async () => {
                if (
                  await confirmAction({
                    title: 'Remove table?',
                    message: `Delete ${t.name}? Any seated guests will be removed.`,
                    confirmLabel: 'Delete',
                    variant: 'danger',
                  })
                ) {
                  removeTable(t.id);
                }
              }}
              onAddGuest={(name) => addGuestToTable(t.id, name)}
              onRemoveGuest={(idx) => removeGuestFromTable(t.id, idx)}
              dragSource={drag}
              setDrag={setDrag}
              onDropAt={(toIndex) => {
                if (drag) {
                  moveGuestBetweenTables(drag.tableId, t.id, drag.index, toIndex);
                  setDrag(null);
                }
              }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function TableCard({
  table,
  onRename,
  onCapacity,
  onType,
  onDelete,
  onAddGuest,
  onRemoveGuest,
  dragSource,
  setDrag,
  onDropAt,
}: {
  table: SeatingTable;
  onRename: (name: string) => void;
  onCapacity: (n: number) => void;
  onType: (t: SeatingTable['type']) => void;
  onDelete: () => void;
  onAddGuest: (name: string) => void;
  onRemoveGuest: (idx: number) => void;
  dragSource: { tableId: string; index: number } | null;
  setDrag: (s: { tableId: string; index: number } | null) => void;
  onDropAt: (toIndex: number) => void;
}) {
  const [adding, setAdding] = useState('');
  const cap = table.capacity ?? (table.type === 'sweetheart' ? 2 : 8);
  const over = table.guests.length > cap;
  const tableIcon =
    table.type === 'sweetheart' ? <Heart size={14} /> : table.type === 'kings' ? <Crown size={14} /> : null;

  return (
    <div
      className={cn(
        'rounded-xl2 border-2 p-4 bg-surface transition-shadow shadow-soft',
        table.type === 'sweetheart'
          ? 'border-accent bg-gradient-to-br from-accent-soft/30 to-surface'
          : table.type === 'kings'
          ? 'border-primary-soft'
          : 'border-border'
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropAt(table.guests.length)}
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
          className="text-xs h-7 py-0"
        >
          <option value="regular">Regular</option>
          <option value="kings">Kings Table</option>
          <option value="sweetheart">Sweetheart</option>
        </Select>
        <span className="text-muted">Cap.</span>
        <Input
          type="number"
          min={1}
          value={cap}
          onChange={(e) => onCapacity(Number(e.target.value) || 1)}
          className="w-16 h-7 py-0 text-xs text-center"
        />
        <span className={cn('ml-auto text-xs', over ? 'text-danger font-bold' : 'text-muted')}>
          {table.guests.length}/{cap}
        </span>
      </div>

      <div className="space-y-1 min-h-[40px]">
        {table.guests.map((name, gi) => (
          <div
            key={gi}
            draggable
            onDragStart={() => setDrag({ tableId: table.id, index: gi })}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation();
              onDropAt(gi);
            }}
            className={cn(
              'flex items-center justify-between gap-2 px-2 py-1 rounded text-sm bg-bg/60 border border-border/60 cursor-grab active:cursor-grabbing',
              dragSource?.tableId === table.id && dragSource?.index === gi && 'opacity-40'
            )}
          >
            <span className="truncate">{name}</span>
            <IconButton
              tone="danger"
              onClick={() => onRemoveGuest(gi)}
              aria-label="Remove guest"
              className="h-5 w-5"
            >
              <Trash2 size={12} />
            </IconButton>
          </div>
        ))}
        {table.guests.length === 0 && (
          <div className="text-xs text-muted/70 italic px-2 py-2 border border-dashed border-border rounded text-center">
            Drop a guest here
          </div>
        )}
      </div>

      <div className="flex gap-1 mt-2">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="+ Add guest"
          className="text-xs h-7 py-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && adding.trim()) {
              onAddGuest(adding.trim());
              setAdding('');
            }
          }}
        />
      </div>
    </div>
  );
}
