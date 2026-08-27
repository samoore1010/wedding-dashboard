import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  MapPin,
  Users,
  Wallet,
  Trash2,
  X,
  Crown,
  Link2,
  Search,
} from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select, Textarea, LabeledField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { EditableText } from '../components/ui/EditableText';
import { EditableSelect } from '../components/ui/EditableSelect';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { EditControls } from '../components/ui/EditControls';
import { useEditSession } from '../components/ui/useEditSession';
import { cn, fmtMoney } from '../utils';
import {
  BACH_RSVPS,
  BACH_TAGS,
  attendeeContact,
  attendeeGuestMemberId,
  attendeeName,
  attendeeShare,
  costBreakdown,
  countsFor,
  headlineDestination,
  isCounted,
  rosterCounts,
  rosterMoney,
  type BachLinkCtx,
} from '../bachParty';
import { DestinationDetail } from './bach/DestinationDetail';
import type { BachAttendee, BachDestStatus, BachRsvp } from '../types';

/** A person who could be added to the roster, from either list. */
type Candidate = {
  key: string;
  name: string;
  detail: string;
  source: 'party' | 'guest';
  partyMemberId?: string;
  householdId?: string;
  memberId?: string;
  contact: string;
  tag: string;
};

export const RSVP_TONE: Record<BachRsvp, 'yes' | 'waiting' | 'no' | 'neutral'> = {
  In: 'yes',
  Maybe: 'waiting',
  Out: 'no',
  Invited: 'neutral',
};

export const STATUS_TONE: Record<BachDestStatus, 'done' | 'pending' | 'neutral' | 'no'> = {
  Booked: 'done',
  Shortlist: 'pending',
  Idea: 'neutral',
  Passed: 'no',
};

export function BachParty() {
  const s = useShallowStore((st) => ({
    bach: st.bachParty,
    households: st.households,
    party: st.weddingParty,
    currency: st.settings.currency,
    updateBachParty: st.updateBachParty,
    addBachDestination: st.addBachDestination,
    removeBachDestination: st.removeBachDestination,
    addBachAttendee: st.addBachAttendee,
    updateBachAttendee: st.updateBachAttendee,
    removeBachAttendee: st.removeBachAttendee,
  }));
  const { bach, currency } = s;

  const [openDestId, setOpenDestId] = useState<string | null>(null);
  const [openAttendeeId, setOpenAttendeeId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | BachRsvp>('all');

  const ctx: BachLinkCtx = useMemo(
    () => ({ households: s.households, party: s.party }),
    [s.households, s.party]
  );
  const nameOf = useCallback((a: BachAttendee) => attendeeName(a, ctx), [ctx]);

  // Everything money-related hangs off these two numbers, so they're computed
  // once here and handed down.
  const roster = useMemo(
    () => rosterCounts(bach.attendees, bach.countMaybes),
    [bach.attendees, bach.countMaybes]
  );
  const headline = useMemo(() => headlineDestination(bach, roster), [bach, roster]);
  const headlineCosts = useMemo(
    () => (headline ? costBreakdown(headline, countsFor(headline, roster)) : null),
    [headline, roster]
  );
  const perPerson = headlineCosts?.perPerson ?? 0;
  const money = useMemo(
    () => rosterMoney(bach.attendees, perPerson, bach.countMaybes),
    [bach.attendees, perPerson, bach.countMaybes]
  );

  const maybeCount = bach.attendees.filter((a) => a.rsvp === 'Maybe').length;

  const shown = useMemo(() => {
    const list = filter === 'all' ? bach.attendees : bach.attendees.filter((a) => a.rsvp === filter);
    // Honoree first, then who's actually coming, then alphabetically.
    const rank: Record<BachRsvp, number> = { In: 0, Maybe: 1, Invited: 2, Out: 3 };
    return [...list].sort(
      (a, b) =>
        Number(b.isHonoree) - Number(a.isHonoree) ||
        rank[a.rsvp] - rank[b.rsvp] ||
        nameOf(a).localeCompare(nameOf(b))
    );
  }, [bach.attendees, filter, nameOf]);

  // People on either list who aren't on the roster yet.
  const candidates = useMemo(() => {
    const usedParty = new Set(bach.attendees.map((a) => a.partyMemberId).filter(Boolean));
    const usedGuests = new Set(
      bach.attendees.map((a) => attendeeGuestMemberId(a, ctx)).filter(Boolean)
    );
    const out: Candidate[] = [];
    s.party.members.forEach((pm) => {
      if (usedParty.has(pm.id)) return;
      if (pm.memberId && usedGuests.has(pm.memberId)) return;
      const name = attendeeName(
        { ...EMPTY_ATTENDEE, linkKind: 'party', partyMemberId: pm.id, name: pm.name },
        ctx
      );
      if (!name.trim()) return;
      out.push({
        key: 'pm_' + pm.id,
        name,
        detail: pm.role || s.party.groups.find((g) => g.id === pm.groupId)?.label || 'Wedding party',
        source: 'party',
        partyMemberId: pm.id,
        householdId: pm.householdId,
        memberId: pm.memberId,
        contact: pm.contact,
        tag: pm.role || 'Groomsman',
      });
    });
    s.households.forEach((h) => {
      h.members.forEach((m) => {
        if (!m.name.trim() || usedGuests.has(m.id)) return;
        if (out.some((c) => c.memberId === m.id)) return;
        out.push({
          key: 'g_' + m.id,
          name: m.name,
          detail: h.label || 'Guest list',
          source: 'guest',
          householdId: h.id,
          memberId: m.id,
          contact: m.phones[0] || m.emails[0] || h.phones[0] || h.emails[0] || '',
          tag: '',
        });
      });
    });
    return out;
  }, [bach.attendees, ctx, s.party, s.households]);

  if (openDestId && bach.destinations.some((d) => d.id === openDestId)) {
    return (
      <DestinationDetail
        destId={openDestId}
        roster={roster}
        onBack={() => setOpenDestId(null)}
      />
    );
  }

  const openAttendee = bach.attendees.find((a) => a.id === openAttendeeId) ?? null;

  return (
    <div className="space-y-6">
      {/* Trip header */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-display text-2xl text-primary leading-tight">
              <EditableText
                value={bach.title}
                onChange={(v) => s.updateBachParty({ title: v })}
                placeholder="Name this trip"
                ariaLabel="trip title"
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Crown size={13} />
                <span className="w-28">
                  <EditableText
                    value={bach.honoreeName}
                    onChange={(v) => s.updateBachParty({ honoreeName: v })}
                    placeholder="Who it's for"
                    ariaLabel="honoree"
                  />
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} />
                <span className="w-40">
                  <EditableText
                    value={bach.dates}
                    onChange={(v) => s.updateBachParty({ dates: v })}
                    placeholder="Dates, once you know"
                    ariaLabel="dates"
                  />
                </span>
              </span>
            </div>
          </div>

          {/* Whether Maybes are priced in — the per-person number moves a lot on this. */}
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer shrink-0 bg-bg border border-border rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={bach.countMaybes}
              onChange={(e) => s.updateBachParty({ countMaybes: e.target.checked })}
              className="h-4 w-4 accent-[rgb(var(--c-accent))]"
            />
            Count {maybeCount > 0 ? `${maybeCount} ` : ''}Maybe{maybeCount === 1 ? '' : 's'} in the
            headcount
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Going"
          value={roster.headcount}
          hint={
            roster.honoreeCount
              ? `${roster.payingCount} paying + ${roster.honoreeCount} covered`
              : 'Marked In'
          }
          icon={<Users size={16} />}
        />
        <StatCard label="Maybe" value={maybeCount} tone={maybeCount ? 'warning' : 'default'} />
        <StatCard
          label="Per person"
          value={fmtMoney(perPerson, currency)}
          tone="accent"
          hint={
            headline
              ? `${headline.name || 'Untitled'}${headlineCosts?.estimated ? ' · estimated' : ''}${
                  bach.chosenId === headline.id ? ' · booked' : ' · cheapest option'
                }`
              : 'Add a location idea to price it'
          }
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Still to collect"
          value={fmtMoney(money.outstanding, currency)}
          tone={money.outstanding > 0 ? 'rose' : 'sage'}
          hint={`${fmtMoney(money.collected, currency)} of ${fmtMoney(money.owed, currency)} in`}
        />
      </div>

      {/* Location ideas */}
      <Card
        title="Location Ideas"
        action={
          <Button
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setOpenDestId(s.addBachDestination())}
          >
            Add idea
          </Button>
        }
      >
        {bach.destinations.length === 0 ? (
          <EmptyState
            icon={<MapPin size={22} />}
            title="No locations yet"
            description="Add a place you're considering. Give it cost lines and it'll price itself per person against the roster."
            action={
              <Button icon={<Plus size={14} />} onClick={() => setOpenDestId(s.addBachDestination())}>
                Add the first idea
              </Button>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {bach.destinations.map((d) => {
              const b = costBreakdown(d, countsFor(d, roster));
              const booked = d.id === bach.chosenId;
              return (
                <button
                  key={d.id}
                  onClick={() => setOpenDestId(d.id)}
                  className={cn(
                    'text-left rounded-xl2 border bg-bg p-4 transition-all hover:shadow-lift hover:border-accent/50',
                    booked ? 'border-success ring-1 ring-success/30' : 'border-border',
                    d.status === 'Passed' && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-display text-lg text-primary leading-tight truncate">
                        {d.name || 'Untitled idea'}
                      </div>
                      {d.location && (
                        <div className="text-xs text-muted truncate">{d.location}</div>
                      )}
                    </div>
                    <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
                  </div>

                  <div className="flex items-end justify-between gap-2 mt-3">
                    <div>
                      <div className="text-2xl font-bold text-accent leading-none">
                        {fmtMoney(b.perPerson, currency)}
                      </div>
                      <div className="text-[11px] text-muted mt-1">
                        per person
                        {b.headcount > 0 && (
                          <> · {b.estimated ? `est. ${b.headcount}` : `${b.headcount} going`}</>
                        )}
                      </div>
                    </div>
                    {b.tripTotal > 0 && (
                      <div className="text-right text-[11px] text-muted">
                        <div className="font-semibold text-ink">
                          {fmtMoney(b.tripTotal, currency)}
                        </div>
                        trip total
                      </div>
                    )}
                  </div>

                  {(d.dates || d.nights || d.travel) && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                      {[d.dates, d.nights && `${d.nights} nights`, d.travel]
                        .filter(Boolean)
                        .map((chip, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-surface border border-border rounded-full px-2 py-0.5 text-muted truncate max-w-full"
                          >
                            {chip}
                          </span>
                        ))}
                    </div>
                  )}
                  {d.costs.length === 0 && (
                    <div className="text-[11px] text-warning mt-3">No costs added yet</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Roster */}
      <Card
        title="Who's Going"
        action={
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="h-8 py-0 text-xs w-auto"
              aria-label="Filter roster"
            >
              <option value="all">Everyone ({bach.attendees.length})</option>
              {BACH_RSVPS.map((r) => (
                <option key={r} value={r}>
                  {r} ({bach.attendees.filter((a) => a.rsvp === r).length})
                </option>
              ))}
            </Select>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Add person
            </Button>
          </div>
        }
      >
        {bach.attendees.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="Nobody on the list yet"
            description="Pull people in from the wedding party or the guest list — or add anyone who's coming but isn't on either."
            action={
              <Button icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                Add the first person
              </Button>
            }
          />
        ) : (
          <div className="space-y-1.5">
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_110px_100px_100px_100px_32px] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <span>Name</span>
              <span>Coming?</span>
              <span className="text-right">Owes</span>
              <span className="text-right">Paid</span>
              <span className="text-right">Balance</span>
              <span />
            </div>
            {shown.map((a) => {
              const counted = isCounted(a, bach.countMaybes);
              const share = attendeeShare(a, perPerson, counted);
              const balance = share - (Number(a.paid) || 0);
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-border bg-bg px-3 py-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_110px_100px_100px_100px_32px] md:items-center"
                >
                  <button
                    onClick={() => setOpenAttendeeId(a.id)}
                    className="text-left min-w-0 group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a.isHonoree && <Crown size={12} className="text-accent shrink-0" />}
                      <span className="text-sm font-medium truncate group-hover:text-accent">
                        {nameOf(a) || 'Unnamed'}
                      </span>
                      {a.linkKind !== 'none' && (
                        <span
                          className="shrink-0 text-muted/60"
                          title={a.linkKind === 'party' ? 'Wedding party' : 'Guest list'}
                        >
                          <Link2 size={11} />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {[a.tag, attendeeContact(a, ctx)].filter(Boolean).join(' · ') ||
                        'Tap to add details'}
                    </div>
                  </button>

                  <Cell label="Coming?">
                    <EditableSelect
                      value={a.rsvp}
                      options={BACH_RSVPS}
                      onChange={(v) => s.updateBachAttendee(a.id, { rsvp: v as BachRsvp })}
                      ariaLabel={`RSVP for ${nameOf(a)}`}
                      displayClassName={cn(
                        'text-xs font-semibold',
                        a.rsvp === 'In' && 'text-success',
                        a.rsvp === 'Maybe' && 'text-warning',
                        a.rsvp === 'Out' && 'text-danger'
                      )}
                    />
                  </Cell>

                  <Cell label="Owes" align="right">
                    <span
                      className={cn(
                        'text-sm tabular-nums',
                        a.shareOverride != null && 'text-accent font-semibold',
                        !counted && 'text-muted/60'
                      )}
                      title={a.shareOverride != null ? 'Custom share' : undefined}
                    >
                      {a.isHonoree ? '—' : fmtMoney(share, currency)}
                    </span>
                  </Cell>

                  <Cell label="Paid" align="right">
                    <EditableText
                      value={a.paid ? String(a.paid) : ''}
                      numeric
                      align="right"
                      blank={fmtMoney(0, currency)}
                      format={(v) => fmtMoney(Number(v) || 0, currency)}
                      onChange={(v) => s.updateBachAttendee(a.id, { paid: Number(v) || 0 })}
                      ariaLabel={`amount paid by ${nameOf(a)}`}
                      className="text-sm tabular-nums"
                    />
                  </Cell>

                  <Cell label="Balance" align="right">
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        balance > 0.5 ? 'text-rose' : balance < -0.5 ? 'text-warning' : 'text-success'
                      )}
                    >
                      {balance > 0.5
                        ? fmtMoney(balance, currency)
                        : balance < -0.5
                        ? `+${fmtMoney(-balance, currency)}`
                        : 'Settled'}
                    </span>
                  </Cell>

                  <div className="flex justify-end col-start-2 row-start-1 md:col-start-auto md:row-start-auto">
                    <IconButton
                      tone="danger"
                      aria-label={`Remove ${nameOf(a)}`}
                      onClick={async () => {
                        if (
                          await confirmAction({
                            title: 'Remove from the trip?',
                            message: `Take ${nameOf(a) || 'this person'} off the bach party roster? They stay on the guest list.`,
                            confirmLabel: 'Remove',
                            variant: 'danger',
                          })
                        )
                          s.removeBachAttendee(a.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && (
              <p className="text-xs text-muted italic py-4 text-center">
                Nobody is marked "{filter}".
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Planning notes */}
      <Card title="Notes">
        <EditableText
          value={bach.notes}
          onChange={(v) => s.updateBachParty({ notes: v })}
          multiline
          rows={4}
          placeholder="Ideas, who's organizing what, restaurant reservations to make…"
          ariaLabel="bach party notes"
          className="text-sm"
        />
      </Card>

      <AddAttendeeModal
        open={addOpen}
        candidates={candidates}
        onClose={() => setAddOpen(false)}
        onAdd={(c) =>
          s.addBachAttendee({
            name: c.name,
            linkKind: c.source,
            partyMemberId: c.partyMemberId ?? '',
            householdId: c.householdId ?? '',
            memberId: c.memberId ?? '',
            contact: '',
            tag: c.tag,
            rsvp: 'Invited',
          })
        }
        onAddManual={(name, tag) =>
          s.addBachAttendee({ name, tag, linkKind: 'none', rsvp: 'Invited' })
        }
      />

      <AttendeeDrawer
        attendee={openAttendee}
        displayName={openAttendee ? nameOf(openAttendee) : ''}
        currency={currency}
        perPerson={perPerson}
        onClose={() => setOpenAttendeeId(null)}
        onSave={(next) => openAttendee && s.updateBachAttendee(openAttendee.id, next)}
      />
    </div>
  );
}

/** One value in a roster row — labeled on mobile, bare in the desktop grid. */
function Cell({
  label,
  align = 'left',
  children,
}: {
  label: string;
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:block',
        align === 'right' && 'md:text-right'
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

/* --------------------------- Add attendee modal -------------------------- */

function AddAttendeeModal({
  open,
  candidates,
  onClose,
  onAdd,
  onAddManual,
}: {
  open: boolean;
  candidates: Candidate[];
  onClose: () => void;
  onAdd: (c: Candidate) => void;
  onAddManual: (name: string, tag: string) => void;
}) {
  const [q, setQ] = useState('');
  const [manual, setManual] = useState('');
  const [manualTag, setManualTag] = useState('');

  useEffect(() => {
    if (open) {
      setQ('');
      setManual('');
      setManualTag('');
    }
  }, [open]);

  const filtered = candidates.filter(
    (c) => !q || c.name.toLowerCase().includes(q.toLowerCase())
  );
  const groups: { title: string; items: Candidate[] }[] = [
    { title: 'Wedding party', items: filtered.filter((c) => c.source === 'party') },
    { title: 'Guest list', items: filtered.filter((c) => c.source === 'guest') },
  ];

  const addManual = () => {
    if (!manual.trim()) return;
    onAddManual(manual.trim(), manualTag.trim());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add someone to the trip">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search the wedding party and guest list…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-3 -mr-1 pr-1">
          {groups.every((g) => g.items.length === 0) ? (
            <p className="text-xs text-muted italic py-3 text-center">
              {q ? 'No matches on either list.' : 'Everyone on both lists is already added.'}
            </p>
          ) : (
            groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.title}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                      {g.title}
                    </div>
                    <div className="flex flex-col gap-1">
                      {g.items.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => {
                            onAdd(c);
                            onClose();
                          }}
                          className="text-left px-3 py-2 rounded-lg border border-border hover:border-accent hover:bg-accent/5 text-sm flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] uppercase font-semibold text-muted shrink-0">
                            {c.detail}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
            )
          )}
        </div>

        <div className="border-t border-border pt-3">
          <LabeledField
            label="Or add anyone else"
            hint="For someone who isn't a groomsman and isn't on the guest list."
          >
            <div className="flex gap-2">
              <Input
                placeholder="Full name"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManual()}
              />
              <Input
                placeholder="Tag"
                list="bach-tags"
                className="w-32"
                value={manualTag}
                onChange={(e) => setManualTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManual()}
              />
              <datalist id="bach-tags">
                {BACH_TAGS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Button onClick={addManual}>Add</Button>
            </div>
          </LabeledField>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Detail drawer ---------------------------- */

const EMPTY_ATTENDEE: BachAttendee = {
  id: '',
  name: '',
  linkKind: 'none',
  partyMemberId: '',
  householdId: '',
  memberId: '',
  tag: '',
  rsvp: 'Invited',
  contact: '',
  paid: 0,
  shareOverride: null,
  isHonoree: false,
  notes: '',
};

function AttendeeDrawer({
  attendee: a,
  displayName,
  currency,
  perPerson,
  onClose,
  onSave,
}: {
  attendee: BachAttendee | null;
  displayName: string;
  currency: string;
  perPerson: number;
  onClose: () => void;
  onSave: (next: BachAttendee) => void;
}) {
  const open = !!a;
  // Nothing typed here reaches the roster until Save.
  const s = useEditSession(a ?? EMPTY_ATTENDEE, onSave);
  const d = s.shown;
  const { editing } = s;

  const cancelEdit = s.cancel;
  useEffect(() => {
    cancelEdit();
  }, [a?.id, cancelEdit]);

  const requestClose = useCallback(async () => {
    if (
      s.dirty &&
      !(await confirmAction({
        title: 'Discard changes?',
        message: "You haven't saved your changes to this person. Discard them?",
        confirmLabel: 'Discard',
        variant: 'danger',
      }))
    )
      return;
    s.cancel();
    onClose();
  }, [s, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  return (
    <>
      <div
        onClick={requestClose}
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
        {a && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-xl text-primary leading-tight truncate">
                  {displayName || 'On the trip'}
                </h3>
                <span className="text-[11px] text-muted">
                  {a.linkKind === 'party'
                    ? 'Linked to the wedding party'
                    : a.linkKind === 'guest'
                    ? 'Linked to the guest list'
                    : 'Not on either list'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <EditControls session={s} size="sm" what="this person" />
                <IconButton onClick={requestClose} aria-label="Close">
                  <X size={16} />
                </IconButton>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {d.linkKind === 'none' && (
                <LabeledField label="Name">
                  <Input
                    value={d.name}
                    disabled={!editing}
                    onChange={(e) => s.set({ name: e.target.value })}
                    placeholder="Full name"
                  />
                </LabeledField>
              )}

              <div className="grid grid-cols-2 gap-3">
                <LabeledField label="Coming?">
                  <Select
                    value={d.rsvp}
                    disabled={!editing}
                    onChange={(e) => s.set({ rsvp: e.target.value as BachRsvp })}
                  >
                    {BACH_RSVPS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </LabeledField>
                <LabeledField label="Tag" hint="Freeform — not just groomsmen.">
                  <Input
                    list="bach-tags-drawer"
                    value={d.tag}
                    disabled={!editing}
                    onChange={(e) => s.set({ tag: e.target.value })}
                    placeholder="e.g. College friend"
                  />
                  <datalist id="bach-tags-drawer">
                    {BACH_TAGS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </LabeledField>
              </div>

              <LabeledField
                label="Contact"
                hint={
                  a.linkKind !== 'none' ? 'Leave blank to use their linked contact details.' : undefined
                }
              >
                <Input
                  value={d.contact}
                  disabled={!editing}
                  onChange={(e) => s.set({ contact: e.target.value })}
                  placeholder="Phone / email"
                />
              </LabeledField>

              <div className="grid grid-cols-2 gap-3">
                <LabeledField label={`Paid (${currency})`}>
                  <Input
                    type="number"
                    value={d.paid || ''}
                    disabled={!editing}
                    onChange={(e) => s.set({ paid: Number(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </LabeledField>
                <LabeledField
                  label={`Custom share (${currency})`}
                  hint={`Blank = the group rate, ${fmtMoney(perPerson, currency)}.`}
                >
                  <Input
                    type="number"
                    value={d.shareOverride ?? ''}
                    disabled={!editing}
                    onChange={(e) =>
                      s.set({
                        shareOverride: e.target.value === '' ? null : Number(e.target.value) || 0,
                      })
                    }
                    placeholder="Group rate"
                  />
                </LabeledField>
              </div>

              <label
                className={cn(
                  'flex items-start gap-2 text-sm rounded-lg border border-border bg-bg px-3 py-2.5',
                  editing ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                <input
                  type="checkbox"
                  checked={d.isHonoree}
                  disabled={!editing}
                  onChange={(e) => s.set({ isHonoree: e.target.checked })}
                  className="h-4 w-4 mt-0.5 accent-[rgb(var(--c-accent))]"
                />
                <span>
                  This is who the trip is for
                  <span className="block text-[11px] text-muted">
                    Counted in the headcount, owes nothing. Lines marked "group covers him" get
                    split across everyone else.
                  </span>
                </span>
              </label>

              <LabeledField label="Notes">
                <Textarea
                  value={d.notes}
                  disabled={!editing}
                  onChange={(e) => s.set({ notes: e.target.value })}
                  rows={3}
                  placeholder="Arriving late Friday, sharing a room with…"
                />
              </LabeledField>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border">
              {editing ? (
                <EditControls session={s} what="this person" />
              ) : (
                <Button onClick={requestClose}>Done</Button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
