import { useMemo, useState, useEffect } from 'react';
import { Trash2, Search, UserPlus, Download, X, Plus, Users } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import type { Household, Member, GuestGroup, GuestSide, GuestStatus, MemberKind } from '../types';
import { cn, householdSize, repliedCount, suggestLabel } from '../utils';

const RSVP_FILTERS = ['All', 'Yes', 'Waiting', 'No'] as const;
const SIDE_FILTERS = ['All', 'Bride', 'Groom'] as const;
const GROUP_BYS = ['Side', 'Relationship', 'None'] as const;
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
  const { households, addHousehold, updateHousehold, removeHousehold, addMember, updateMember, removeMember } =
    useShallowStore((s) => ({
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
  const [groupBy, setGroupBy] = useState<(typeof GROUP_BYS)[number]>('Side');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const openHousehold = households.find((h) => h.id === openId) || null;

  const stats = useMemo(() => {
    let yes = 0, waiting = 0, no = 0, bride = 0, groom = 0;
    for (const h of households) {
      for (const m of h.members) {
        if (m.rsvp === 'Yes') yes++;
        else if (m.rsvp === 'No') no++;
        else waiting++;
        if (m.rsvp !== 'No') {
          if (h.side === 'Bride') bride++;
          else if (h.side === 'Groom') groom++;
          else { bride += 0.5; groom += 0.5; }
        }
      }
    }
    return { total: yes + waiting + no, yes, waiting, no, bride, groom };
  }, [households]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return households.filter((h) => {
      if (side !== 'All' && h.side !== side && h.side !== 'Both') return false;
      if (rsvp !== 'All' && !h.members.some((m) => m.rsvp === rsvp)) return false;
      if (q) {
        const hay = [h.label, h.group, h.notes, ...h.members.map((m) => m.name)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [households, side, rsvp, search]);

  const groups = useMemo(() => {
    if (groupBy === 'None') return [{ key: null as string | null, items: visible }];
    if (groupBy === 'Side') {
      return (['Bride', 'Groom', 'Both'] as GuestSide[])
        .map((s) => ({ key: s as string, items: visible.filter((h) => h.side === s) }))
        .filter((g) => g.items.length);
    }
    const map = new Map<string, Household[]>();
    for (const h of visible) map.set(h.group, [...(map.get(h.group) || []), h]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, items }));
  }, [visible, groupBy]);

  const openNew = () => {
    const id = addHousehold();
    setOpenId(id);
  };

  const exportCsv = () => {
    const rows = [
      ['Name', 'Household', 'Side', 'Group', 'Adult/Child', 'RSVP', 'Meal', 'Dietary', 'Table', 'Notes'],
      ...households.flatMap((h) =>
        h.members.map((m) => [
          m.name,
          h.label || suggestLabel(h.members),
          h.side,
          h.group,
          m.kind === 'child' ? 'Child' : 'Adult',
          m.rsvp,
          m.meal,
          m.dietary,
          h.table,
          h.notes,
        ])
      ),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guests.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Guests" value={stats.total} hint={`${households.length} households`} />
        <StatCard label="Confirmed" value={stats.yes} tone="sage" />
        <StatCard label="Awaiting" value={stats.waiting} tone="warning" />
        <StatCard label="Declined" value={stats.no} tone="danger" />
        <SideBalance bride={stats.bride} groom={stats.groom} />
      </div>

      <Card
        title="Guest List"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCsv}>
              CSV
            </Button>
            <Button icon={<UserPlus size={14} />} size="sm" onClick={openNew}>
              Add Household
            </Button>
          </div>
        }
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search people, households, notes…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Segmented options={RSVP_FILTERS} value={rsvp} onChange={setRsvp} />
          <Segmented options={SIDE_FILTERS} value={side} onChange={setSide} tone="side" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted font-semibold whitespace-nowrap">Group by</span>
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

        {visible.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={22} />}
            title={households.length === 0 ? 'No guests yet' : 'No households in this view'}
            description={
              households.length === 0
                ? 'Add your first household — then add the people in it.'
                : 'Try clearing the filters above.'
            }
            action={<Button onClick={openNew}>Add Household</Button>}
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
                    <HouseholdCard key={h.id} household={h} onOpen={() => setOpenId(h.id)} />
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
    </div>
  );
}

/* ------------------------------- Side balance ------------------------------ */

function SideBalance({ bride, groom }: { bride: number; groom: number }) {
  const total = bride + groom || 1;
  const bpct = Math.round((bride / total) * 100);
  return (
    <div className="bg-surface border border-border rounded-xl2 p-4 shadow-soft flex flex-col justify-center col-span-2 lg:col-span-1">
      <div className="text-[11px] font-semibold tracking-widest uppercase text-muted mb-2">Side Balance</div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-border">
        <div className="bg-rose" style={{ width: `${bpct}%` }} />
        <div className="bg-sage" style={{ width: `${100 - bpct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] mt-1.5 tabular-nums">
        <span className="text-rose font-semibold">Bride {Math.round(bride)}</span>
        <span className="text-sage font-semibold">{Math.round(groom)} Groom</span>
      </div>
    </div>
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
    <div className="flex gap-1 bg-bg p-1 rounded-full">
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

function HouseholdCard({ household: h, onOpen }: { household: Household; onOpen: () => void }) {
  const size = householdSize(h);
  const replied = repliedCount(h);
  const allReplied = replied === size;
  const label = h.label.trim() || suggestLabel(h.members) || 'Untitled household';

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
        <span className={cn('text-xs font-semibold', allReplied ? 'text-success' : 'text-warning')}>
          {replied} of {size} replied
        </span>
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
                    <Labeled label="Contact email">
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
