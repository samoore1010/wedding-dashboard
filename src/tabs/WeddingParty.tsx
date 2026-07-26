import { useMemo, useState, useEffect } from 'react';
import { Search, Plus, Trash2, X, Crown, UserPlus, GripVertical } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea, LabeledField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import { PARTY_ROLES, ATTIRE_STATUSES } from '../weddingParty';
import type { PartyAsk, PartyGroup, PartyMember } from '../types';

type PoolPerson = { householdId: string; memberId: string; name: string; side: string; contact: string };
type Drag = { kind: 'pool'; person: PoolPerson } | { kind: 'member'; id: string } | null;

const ASK_DOT: Record<PartyAsk, string> = {
  'Not yet': 'bg-border',
  Asked: 'bg-warning',
  Confirmed: 'bg-success',
  Declined: 'bg-danger',
};
const ASK_OPTIONS: PartyAsk[] = ['Not yet', 'Asked', 'Confirmed', 'Declined'];

export function WeddingParty() {
  const s = useShallowStore((st) => ({
    households: st.households,
    party: st.weddingParty,
    addPartyGroup: st.addPartyGroup,
    updatePartyGroup: st.updatePartyGroup,
    removePartyGroup: st.removePartyGroup,
    addPartyMember: st.addPartyMember,
    updatePartyMember: st.updatePartyMember,
    removePartyMember: st.removePartyMember,
    movePartyMember: st.movePartyMember,
  }));

  const { households, party } = s;
  const [search, setSearch] = useState('');
  const [drag, setDrag] = useState<Drag>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [assignPerson, setAssignPerson] = useState<PoolPerson | null>(null);
  const [addToGroup, setAddToGroup] = useState<string | null>(null);

  const liveName = (m: PartyMember) => {
    if (m.memberId) {
      const h = households.find((x) => x.id === m.householdId);
      const mem = h?.members.find((x) => x.id === m.memberId);
      if (mem?.name) return mem.name;
    }
    return m.name;
  };

  const assignedMemberIds = useMemo(
    () => new Set(party.members.filter((m) => m.memberId).map((m) => m.memberId)),
    [party.members]
  );

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return households
      .flatMap((h) =>
        h.members
          .filter((m) => m.name.trim())
          .map((m) => ({
            householdId: h.id,
            memberId: m.id,
            name: m.name,
            side: h.side,
            // Their own details first, falling back to the household's.
            contact: m.emails[0] || m.phones[0] || h.emails[0] || h.phones[0] || '',
          }))
      )
      .filter((p) => !assignedMemberIds.has(p.memberId))
      .filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [households, assignedMemberIds, search]);

  const stats = useMemo(() => {
    const m = party.members;
    return {
      total: m.length,
      confirmed: m.filter((x) => x.ask === 'Confirmed').length,
      toAsk: m.filter((x) => x.ask === 'Not yet').length,
      groups: party.groups.length,
    };
  }, [party]);

  const openMember = party.members.find((m) => m.id === openId) || null;

  const addFromPool = (groupId: string, p: PoolPerson) =>
    s.addPartyMember(groupId, {
      householdId: p.householdId,
      memberId: p.memberId,
      name: p.name,
      contact: p.contact,
    });

  const dropOnGroup = (groupId: string, beforeId?: string) => {
    if (!drag) return;
    if (drag.kind === 'pool') addFromPool(groupId, drag.person);
    else s.movePartyMember(drag.id, groupId, beforeId ?? null);
    setDrag(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="In the Party" value={stats.total} icon={<Crown size={16} />} />
        <StatCard label="Confirmed" value={stats.confirmed} tone="sage" />
        <StatCard label="Still to Ask" value={stats.toAsk} tone="warning" />
        <StatCard label="Groups" value={stats.groups} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,260px)_1fr] gap-5 items-start">
        {/* Guest pool */}
        <Card className="lg:sticky lg:top-6" title="Available Guests">
          <p className="text-xs text-muted mb-3">
            Drag a guest into a group, or tap <Plus size={11} className="inline" /> to assign.
          </p>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search guests…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {pool.length === 0 ? (
            <p className="text-xs text-muted italic py-4 text-center">
              {search ? 'No matches.' : 'Everyone is assigned, or add guests in the Guests tab.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto -mr-1 pr-1">
              {pool.map((p) => (
                <div
                  key={p.memberId}
                  draggable
                  onDragStart={() => setDrag({ kind: 'pool', person: p })}
                  onDragEnd={() => setDrag(null)}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:border-accent/50"
                >
                  <GripVertical size={13} className="text-muted/50 shrink-0" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-[9px] font-bold uppercase text-muted">{p.side}</span>
                  <button
                    onClick={() => setAssignPerson(p)}
                    className="text-muted hover:text-accent p-0.5 rounded"
                    aria-label={`Assign ${p.name}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Groups */}
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {party.groups.map((g) => (
              <GroupColumn
                key={g.id}
                group={g}
                members={party.members.filter((m) => m.groupId === g.id)}
                liveName={liveName}
                dragActive={drag !== null}
                draggingId={drag?.kind === 'member' ? drag.id : null}
                onRename={(v) => s.updatePartyGroup(g.id, { label: v })}
                onDelete={async () => {
                  if (
                    await confirmAction({
                      title: 'Delete group?',
                      message: `Remove "${g.label || 'this group'}"? Its members return to the guest pool.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                    })
                  )
                    s.removePartyGroup(g.id);
                }}
                onOpen={setOpenId}
                onDragStartMember={(id) => setDrag({ kind: 'member', id })}
                onDragEnd={() => setDrag(null)}
                onDropGroup={() => dropOnGroup(g.id)}
                onDropBefore={(beforeId) => dropOnGroup(g.id, beforeId)}
                onAdd={() => setAddToGroup(g.id)}
              />
            ))}
          </div>
          <button
            onClick={() => s.addPartyGroup()}
            className="w-full border border-dashed border-border rounded-xl2 py-3 text-sm font-semibold text-primary hover:border-accent hover:bg-accent/5 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Plus size={15} /> Add group
          </button>
        </div>
      </div>

      {/* Assign-from-pool: pick a group */}
      <Modal open={!!assignPerson} onClose={() => setAssignPerson(null)} title={`Add ${assignPerson?.name ?? ''} to…`}>
        <div className="flex flex-col gap-2">
          {party.groups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                if (assignPerson) addFromPool(g.id, assignPerson);
                setAssignPerson(null);
              }}
              className="text-left px-3 py-2.5 rounded-lg border border-border hover:border-accent hover:bg-accent/5 text-sm font-medium"
            >
              {g.label || 'Untitled group'}
            </button>
          ))}
        </div>
      </Modal>

      {/* Add-to-group: pick a guest (or add manually) */}
      <AddMemberModal
        open={addToGroup !== null}
        group={party.groups.find((g) => g.id === addToGroup) || null}
        pool={pool}
        onClose={() => setAddToGroup(null)}
        onAddGuest={(p) => addToGroup && addFromPool(addToGroup, p)}
        onAddManual={(name) => addToGroup && s.addPartyMember(addToGroup, { name })}
      />

      {/* Detail drawer */}
      <MemberDrawer
        member={openMember}
        displayName={openMember ? liveName(openMember) : ''}
        groups={party.groups}
        onClose={() => setOpenId(null)}
        onChange={(patch) => openMember && s.updatePartyMember(openMember.id, patch)}
        onDelete={async () => {
          if (!openMember) return;
          if (
            await confirmAction({
              title: 'Remove from party?',
              message: `Remove ${liveName(openMember) || 'this person'} from the wedding party?`,
              confirmLabel: 'Remove',
              variant: 'danger',
            })
          ) {
            s.removePartyMember(openMember.id);
            setOpenId(null);
          }
        }}
      />
    </div>
  );
}

/* ------------------------------ Group column ----------------------------- */

function GroupColumn({
  group,
  members,
  liveName,
  dragActive,
  draggingId,
  onRename,
  onDelete,
  onOpen,
  onDragStartMember,
  onDragEnd,
  onDropGroup,
  onDropBefore,
  onAdd,
}: {
  group: PartyGroup;
  members: PartyMember[];
  liveName: (m: PartyMember) => string;
  dragActive: boolean;
  draggingId: string | null;
  onRename: (v: string) => void;
  onDelete: () => void;
  onOpen: (id: string) => void;
  onDragStartMember: (id: string) => void;
  onDragEnd: () => void;
  onDropGroup: () => void;
  onDropBefore: (beforeId: string) => void;
  onAdd: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (dragActive) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false);
        onDropGroup();
      }}
      className={cn(
        'rounded-xl2 border bg-surface p-3.5 shadow-soft transition-colors flex flex-col',
        over ? 'border-accent ring-2 ring-accent/25' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <EditableText
          value={group.label}
          onChange={onRename}
          placeholder="Group name"
          className="font-display text-lg text-primary leading-tight flex-1"
        />
        <span className="text-[11px] text-muted tabular-nums">{members.length}</span>
        <IconButton tone="danger" onClick={onDelete} aria-label="Delete group">
          <Trash2 size={14} />
        </IconButton>
      </div>

      <div className="space-y-1.5 min-h-[60px]">
        {members.length === 0 ? (
          <div
            className={cn(
              'text-xs italic px-2 py-4 border border-dashed rounded-lg text-center transition-colors',
              over ? 'border-accent text-accent' : 'border-border text-muted/70'
            )}
          >
            {over ? 'Drop here' : 'Drag guests here'}
          </div>
        ) : (
          members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              name={liveName(m)}
              dragging={draggingId === m.id}
              onOpen={() => onOpen(m.id)}
              onDragStart={() => onDragStartMember(m.id)}
              onDragEnd={onDragEnd}
              onDropBefore={() => dragActive && onDropBefore(m.id)}
              dragActive={dragActive}
            />
          ))
        )}
      </div>

      <button
        onClick={onAdd}
        className="mt-2.5 border border-dashed border-border rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:border-accent hover:bg-accent/5 transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <UserPlus size={13} /> Add member
      </button>
    </div>
  );
}

function MemberCard({
  member: m,
  name,
  dragging,
  dragActive,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  member: PartyMember;
  name: string;
  dragging: boolean;
  dragActive: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => dragActive && e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        onDropBefore();
      }}
      onClick={onOpen}
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-2 cursor-pointer hover:border-accent/50 transition-colors',
        dragging && 'opacity-40'
      )}
    >
      <GripVertical size={13} className="text-muted/40 shrink-0 cursor-grab" />
      <span className={cn('w-2 h-2 rounded-full shrink-0', ASK_DOT[m.ask])} title={m.ask} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{name || 'Unnamed'}</div>
        {m.role && <div className="text-[11px] text-accent font-semibold truncate">{m.role}</div>}
      </div>
      {m.thankYou && <span className="text-[9px] font-bold uppercase text-success">TY ✓</span>}
    </div>
  );
}

/* ---------------------------- Add member modal --------------------------- */

function AddMemberModal({
  open,
  group,
  pool,
  onClose,
  onAddGuest,
  onAddManual,
}: {
  open: boolean;
  group: PartyGroup | null;
  pool: PoolPerson[];
  onClose: () => void;
  onAddGuest: (p: PoolPerson) => void;
  onAddManual: (name: string) => void;
}) {
  const [q, setQ] = useState('');
  const [manual, setManual] = useState('');
  useEffect(() => {
    if (open) {
      setQ('');
      setManual('');
    }
  }, [open]);
  const filtered = pool.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal open={open} onClose={onClose} title={`Add to ${group?.label || 'group'}`}>
      <div className="space-y-3">
        <Input placeholder="Search guests…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted italic py-3 text-center">No unassigned guests match.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.memberId}
                onClick={() => {
                  onAddGuest(p);
                  onClose();
                }}
                className="text-left px-3 py-2 rounded-lg border border-border hover:border-accent hover:bg-accent/5 text-sm flex items-center justify-between"
              >
                <span>{p.name}</span>
                <span className="text-[9px] font-bold uppercase text-muted">{p.side}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border pt-3">
          <LabeledField label="Or add someone not on the guest list">
            <div className="flex gap-2">
              <Input
                placeholder="Full name"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manual.trim()) {
                    onAddManual(manual.trim());
                    onClose();
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (manual.trim()) {
                    onAddManual(manual.trim());
                    onClose();
                  }
                }}
              >
                Add
              </Button>
            </div>
          </LabeledField>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- Drawer ---------------------------------- */

function MemberDrawer({
  member: m,
  displayName,
  groups,
  onClose,
  onChange,
  onDelete,
}: {
  member: PartyMember | null;
  displayName: string;
  groups: PartyGroup[];
  onClose: () => void;
  onChange: (patch: Partial<PartyMember>) => void;
  onDelete: () => void;
}) {
  const open = !!m;
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
          'fixed top-0 right-0 z-50 h-full w-[420px] max-w-[94vw] bg-surface border-l border-border shadow-lift flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {m && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <h3 className="font-display text-xl text-primary leading-tight truncate">
                  {displayName || 'Party member'}
                </h3>
                {m.memberId ? (
                  <span className="text-[11px] text-muted">Linked to guest list</span>
                ) : (
                  <span className="text-[11px] text-muted">Not on the guest list</span>
                )}
              </div>
              <IconButton onClick={onClose} aria-label="Close">
                <X size={16} />
              </IconButton>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {!m.memberId && (
                <LabeledField label="Name">
                  <Input value={m.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Full name" />
                </LabeledField>
              )}

              <div className="grid grid-cols-2 gap-3">
                <LabeledField label="Group">
                  <Select value={m.groupId} onChange={(e) => onChange({ groupId: e.target.value })}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label || 'Untitled'}
                      </option>
                    ))}
                  </Select>
                </LabeledField>
                <LabeledField label="Role">
                  <Input
                    list="party-roles"
                    value={m.role}
                    onChange={(e) => onChange({ role: e.target.value })}
                    placeholder="e.g. Best Man"
                  />
                  <datalist id="party-roles">
                    {PARTY_ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </LabeledField>
              </div>

              <LabeledField label="Asked / confirmed">
                <div className="grid grid-cols-4 rounded-lg border border-border overflow-hidden">
                  {ASK_OPTIONS.map((a) => (
                    <button
                      key={a}
                      onClick={() => onChange({ ask: a })}
                      className={cn(
                        'h-9 text-[11px] font-semibold transition-colors',
                        m.ask === a
                          ? a === 'Confirmed'
                            ? 'bg-success text-white'
                            : a === 'Asked'
                            ? 'bg-warning text-white'
                            : a === 'Declined'
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white'
                          : 'bg-surface text-muted hover:text-ink'
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </LabeledField>

              <div className="grid grid-cols-2 gap-3">
                <LabeledField label="Attire size">
                  <Input value={m.attireSize} onChange={(e) => onChange({ attireSize: e.target.value })} placeholder="e.g. 40R" />
                </LabeledField>
                <LabeledField label="Attire status">
                  <Select value={m.attireStatus} onChange={(e) => onChange({ attireStatus: e.target.value })}>
                    <option value="">—</option>
                    {ATTIRE_STATUSES.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </Select>
                </LabeledField>
              </div>

              <LabeledField label="Proposal gift">
                <Input value={m.gift} onChange={(e) => onChange({ gift: e.target.value })} placeholder="Idea / what you gave" />
              </LabeledField>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.thankYou}
                  onChange={(e) => onChange({ thankYou: e.target.checked })}
                  className="h-4 w-4 accent-[rgb(var(--c-accent))]"
                />
                Thank-you sent
              </label>

              <LabeledField label="Contact">
                <Input value={m.contact} onChange={(e) => onChange({ contact: e.target.value })} placeholder="Phone / email" />
              </LabeledField>

              <LabeledField label="Notes">
                <Textarea
                  value={m.notes}
                  onChange={(e) => onChange({ notes: e.target.value })}
                  rows={2}
                  placeholder="Anything to remember…"
                />
              </LabeledField>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border">
              <Button variant="ghost" className="text-danger" icon={<Trash2 size={14} />} onClick={onDelete}>
                Remove
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
