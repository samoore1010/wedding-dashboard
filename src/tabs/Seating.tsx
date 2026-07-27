import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import {
  Plus,
  Trash2,
  Crown,
  Heart,
  Users,
  Search,
  MoreHorizontal,
  X,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { useShallowStore } from '../store';
import { Button } from '../components/ui/Button';
import { Input, LabeledField, Select } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import type { GuestGroup, GuestSide, Household, SeatingTable } from '../types';

/** Best display name for a household: explicit label, else member names. */
const householdName = (h: Household) =>
  h.label.trim() ||
  h.members.map((m) => m.name).filter(Boolean).join(', ') ||
  'Unnamed';

const isNamed = (h: Household) =>
  !!(h.label.trim() || h.members.some((m) => m.name.trim()));

/**
 * Seats a household actually needs. Anyone who has declined is not getting a
 * chair, so they are excluded from every count on this page — otherwise the
 * "yet to seat" figure is a target you can never reach.
 */
const seatsNeeded = (h: Household) => h.members.filter((m) => m.rsvp !== 'No').length;
const declinedIn = (h: Household) => h.members.filter((m) => m.rsvp === 'No').length;
/** Still waiting on at least one reply from the people we'd seat. */
const isWaiting = (h: Household) => h.members.some((m) => m.rsvp === 'Waiting');

const capacityOf = (t: SeatingTable) => t.capacity ?? (t.type === 'sweetheart' ? 2 : 8);

const GROUP_ORDER: GuestGroup[] = [
  'Bride Family',
  'Groom Family',
  'Bride Friends',
  'Groom Friends',
  'Couple Friends',
  'Work',
  'Other',
];

const SIDE_LABEL: Record<GuestSide, string> = {
  Bride: "Bride's side",
  Groom: "Groom's side",
  Both: 'Both sides',
};

// Matches the Guests tab: the palette has no dedicated side colours, so
// Bride -> rose, Groom -> sage, Both -> the soft primary.
const sideRail: Record<GuestSide, string> = {
  Bride: 'bg-rose',
  Groom: 'bg-sage',
  Both: 'bg-primary-soft',
};

type GroupBy = 'group' | 'side' | 'none';
type ReplyFilter = 'All' | 'Confirmed' | 'Waiting';

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'group', label: 'Relationship' },
  { value: 'side', label: 'Side' },
  { value: 'none', label: 'Flat' },
];

/** What is being dragged, and whether it came from the rail or off a table. */
type Drag = { ids: string[]; from: 'rail' | 'table' };

/** True when the pointer has left an element for good, not just crossed a child. */
const leftForGood = (e: DragEvent<HTMLElement>) =>
  !e.currentTarget.contains(e.relatedTarget as Node | null);

export function Seating() {
  const { seating, households, addTable, updateTable, removeTable, setGuestTable } = useShallowStore(
    (s) => ({
      seating: s.seating,
      households: s.households,
      addTable: s.addTable,
      updateTable: s.updateTable,
      removeTable: s.removeTable,
      setGuestTable: s.setGuestTable,
    })
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('group');
  const [reply, setReply] = useState<ReplyFilter>('All');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hideEmpty, setHideEmpty] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [railDragOver, setRailDragOver] = useState(false);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);

  const guestById = useMemo(() => new Map(households.map((h) => [h.id, h])), [households]);

  const seatedIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of seating) for (const id of t.guestIds ?? []) set.add(id);
    return set;
  }, [seating]);

  /**
   * Everyone this page is responsible for: named, invited (or already seated,
   * so a B-list household someone seated by hand still counts), and with at
   * least one person who hasn't declined.
   */
  const roster = useMemo(
    () =>
      households.filter(
        (h) =>
          isNamed(h) &&
          seatsNeeded(h) > 0 &&
          ((h.list ?? 'Invited') === 'Invited' || seatedIds.has(h.id))
      ),
    [households, seatedIds]
  );

  const totals = useMemo(() => {
    let attending = 0;
    let seated = 0;
    for (const h of roster) {
      const n = seatsNeeded(h);
      attending += n;
      if (seatedIds.has(h.id)) seated += n;
    }
    const declined = households
      .filter((h) => isNamed(h) && (h.list ?? 'Invited') === 'Invited')
      .reduce((s, h) => s + declinedIn(h), 0);
    return { attending, seated, declined, left: Math.max(0, attending - seated) };
  }, [roster, seatedIds, households]);

  const seatsAtTable = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of seating) {
      let n = 0;
      for (const id of t.guestIds ?? []) {
        const h = guestById.get(id);
        if (h) n += seatsNeeded(h);
      }
      map.set(t.id, n);
    }
    return map;
  }, [seating, guestById]);

  const overCapacity = seating.filter((t) => (seatsAtTable.get(t.id) ?? 0) > capacityOf(t)).length;
  const withRoom = seating.filter((t) => (seatsAtTable.get(t.id) ?? 0) < capacityOf(t)).length;

  const unseated = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster
      .filter((h) => !seatedIds.has(h.id))
      .filter((h) => !q || householdName(h).toLowerCase().includes(q))
      .filter((h) =>
        reply === 'All' ? true : reply === 'Waiting' ? isWaiting(h) : !isWaiting(h)
      );
  }, [roster, seatedIds, search, reply]);

  /** Unseated households bucketed into the collapsible sections in the rail. */
  const buckets = useMemo(() => {
    if (groupBy === 'none') return [{ label: 'All households', rows: unseated }];
    const key = (h: Household) =>
      groupBy === 'side' ? SIDE_LABEL[h.side] ?? 'Both sides' : h.group;
    const map = new Map<string, Household[]>();
    for (const h of unseated) {
      const k = key(h);
      const list = map.get(k);
      if (list) list.push(h);
      else map.set(k, [h]);
    }
    const rank = (label: string) => {
      if (groupBy === 'side') {
        return [SIDE_LABEL.Bride, SIDE_LABEL.Groom, SIDE_LABEL.Both].indexOf(label);
      }
      const i = GROUP_ORDER.indexOf(label as GuestGroup);
      return i === -1 ? GROUP_ORDER.length : i;
    };
    return [...map.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([label, rows]) => ({ label, rows }));
  }, [unseated, groupBy]);

  /** Rows currently rendered in the rail, in order — the range for shift-click. */
  const visibleIds = useMemo(
    () =>
      buckets.flatMap((b) => (collapsed[b.label] ? [] : b.rows.map((h) => h.id))),
    [buckets, collapsed]
  );

  const selectedSeats = selected.reduce(
    (s, id) => s + (guestById.get(id) ? seatsNeeded(guestById.get(id)!) : 0),
    0
  );

  const clearSelection = () => {
    setSelected([]);
    setLastClicked(null);
  };

  const toggleRow = (
    id: string,
    mods: { shift: boolean; meta: boolean }
  ) => {
    if (mods.shift && lastClicked) {
      const a = visibleIds.indexOf(lastClicked);
      const b = visibleIds.indexOf(id);
      if (a !== -1 && b !== -1) {
        setSelected(visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1));
        return;
      }
    }
    if (mods.meta) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      setLastClicked(id);
      return;
    }
    setSelected((prev) => (prev.length === 1 && prev[0] === id ? [] : [id]));
    setLastClicked(id);
  };

  const seatAt = (tableId: string, ids: string[]) => {
    if (!ids.length) return;
    for (const id of ids) setGuestTable(id, tableId);
    clearSelection();
  };

  const unseat = (ids: string[]) => {
    for (const id of ids) setGuestTable(id, null);
    clearSelection();
  };

  const startDrag = (e: DragEvent<HTMLElement>, ids: string[], from: Drag['from']) => {
    e.dataTransfer.setData('text/plain', ids.join(','));
    e.dataTransfer.effectAllowed = 'move';
    setDrag({ ids, from });
  };

  const settingsTable = seating.find((t) => t.id === settingsFor) ?? null;
  const armed = selected.length > 0;
  const visibleTables = hideEmpty
    ? seating.filter((t) => (seatsAtTable.get(t.id) ?? 0) > 0)
    : seating;

  return (
    <div className="space-y-4" onDragEnd={() => setDrag(null)}>
      <SummaryStrip
        seated={totals.seated}
        attending={totals.attending}
        declined={totals.declined}
        tables={seating.length}
        overCapacity={overCapacity}
        onAddTable={() => addTable()}
      />

      <div className="grid gap-4 lg:grid-cols-[288px_minmax(0,1fr)] items-start">
        {/* ---- Rail: everyone still waiting for a chair -------------------- */}
        <div
          onDragOver={(e) => {
            if (drag?.from === 'table') {
              e.preventDefault();
              setRailDragOver(true);
            }
          }}
          onDragLeave={(e) => leftForGood(e) && setRailDragOver(false)}
          onDrop={() => {
            if (drag?.from === 'table') unseat(drag.ids);
            setDrag(null);
            setRailDragOver(false);
          }}
          className={cn(
            'bg-surface border rounded-xl2 shadow-soft flex flex-col overflow-hidden transition-colors',
            // Capped on every screen so the tables are always within reach —
            // stacked on mobile, pinned beside the canvas from lg up.
            'max-h-[65vh] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]',
            railDragOver ? 'border-accent ring-4 ring-accent/20' : 'border-border'
          )}
        >
          <div className="p-3 border-b border-border space-y-2.5 shrink-0">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-xl text-primary leading-none">To seat</h2>
              <span className="text-xs text-muted tabular-nums">
                {unseated.length} · {unseated.reduce((s, h) => s + seatsNeeded(h), 0)} seats
              </span>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <Input
                placeholder="Search households…"
                aria-label="Search households to seat"
                className="pl-8 h-8 py-0 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Segmented
              label="Group households by"
              options={GROUP_BY_OPTIONS}
              value={groupBy}
              onChange={(v) => {
                setGroupBy(v);
                setCollapsed({});
              }}
            />

            <div className="flex gap-1.5">
              {(['All', 'Confirmed', 'Waiting'] as ReplyFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReply(r)}
                  aria-pressed={reply === r}
                  className={cn(
                    'flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    reply === r
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted hover:text-ink hover:bg-bg'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 min-h-[120px]">
            {roster.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-8 px-3 text-center text-xs text-muted">
                <Users size={14} /> No guests yet — add some in the Guests tab.
              </p>
            ) : unseated.length === 0 ? (
              <p className="py-8 px-3 text-center text-xs text-muted">
                {search || reply !== 'All' ? 'No matches.' : 'Everyone is seated 🎉'}
              </p>
            ) : (
              buckets.map(({ label, rows }) => {
                const open = !collapsed[label];
                const seats = rows.reduce((s, h) => s + seatsNeeded(h), 0);
                return (
                  <div key={label}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}
                      className={cn(
                        'w-full flex items-center gap-1.5 px-1.5 pt-2.5 pb-1 rounded text-left',
                        'text-[10px] font-bold uppercase tracking-[0.09em] text-muted',
                        'hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
                      )}
                    >
                      <ChevronDown
                        size={11}
                        className={cn('transition-transform shrink-0', !open && '-rotate-90')}
                      />
                      <span className="truncate">{label}</span>
                      <span className="ml-auto font-medium normal-case tracking-normal tabular-nums">
                        {rows.length} · {seats}
                      </span>
                    </button>

                    {open &&
                      rows.map((h) => (
                        <RailRow
                          key={h.id}
                          household={h}
                          selected={selected.includes(h.id)}
                          dragging={drag?.from === 'rail' && drag.ids.includes(h.id)}
                          onSelect={(mods) => toggleRow(h.id, mods)}
                          onDragStart={(e) =>
                            startDrag(
                              e,
                              selected.includes(h.id) ? selected : [h.id],
                              'rail'
                            )
                          }
                        />
                      ))}
                  </div>
                );
              })
            )}
          </div>

          <div
            className={cn(
              'shrink-0 border-t border-border px-3 py-2 flex items-center gap-2 min-h-[44px]',
              armed && 'bg-accent/5'
            )}
          >
            {armed ? (
              <>
                <span className="flex-1 min-w-0 text-xs leading-tight">
                  <strong className="tabular-nums">{selected.length}</strong> selected ·{' '}
                  <strong className="tabular-nums">{selectedSeats}</strong> seats
                  <span className="block text-muted">Pick a table to seat them</span>
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted">
                {railDragOver ? 'Drop to unseat' : 'Select a household, then click a table.'}
              </span>
            )}
          </div>
        </div>

        {/* ---- Canvas: the tables ----------------------------------------- */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap px-0.5">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
                className="accent-accent"
              />
              Hide empty tables
            </label>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {seating.length} table{seating.length === 1 ? '' : 's'} · {withRoom} with room
            </span>
          </div>

          {seating.length === 0 ? (
            <div className="bg-surface border border-dashed border-border rounded-xl2 py-12 text-center">
              <p className="text-sm text-muted mb-3">No tables yet.</p>
              <Button icon={<Plus size={14} />} size="sm" onClick={() => addTable()}>
                Add your first table
              </Button>
            </div>
          ) : (
            // A grid, not masonry. Cards vary in height so rows are a little
            // ragged, but tables stay in the order they were created — you look
            // a table up by name, and column-major order breaks that.
            <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(190px,1fr))] items-start">
              {visibleTables.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  seats={seatsAtTable.get(t.id) ?? 0}
                  guests={(t.guestIds ?? [])
                    .map((id) => guestById.get(id))
                    .filter((h): h is Household => !!h)}
                  armed={armed}
                  incoming={selectedSeats}
                  dragActive={drag !== null}
                  onSeat={() => seatAt(t.id, selected)}
                  onDropGuests={() => {
                    if (drag) seatAt(t.id, drag.ids);
                    setDrag(null);
                  }}
                  onDragStartGuest={(e, id) => startDrag(e, [id], 'table')}
                  onUnseat={(id) => setGuestTable(id, null)}
                  onOpenSettings={() => setSettingsFor(t.id)}
                />
              ))}

              <button
                type="button"
                onClick={() => addTable()}
                className={cn(
                  'min-h-[92px] rounded-xl2 border border-dashed border-border text-muted text-sm',
                  'flex items-center justify-center gap-1.5 transition-colors',
                  'hover:border-accent hover:text-accent',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
                )}
              >
                <Plus size={14} /> Add table
              </button>
            </div>
          )}

          {hideEmpty && visibleTables.length < seating.length && (
            <p className="text-xs text-muted px-0.5">
              {seating.length - visibleTables.length} empty table
              {seating.length - visibleTables.length === 1 ? '' : 's'} hidden.
            </p>
          )}
        </div>
      </div>

      {settingsTable && (
        <TableSettings
          table={settingsTable}
          seats={seatsAtTable.get(settingsTable.id) ?? 0}
          onClose={() => setSettingsFor(null)}
          onChange={(patch) => updateTable(settingsTable.id, patch)}
          onDelete={async () => {
            if (
              await confirmAction({
                title: 'Remove table?',
                message: `Delete ${settingsTable.name}? Anyone seated there goes back to the "to seat" list.`,
                confirmLabel: 'Delete',
                variant: 'danger',
              })
            ) {
              removeTable(settingsTable.id);
              setSettingsFor(null);
            }
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** One line of progress in place of the old three stat cards. */
function SummaryStrip({
  seated,
  attending,
  declined,
  tables,
  overCapacity,
  onAddTable,
}: {
  seated: number;
  attending: number;
  declined: number;
  tables: number;
  overCapacity: number;
  onAddTable: () => void;
}) {
  const pct = attending > 0 ? Math.round((seated / attending) * 100) : 0;

  return (
    <div className="bg-surface border border-border rounded-xl2 shadow-soft p-4 flex items-center gap-x-6 gap-y-3 flex-wrap">
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="font-display text-3xl text-primary leading-none">{seated}</span>
        <span className="text-xs text-muted">
          of {attending} attending seated
        </span>
      </div>

      <div className="flex-1 min-w-[180px] space-y-1.5">
        <div className="h-[7px] rounded-full bg-bg overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-sm bg-accent" aria-hidden /> Seated {seated}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-sm bg-bg border border-border" aria-hidden /> To seat{' '}
            {Math.max(0, attending - seated)}
          </span>
          {declined > 0 && <span>Declined {declined}, not counted</span>}
          <span>
            {tables} table{tables === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {overCapacity > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 text-danger px-3 py-1 text-xs font-semibold tabular-nums">
          <AlertTriangle size={13} /> {overCapacity} over capacity
        </span>
      )}

      <Button icon={<Plus size={14} />} size="sm" onClick={onAddTable}>
        Add Table
      </Button>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 bg-bg rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            value === o.value
              ? 'bg-surface text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RailRow({
  household,
  selected,
  dragging,
  onSelect,
  onDragStart,
}: {
  household: Household;
  selected: boolean;
  dragging: boolean;
  onSelect: (mods: { shift: boolean; meta: boolean }) => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
}) {
  const name = householdName(household);
  const seats = seatsNeeded(household);
  const names = household.members.map((m) => m.name).filter(Boolean);

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={(e) => onSelect({ shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect({ shift: e.shiftKey, meta: e.metaKey || e.ctrlKey });
        }
      }}
      aria-pressed={selected}
      title={names.length > 1 ? names.join(', ') : undefined}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left text-xs cursor-grab active:cursor-grabbing transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-transparent hover:bg-bg',
        dragging && 'opacity-40'
      )}
    >
      <span
        className={cn('w-[3px] self-stretch rounded-full shrink-0', sideRail[household.side])}
        aria-hidden
      />
      <span className="flex-1 min-w-0 truncate font-medium">{name}</span>
      {isWaiting(household) && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-warning shrink-0"
          title="Waiting on a reply"
          aria-label="Waiting on a reply"
        />
      )}
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums',
          selected ? 'bg-surface text-ink' : 'bg-bg text-muted'
        )}
      >
        {seats}
      </span>
    </button>
  );
}

function TableCard({
  table,
  seats,
  guests,
  armed,
  incoming,
  dragActive,
  onSeat,
  onDropGuests,
  onDragStartGuest,
  onUnseat,
  onOpenSettings,
}: {
  table: SeatingTable;
  seats: number;
  guests: Household[];
  armed: boolean;
  incoming: number;
  dragActive: boolean;
  onSeat: () => void;
  onDropGuests: () => void;
  onDragStartGuest: (e: DragEvent<HTMLElement>, id: string) => void;
  onUnseat: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const [over, setOver] = useState(false);
  const cap = capacityOf(table);
  const pct = cap > 0 ? Math.min(100, Math.round((seats / cap) * 100)) : 0;
  const isOver = seats > cap;
  const tight = !isOver && cap > 0 && seats / cap >= 0.8 && seats > 0;
  const wouldOverflow = armed && seats + incoming > cap;
  const clickable = armed || dragActive;

  const glyph =
    table.type === 'sweetheart' ? (
      <Heart size={12} className="text-accent shrink-0" />
    ) : table.type === 'kings' ? (
      <Crown size={12} className="text-accent shrink-0" />
    ) : null;

  return (
    <div
      role={armed ? 'button' : undefined}
      tabIndex={armed ? 0 : undefined}
      aria-label={armed ? `Seat selection at ${table.name}` : undefined}
      onClick={armed ? onSeat : undefined}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (armed && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSeat();
        }
      }}
      onDragOver={(e) => {
        if (!dragActive) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => leftForGood(e) && setOver(false)}
      onDrop={() => {
        setOver(false);
        onDropGuests();
      }}
      className={cn(
        'group rounded-xl2 border bg-surface p-3 shadow-soft flex flex-col gap-2 transition-all',
        table.type === 'sweetheart'
          ? 'border-accent/60 bg-gradient-to-br from-accent-soft/25 to-surface'
          : table.type === 'kings'
          ? 'border-primary-soft/70'
          : 'border-border',
        clickable && 'cursor-pointer',
        armed && wouldOverflow && 'opacity-60',
        over && 'border-accent ring-4 ring-accent/25',
        armed && 'hover:border-accent hover:ring-4 hover:ring-accent/20',
        'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25'
      )}
    >
      <div className="flex items-center gap-1.5">
        {glyph}
        <h3 className="font-display text-base text-primary leading-tight flex-1 min-w-0 truncate">
          {table.name}
        </h3>
        <IconButton
          className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          aria-label={`Settings for ${table.name}`}
        >
          <MoreHorizontal size={14} />
        </IconButton>
      </div>

      <div className="space-y-1">
        <div className="h-[5px] rounded-full bg-bg overflow-hidden">
          <div
            className={cn(
              'h-full transition-[width] duration-300',
              isOver ? 'bg-danger' : tight ? 'bg-accent' : 'bg-sage'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className={cn(
            'flex justify-between gap-2 text-[10px] tabular-nums',
            isOver ? 'text-danger font-bold' : 'text-muted'
          )}
        >
          <span>
            {seats} of {cap} seats
          </span>
          <span>
            {isOver ? `${seats - cap} over` : seats === cap ? 'full' : `${cap - seats} free`}
          </span>
        </div>
      </div>

      {guests.length === 0 ? (
        <p className="text-[11px] italic text-muted/70">
          {over ? 'Drop here' : armed ? 'Click to seat here' : 'Empty'}
        </p>
      ) : (
        <div className="space-y-px">
          {guests.map((h) => {
            const n = seatsNeeded(h);
            return (
              <div
                key={h.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStartGuest(e, h.id);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] cursor-grab active:cursor-grabbing hover:bg-bg',
                  n === 0 && 'opacity-50'
                )}
                title={h.members.map((m) => m.name).filter(Boolean).join(', ') || undefined}
              >
                <span
                  className={cn('w-[3px] h-3.5 rounded-full shrink-0', sideRail[h.side])}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 truncate">{householdName(h)}</span>
                <span className="text-muted tabular-nums shrink-0">
                  {n === 0 ? 'declined' : n}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnseat(h.id);
                  }}
                  aria-label={`Unseat ${householdName(h)}`}
                  className={cn(
                    'shrink-0 rounded text-muted hover:text-danger transition-opacity',
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
                  )}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TableSettings({
  table,
  seats,
  onClose,
  onChange,
  onDelete,
}: {
  table: SeatingTable;
  seats: number;
  onClose: () => void;
  onChange: (patch: Partial<SeatingTable>) => void;
  onDelete: () => void;
}) {
  const cap = capacityOf(table);

  return (
    <Modal
      open
      onClose={onClose}
      title="Table settings"
      size="sm"
      footer={
        <>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onDelete}>
            Delete table
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <LabeledField label="Name">
          <Input
            value={table.name}
            autoFocus
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Table name"
          />
        </LabeledField>

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="Shape">
            <Select
              value={table.type}
              onChange={(e) => onChange({ type: e.target.value as SeatingTable['type'] })}
            >
              <option value="regular">Regular</option>
              <option value="kings">Kings</option>
              <option value="sweetheart">Sweetheart</option>
            </Select>
          </LabeledField>

          <LabeledField label="Capacity" hint={`${seats} seat${seats === 1 ? '' : 's'} in use`}>
            <Input
              type="number"
              min={1}
              value={cap}
              onChange={(e) => onChange({ capacity: Math.max(1, Number(e.target.value) || 1) })}
            />
          </LabeledField>
        </div>
      </div>
    </Modal>
  );
}
