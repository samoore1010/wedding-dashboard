import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Search,
  UserPlus,
  Download,
  Upload,
  SlidersHorizontal,
  X,
  Plus,
  ChevronDown,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import type { Household, Member, GuestGroup, GuestSide, GuestStatus, GuestList, MemberKind } from '../types';
import { cn, householdSize, repliedCount, suggestLabel } from '../utils';
import { exportGuestsCsv } from '../guests/csv';
import { exportGuestsPdf, type PdfGroup } from '../guests/pdf';
import { ImportWizard } from './guests/ImportWizard';

const RSVP_FILTERS = ['All', 'Yes', 'Waiting', 'No'] as const;
const SIDE_FILTERS = ['All', 'Bride', 'Groom'] as const;
const LIST_FILTERS = ['All', 'Invited', 'B-list'] as const;
const GROUP_BYS = ['Side', 'Relationship', 'List', 'None'] as const;
const LISTS: GuestList[] = ['Invited', 'B-list'];
const listBadge: Record<GuestList, string> = {
  Invited: '',
  'B-list': 'bg-warning/15 text-warning',
};
const glist = (h: Household): GuestList => h.list ?? 'Invited';
const GROUPS: GuestGroup[] = [
  'Couple Friends',
  'Bride Family',
  'Groom Family',
  'Bride Friends',
  'Groom Friends',
  'Work',
  'Other',
];
const SIDES: GuestSide[] = ['Bride', 'Groom', 'Both'];
const MEALS = ['', 'Chicken', 'Beef', 'Fish', 'Vegetarian', 'Vegan', 'Kids'];
const RSVPS: GuestStatus[] = ['Yes', 'Waiting', 'No'];

// The Sage Garden palette has no dedicated side colors; map Bride->rose, Groom->sage.
const sideText: Record<GuestSide, string> = { Bride: 'text-rose', Groom: 'text-sage', Both: 'text-primary' };
const sideBg: Record<GuestSide, string> = {
  Bride: 'bg-rose/15 text-rose',
  Groom: 'bg-sage/20 text-sage',
  Both: 'bg-primary/10 text-primary',
};
const sideRail: Record<GuestSide, string> = { Bride: 'bg-rose', Groom: 'bg-sage', Both: 'bg-primary-soft' };
const rsvpDot: Record<GuestStatus, string> = { Yes: 'bg-success', No: 'bg-danger', Waiting: 'bg-warning' };

export function Guests() {
  const { settings, households, addHousehold, updateHousehold, removeHousehold, addMember, updateMember, removeMember } =
    useShallowStore((s) => ({
      settings: s.settings,
      households: s.households,
      addHousehold: s.addHousehold,
      updateHousehold: s.updateHousehold,
      removeHousehold: s.removeHousehold,
      addMember: s.addMember,
      updateMember: s.updateMember,
      removeMember: s.removeMember,
    }));

  const [rsvp, setRsvp] = useState<(typeof RSVP_FILTERS)[number]>('All');
  const [side, setSide] = useState<(typeof SIDE_FILTERS)[number]>('All');
  const [list, setList] = useState<(typeof LIST_FILTERS)[number]>('All');
  const [groupBy, setGroupBy] = useState<(typeof GROUP_BYS)[number]>('Side');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const activeFilters = (rsvp !== 'All' ? 1 : 0) + (side !== 'All' ? 1 : 0) + (list !== 'All' ? 1 : 0);
  const resetFilters = () => {
    setRsvp('All');
    setSide('All');
    setList('All');
  };

  const openHousehold = households.find((h) => h.id === openId) || null;

  // All five summary counts are derived from the full, unfiltered `households`
  // source array — never the `visible` (searched/filtered/grouped) view — so the
  // widgets always reflect the complete dataset. `households` counts invitations;
  // the other four count people (members). Family + Friends === Guests by design.
  const stats = useMemo(() => {
    const isFamily = (g: GuestGroup) => g === 'Bride Family' || g === 'Groom Family';
    let guests = 0, bList = 0, family = 0;
    for (const h of households) {
      const size = h.members.length; // blank-named members still count
      guests += size;
      if (glist(h) === 'B-list') bList += size;
      if (isFamily(h.group)) family += size;
    }
    return {
      households: households.length,
      guests,
      bList,
      family,
      friends: guests - family, // everyone is Family or Friends, never both
    };
  }, [households]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return households.filter((h) => {
      if (list !== 'All' && glist(h) !== list) return false;
      if (side !== 'All' && h.side !== side && h.side !== 'Both') return false;
      if (rsvp !== 'All' && !h.members.some((m) => m.rsvp === rsvp)) return false;
      if (q) {
        const hay = [
          h.label,
          h.group,
          h.notes,
          h.email,
          ...h.members.flatMap((m) => [m.name, m.email]),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [households, side, rsvp, list, search]);

  const groups = useMemo(() => {
    if (groupBy === 'None') return [{ key: null as string | null, items: visible }];
    if (groupBy === 'Side') {
      return (['Bride', 'Groom', 'Both'] as GuestSide[])
        .map((s) => ({ key: s as string, items: visible.filter((h) => h.side === s) }))
        .filter((g) => g.items.length);
    }
    if (groupBy === 'List') {
      return LISTS.map((l) => ({ key: l as string, items: visible.filter((h) => glist(h) === l) })).filter(
        (g) => g.items.length
      );
    }
    const map = new Map<string, Household[]>();
    for (const h of visible) map.set(h.group, [...(map.get(h.group) || []), h]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, items }));
  }, [visible, groupBy]);

  const openNew = () => {
    const id = addHousehold();
    setOpenId(id);
  };

  const onExportPdf = () => {
    const ok = exportGuestsPdf({
      groups: groups as PdfGroup[],
      groupBy,
      filters: { rsvp, side, list, search },
      stats,
      settings,
    });
    if (!ok) toast.error('Allow pop-ups for this site to export a PDF.');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Households" value={stats.households} hint="invitations" />
        <StatCard label="Guests" value={stats.guests} hint="people total" />
        <StatCard label="Family" value={stats.family} tone="sage" hint="people" />
        <StatCard label="Friends" value={stats.friends} tone="rose" hint="people" />
        <StatCard label="B-list" value={stats.bList} tone="warning" hint="people" />
      </div>

      <Card
        title="Guest List"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="soft" size="sm" icon={<Upload size={14} />} onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <ExportMenu onCsv={() => exportGuestsCsv(households)} onPdf={onExportPdf} />
            <Button icon={<UserPlus size={14} />} size="sm" onClick={openNew}>
              Add Household
            </Button>
          </div>
        }
      >
        {/* Toolbar — search + a single Filters popover + grouping */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search people, emails, households, notes…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterMenu
            rsvp={rsvp}
            side={side}
            list={list}
            onRsvp={setRsvp}
            onSide={setSide}
            onList={setList}
            count={activeFilters}
            onReset={resetFilters}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted font-semibold whitespace-nowrap">Group</span>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as (typeof GROUP_BYS)[number])}
              className="text-xs h-8 py-0 w-auto"
            >
              {GROUP_BYS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Active-filter chips — always show what's applied */}
        {(activeFilters > 0 || search) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {search && (
              <FilterChip label={`“${search}”`} onClear={() => setSearch('')} />
            )}
            {rsvp !== 'All' && <FilterChip label={`RSVP: ${rsvp}`} onClear={() => setRsvp('All')} />}
            {side !== 'All' && <FilterChip label={`Side: ${side}`} onClear={() => setSide('All')} />}
            {list !== 'All' && <FilterChip label={`List: ${list}`} onClear={() => setList('All')} />}
            {activeFilters > 1 && (
              <button onClick={resetFilters} className="text-[11px] font-semibold text-muted hover:text-accent px-1.5">
                Clear all
              </button>
            )}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={22} />}
            title={households.length === 0 ? 'No guests yet' : 'No households in this view'}
            description={
              households.length === 0
                ? 'Add your first household — then add the people in it.'
                : 'Try clearing the filters above.'
            }
            action={
              households.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={<Upload size={15} />} onClick={() => setImportOpen(true)}>
                    Import a spreadsheet
                  </Button>
                  <Button variant="outline" onClick={openNew}>
                    Add manually
                  </Button>
                </div>
              ) : (
                <Button onClick={openNew}>Add Household</Button>
              )
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key ?? 'all'}>
                {g.key !== null && (
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={cn(
                        'text-[11px] font-bold px-2.5 py-0.5 rounded-full',
                        groupBy === 'Side' ? sideBg[g.key as GuestSide] : 'bg-bg text-muted border border-border'
                      )}
                    >
                      {g.key}
                    </span>
                    <span className="text-xs text-muted">
                      {g.items.length} {g.items.length === 1 ? 'household' : 'households'} ·{' '}
                      {g.items.reduce((s, h) => s + householdSize(h), 0)} guests
                    </span>
                    <span className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className="space-y-2.5">
                  {g.items.map((h) => (
                    <HouseholdCard
                      key={h.id}
                      household={h}
                      onOpen={() => setOpenId(h.id)}
                      onPromote={() => updateHousehold(h.id, { list: 'Invited' })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EditDrawer
        household={openHousehold}
        onClose={() => setOpenId(null)}
        onUpdateHousehold={(patch) => openHousehold && updateHousehold(openHousehold.id, patch)}
        onAddMember={() => openHousehold && addMember(openHousehold.id)}
        onUpdateMember={(mid, patch) => openHousehold && updateMember(openHousehold.id, mid, patch)}
        onRemoveMember={(mid) => openHousehold && removeMember(openHousehold.id, mid)}
        onDelete={async () => {
          if (!openHousehold) return;
          const name = openHousehold.label || suggestLabel(openHousehold.members) || 'this household';
          if (
            await confirmAction({
              title: 'Remove household?',
              message: `Remove ${name} and everyone in it from your guest list?`,
              confirmLabel: 'Remove',
              variant: 'danger',
            })
          ) {
            removeHousehold(openHousehold.id);
            setOpenId(null);
          }
        }}
      />

      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

/* -------------------------------- Export menu ------------------------------ */

function ExportMenu({ onCsv, onPdf }: { onCsv: () => void; onPdf: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        icon={<Download size={14} />}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 rounded-xl2 border border-border bg-surface shadow-lift p-1.5"
        >
          <ExportItem
            icon={<FileSpreadsheet size={16} />}
            title="Download CSV"
            subtitle="Full spreadsheet — every guest, all fields"
            onClick={() => choose(onCsv)}
          />
          <ExportItem
            icon={<FileText size={16} />}
            title="Download PDF"
            subtitle="Printable — matches your current view"
            onClick={() => choose(onPdf)}
          />
        </div>
      )}
    </div>
  );
}

function ExportItem({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-bg transition-colors"
    >
      <span className="mt-0.5 text-accent shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-[11px] text-muted leading-snug">{subtitle}</span>
      </span>
    </button>
  );
}

/* -------------------------------- Filter menu ------------------------------ */

function FilterMenu({
  rsvp,
  side,
  list,
  onRsvp,
  onSide,
  onList,
  count,
  onReset,
}: {
  rsvp: (typeof RSVP_FILTERS)[number];
  side: (typeof SIDE_FILTERS)[number];
  list: (typeof LIST_FILTERS)[number];
  onRsvp: (v: (typeof RSVP_FILTERS)[number]) => void;
  onSide: (v: (typeof SIDE_FILTERS)[number]) => void;
  onList: (v: (typeof LIST_FILTERS)[number]) => void;
  count: number;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors',
          count > 0 ? 'border-accent/50 bg-accent/8 text-accent' : 'border-border text-ink hover:bg-bg'
        )}
      >
        <SlidersHorizontal size={14} />
        Filters
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold tabular-nums">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl2 border border-border bg-surface shadow-lift p-4 space-y-4">
          <FilterGroup label="RSVP" options={RSVP_FILTERS} value={rsvp} onChange={onRsvp} />
          <FilterGroup label="Side" options={SIDE_FILTERS} value={side} onChange={onSide} tone="side" />
          <FilterGroup label="List" options={LIST_FILTERS} value={list} onChange={onList} />
          {count > 0 && (
            <button onClick={onReset} className="w-full text-center text-xs font-semibold text-muted hover:text-accent pt-1">
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = 'default',
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'default' | 'side';
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{label}</div>
      <Segmented options={options} value={value} onChange={onChange} tone={tone} />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bg border border-border pl-2.5 pr-1 py-0.5 text-[11px] font-semibold text-ink">
      {label}
      <button onClick={onClear} className="grid place-items-center w-4 h-4 rounded-full text-muted hover:text-danger hover:bg-danger/10" aria-label={`Clear ${label}`}>
        <X size={11} />
      </button>
    </span>
  );
}

/* -------------------------------- Segmented -------------------------------- */

function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'default',
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'default' | 'side';
}) {
  return (
    <div className="flex flex-wrap gap-1 bg-bg p-1 rounded-2xl">
      {options.map((o) => {
        const active = value === o;
        const activeCls =
          tone === 'side' && o === 'Bride'
            ? 'bg-rose text-white'
            : tone === 'side' && o === 'Groom'
            ? 'bg-sage text-white'
            : 'bg-primary text-white';
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
              active ? activeCls : 'text-muted hover:text-ink'
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Household card ----------------------------- */

function HouseholdCard({
  household: h,
  onOpen,
  onPromote,
}: {
  household: Household;
  onOpen: () => void;
  onPromote: () => void;
}) {
  const size = householdSize(h);
  const replied = repliedCount(h);
  const allReplied = replied === size;
  const label = h.label.trim() || suggestLabel(h.members) || 'Untitled household';
  const l = glist(h);
  const notInvited = l !== 'Invited';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex gap-3.5 rounded-xl2 border border-border bg-surface p-3.5 cursor-pointer transition-all hover:border-accent/60 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className={cn('w-1 rounded-full shrink-0', sideRail[h.side])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-lg text-ink leading-tight">{label}</span>
          <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', sideBg[h.side])}>
            {h.side}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg border border-border text-muted">
            {h.group}
          </span>
          {notInvited && (
            <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', listBadge[l])}>
              {l}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {h.members.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-bg border border-border text-xs"
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', rsvpDot[m.rsvp])} />
              <span className="font-medium text-ink">{m.name || 'Unnamed'}</span>
              {m.kind === 'child' && (
                <span className="text-[9px] font-bold uppercase text-accent bg-accent/15 px-1 rounded">kid</span>
              )}
              {m.meal && <span className="text-muted">· {m.meal}</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end justify-center gap-1 text-right shrink-0">
        {notInvited ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPromote();
            }}
            className="text-xs font-semibold text-accent hover:text-primary border border-accent/40 rounded-full px-2.5 py-0.5"
          >
            Invite →
          </button>
        ) : (
          <span className={cn('text-xs font-semibold', allReplied ? 'text-success' : 'text-warning')}>
            {replied} of {size} replied
          </span>
        )}
        <span className="text-[11px] text-muted tabular-nums">
          {size} {size === 1 ? 'seat' : 'seats'}
        </span>
        {h.table && (
          <span className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">{h.table}</span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Edit drawer ------------------------------ */

function EditDrawer({
  household: h,
  onClose,
  onUpdateHousehold,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  onDelete,
}: {
  household: Household | null;
  onClose: () => void;
  onUpdateHousehold: (patch: Partial<Household>) => void;
  onAddMember: () => void;
  onUpdateMember: (memberId: string, patch: Partial<Member>) => void;
  onRemoveMember: (memberId: string) => void;
  onDelete: () => void;
}) {
  const open = !!h;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />
      <aside
        aria-hidden={!open}
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[440px] max-w-[94vw] bg-surface border-l border-border shadow-lift flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {h && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-ink">Edit household</h3>
              <IconButton onClick={onClose} aria-label="Close">
                <X size={16} />
              </IconButton>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Household fields */}
              <section>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">Household</div>
                <div className="space-y-3">
                  <Labeled label="Household label">
                    <Input
                      value={h.label}
                      onChange={(e) => onUpdateHousehold({ label: e.target.value })}
                      placeholder={suggestLabel(h.members) || 'e.g. The Smith Family'}
                    />
                  </Labeled>
                  <Labeled label="Guest list">
                    <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden">
                      {LISTS.map((l) => (
                        <button
                          key={l}
                          onClick={() => onUpdateHousehold({ list: l })}
                          className={cn(
                            'h-9 text-[11px] font-semibold transition-colors',
                            glist(h) === l
                              ? l === 'Invited'
                                ? 'bg-primary text-white'
                                : 'bg-warning text-white'
                              : 'bg-surface text-muted hover:text-ink'
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </Labeled>
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Side">
                      <Select
                        value={h.side}
                        onChange={(e) => onUpdateHousehold({ side: e.target.value as GuestSide })}
                      >
                        {SIDES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </Select>
                    </Labeled>
                    <Labeled label="Relationship">
                      <Select
                        value={h.group}
                        onChange={(e) => onUpdateHousehold({ group: e.target.value as GuestGroup })}
                      >
                        {GROUPS.map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </Select>
                    </Labeled>
                    <Labeled label="Household email">
                      <Input
                        type="email"
                        value={h.email}
                        onChange={(e) => onUpdateHousehold({ email: e.target.value })}
                        placeholder="name@email.com"
                      />
                    </Labeled>
                    <Labeled label="Invitation">
                      <Select
                        value={h.inviteSent ? 'Sent' : 'Not sent'}
                        onChange={(e) => onUpdateHousehold({ inviteSent: e.target.value === 'Sent' })}
                      >
                        <option>Not sent</option>
                        <option>Sent</option>
                      </Select>
                    </Labeled>
                  </div>
                  <Labeled label="Notes">
                    <Input
                      value={h.notes}
                      onChange={(e) => onUpdateHousehold({ notes: e.target.value })}
                      placeholder="Anything to remember…"
                    />
                  </Labeled>
                </div>
              </section>

              {/* Members */}
              <section>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">
                  People · {h.members.length}
                </div>
                <div className="space-y-2.5">
                  {h.members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      canDelete={h.members.length > 1}
                      onChange={(patch) => onUpdateMember(m.id, patch)}
                      onRemove={() => onRemoveMember(m.id)}
                    />
                  ))}
                </div>
                <button
                  onClick={onAddMember}
                  className="mt-2.5 w-full border border-dashed border-border rounded-xl2 py-2.5 text-xs font-semibold text-primary hover:border-accent hover:bg-accent/5 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add person
                </button>
              </section>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border">
              <Button variant="ghost" className="text-danger" icon={<Trash2 size={14} />} onClick={onDelete}>
                Delete
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function MemberRow({
  member: m,
  canDelete,
  onChange,
  onRemove,
}: {
  member: Member;
  canDelete: boolean;
  onChange: (patch: Partial<Member>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-xl2 p-3 bg-bg/50 space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={m.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Full name"
          className="flex-1 h-8 py-0"
        />
        <KindToggle value={m.kind} onChange={(kind) => onChange({ kind })} />
        {canDelete && (
          <IconButton tone="danger" onClick={onRemove} aria-label={`Remove ${m.name || 'person'}`}>
            <Trash2 size={13} />
          </IconButton>
        )}
      </div>
      <RsvpToggle value={m.rsvp} onChange={(rsvp) => onChange({ rsvp })} />
      <div className="grid grid-cols-2 gap-2">
        <Select value={m.meal} onChange={(e) => onChange({ meal: e.target.value })} className="text-xs h-8 py-0">
          {MEALS.map((o) => (
            <option key={o} value={o}>
              {o || '— meal —'}
            </option>
          ))}
        </Select>
        <Input
          value={m.dietary}
          onChange={(e) => onChange({ dietary: e.target.value })}
          placeholder="Dietary notes"
          className="text-xs h-8 py-0"
        />
      </div>
      <Input
        type="email"
        value={m.email}
        onChange={(e) => onChange({ email: e.target.value })}
        placeholder={`Email${m.name ? ` for ${m.name.split(/\s+/)[0]}` : ''}`}
        className="text-xs h-8 py-0"
      />
    </div>
  );
}

function KindToggle({ value, onChange }: { value: MemberKind; onChange: (v: MemberKind) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden shrink-0">
      {(['adult', 'child'] as MemberKind[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            'px-2.5 h-8 text-[11px] font-semibold capitalize transition-colors',
            value === k ? 'bg-primary text-white' : 'bg-surface text-muted hover:text-ink'
          )}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function RsvpToggle({ value, onChange }: { value: GuestStatus; onChange: (v: GuestStatus) => void }) {
  const active: Record<GuestStatus, string> = {
    Yes: 'bg-success text-white',
    Waiting: 'bg-warning text-white',
    No: 'bg-danger text-white',
  };
  return (
    <div className="grid grid-cols-3 rounded-lg border border-border overflow-hidden">
      {RSVPS.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'h-8 text-[11px] font-semibold transition-colors',
            value === r ? active[r] : 'bg-surface text-muted hover:text-ink'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
