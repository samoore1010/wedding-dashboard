import type {
  Household,
  WeddingParty,
  BachAttendee,
  BachCostLine,
  BachDestination,
  BachParty,
  BachRsvp,
  WeddingSettings,
} from './types';
import { uid } from './utils';

export const makeBachCostLine = (patch?: Partial<BachCostLine>): BachCostLine => ({
  id: 'bcl_' + uid(),
  label: '',
  amount: 0,
  split: 'total',
  coversHonoree: false,
  notes: '',
  ...patch,
});

export const makeBachDestination = (patch?: Partial<BachDestination>): BachDestination => ({
  id: 'bd_' + uid(),
  name: '',
  location: '',
  status: 'Idea',
  dates: '',
  nights: '',
  travel: '',
  lodging: '',
  links: [],
  costs: [],
  headcountEstimate: 0,
  pros: '',
  cons: '',
  notes: '',
  ...patch,
});

export const makeBachAttendee = (patch?: Partial<BachAttendee>): BachAttendee => ({
  id: 'ba_' + uid(),
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
  ...patch,
});

/** A fresh bach party, titled from the groom's name when there is one. */
export function defaultBachParty(settings?: Partial<WeddingSettings>): BachParty {
  const groom = settings?.groomName?.trim() ?? '';
  return {
    title: groom ? `${groom}'s Bach Party` : 'Bach Party',
    honoreeName: groom,
    dates: '',
    chosenId: '',
    countMaybes: false,
    destinations: [],
    attendees: [],
    notes: '',
  };
}

/** The guest list and wedding party, for resolving a linked attendee's details. */
export interface BachLinkCtx {
  households: Household[];
  party: WeddingParty;
}

/**
 * The name to show for an attendee. Linked people follow the guest list or the
 * wedding party, so a rename there doesn't leave a stale name here; anyone
 * added by hand keeps the name typed on the roster.
 */
export function attendeeName(a: BachAttendee, ctx: BachLinkCtx): string {
  if (a.linkKind === 'party') {
    const pm = ctx.party.members.find((m) => m.id === a.partyMemberId);
    if (pm) {
      const guest = pm.memberId
        ? ctx.households
            .find((h) => h.id === pm.householdId)
            ?.members.find((m) => m.id === pm.memberId)
        : undefined;
      return guest?.name || pm.name || a.name;
    }
  }
  if (a.linkKind === 'guest') {
    const guest = ctx.households
      .find((h) => h.id === a.householdId)
      ?.members.find((m) => m.id === a.memberId);
    if (guest?.name) return guest.name;
  }
  return a.name;
}

/** Contact for an attendee: whatever they were given here, else the linked record's. */
export function attendeeContact(a: BachAttendee, ctx: BachLinkCtx): string {
  if (a.contact.trim()) return a.contact;
  const guest = ctx.households
    .find((h) => h.id === a.householdId)
    ?.members.find((m) => m.id === a.memberId);
  if (guest) return guest.phones[0] || guest.emails[0] || '';
  if (a.linkKind === 'party') {
    const pm = ctx.party.members.find((m) => m.id === a.partyMemberId);
    if (pm?.contact) return pm.contact;
  }
  return '';
}

/** Guest member id an attendee ultimately points at, following a party link. */
export function attendeeGuestMemberId(a: BachAttendee, ctx: BachLinkCtx): string {
  if (a.memberId) return a.memberId;
  if (a.linkKind === 'party') {
    return ctx.party.members.find((m) => m.id === a.partyMemberId)?.memberId ?? '';
  }
  return '';
}

export const BACH_RSVPS: BachRsvp[] = ['Invited', 'In', 'Maybe', 'Out'];

/** Suggestions only — the tag is freeform so anyone can come, groomsman or not. */
export const BACH_TAGS = [
  'Groomsman',
  'Best Man',
  'Brother',
  'Family',
  'College friend',
  'Hometown friend',
  'Work',
  'Other',
];

/** Common lines, offered as suggestions when adding a cost. */
export const BACH_COST_PRESETS: { label: string; split: BachCostLine['split'] }[] = [
  { label: 'Lodging', split: 'total' },
  { label: 'Flights', split: 'perPerson' },
  { label: 'Rental car', split: 'total' },
  { label: 'Gas / tolls', split: 'total' },
  { label: 'Food & drinks', split: 'perPerson' },
  { label: 'Activity', split: 'total' },
  { label: 'Golf', split: 'perPerson' },
  { label: 'Tickets', split: 'perPerson' },
  { label: 'Transport / rides', split: 'total' },
];

// ---- headcount ----------------------------------------------------------

export interface BachCounts {
  /** Everyone on the trip, honoree included. */
  headcount: number;
  /** Those who chip in — headcount minus honorees. */
  payingCount: number;
  honoreeCount: number;
  /** True when the numbers come from a destination's estimate, not the roster. */
  estimated: boolean;
}

/** Is this person counted in the headcount right now? */
export const isCounted = (a: BachAttendee, countMaybes: boolean) =>
  a.rsvp === 'In' || (countMaybes && a.rsvp === 'Maybe');

/** Live counts off the roster. */
export function rosterCounts(attendees: BachAttendee[], countMaybes: boolean): BachCounts {
  const going = attendees.filter((a) => isCounted(a, countMaybes));
  const honoreeCount = going.filter((a) => a.isHonoree).length;
  return {
    headcount: going.length,
    honoreeCount,
    payingCount: going.length - honoreeCount,
    estimated: false,
  };
}

/**
 * Counts to price a destination with: its own estimate when it has one (so you
 * can compare options before anyone has answered), otherwise the live roster.
 */
export function countsFor(dest: BachDestination, roster: BachCounts): BachCounts {
  const n = Math.max(0, Math.round(dest.headcountEstimate || 0));
  if (!n) return roster;
  // Keep the honoree in the estimate — his share still has to land somewhere.
  const honoreeCount = Math.min(roster.honoreeCount, n);
  return { headcount: n, honoreeCount, payingCount: n - honoreeCount, estimated: true };
}

// ---- cost math ----------------------------------------------------------

export interface BachLineCost {
  line: BachCostLine;
  /** What this line costs the group in total. */
  total: number;
  /** What it costs one paying attendee. */
  perPayer: number;
}

export interface BachCostBreakdown extends BachCounts {
  lines: BachLineCost[];
  /** Everything the trip costs, all attendees together. */
  tripTotal: number;
  /** What one paying attendee owes. */
  perPerson: number;
  /** Extra each payer carries because the group covers the honoree. */
  honoreeSubsidy: number;
}

/**
 * Turn a destination's cost lines into a per-person price.
 *
 * A `total` line is one bill divided by the headcount; a `perPerson` line is
 * already per head and multiplies up. When a line covers the honoree, his
 * share of it is spread across the payers instead of being his to pay.
 */
export function costBreakdown(dest: BachDestination, counts: BachCounts): BachCostBreakdown {
  const { headcount, payingCount } = counts;

  const lines: BachLineCost[] = dest.costs.map((line) => {
    const amount = Number(line.amount) || 0;
    const total = line.split === 'total' ? amount : amount * headcount;
    const divisor = line.coversHonoree ? payingCount : headcount;
    return { line, total, perPayer: divisor > 0 ? total / divisor : 0 };
  });

  const tripTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const perPerson = lines.reduce((sum, l) => sum + l.perPayer, 0);
  // What an even split would have been, for showing the cost of covering him.
  const evenSplit = headcount > 0 ? tripTotal / headcount : 0;

  return {
    ...counts,
    lines,
    tripTotal,
    perPerson,
    honoreeSubsidy: Math.max(0, perPerson - evenSplit),
  };
}

/** What one attendee owes: their override, nothing if they're the honoree or not counted. */
export function attendeeShare(a: BachAttendee, perPerson: number, counted: boolean): number {
  if (a.shareOverride != null) return Number(a.shareOverride) || 0;
  if (!counted || a.isHonoree) return 0;
  return perPerson;
}

export interface BachMoney {
  owed: number;
  collected: number;
  /** Still to come in. Negative would mean overpaid. */
  outstanding: number;
}

/** Money across the whole roster for a given per-person price. */
export function rosterMoney(
  attendees: BachAttendee[],
  perPerson: number,
  countMaybes: boolean
): BachMoney {
  let owed = 0;
  let collected = 0;
  attendees.forEach((a) => {
    owed += attendeeShare(a, perPerson, isCounted(a, countMaybes));
    collected += Number(a.paid) || 0;
  });
  return { owed, collected, outstanding: owed - collected };
}

/**
 * The destination to headline: the booked one, else the cheapest per person
 * among those still in play (a Passed option isn't a real answer).
 */
export function headlineDestination(party: BachParty, roster: BachCounts): BachDestination | null {
  const booked = party.destinations.find((d) => d.id === party.chosenId);
  if (booked) return booked;
  const live = party.destinations.filter((d) => d.status !== 'Passed' && d.costs.length);
  if (!live.length) return party.destinations[0] ?? null;
  return live.reduce((best, d) =>
    costBreakdown(d, countsFor(d, roster)).perPerson <
    costBreakdown(best, countsFor(best, roster)).perPerson
      ? d
      : best
  );
}
