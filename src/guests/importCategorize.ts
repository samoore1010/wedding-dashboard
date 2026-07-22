import type { GuestGroup, GuestList, GuestSide, GuestStatus, Household, MemberKind } from '../types';
import { GUEST_FIELDS, type GuestFieldKey } from './schema';
import type { Sheet } from './importParse';
import { uid } from '../utils';

/** field key -> column index in the uploaded sheet. */
export type ColumnMap = Partial<Record<GuestFieldKey, number>>;

export interface StagedMember {
  name: string;
  kind: MemberKind;
  rsvp: GuestStatus;
  meal: string;
  dietary: string;
}

export type RowStatus = 'new' | 'duplicate' | 'update';

export interface StagedHousehold {
  /** Temporary id for wizard bookkeeping only. */
  tmpId: string;
  label: string;
  side: GuestSide;
  group: GuestGroup;
  list: GuestList;
  email: string;
  address: string;
  inviteSent: boolean;
  notes: string;
  table: string;
  members: StagedMember[];
  /** Import disposition, editable in the review step. */
  status: RowStatus;
  /** Existing household id when status is duplicate/update. */
  matchId?: string;
  /** Human-readable reasons the row may need a look ("Side guessed", …). */
  flags: string[];
}

// ---- Header auto-mapping ---------------------------------------------------

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9 &]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Best-guess mapping of sheet headers onto our canonical fields. */
export const autoMapColumns = (headers: string[]): ColumnMap => {
  const map: ColumnMap = {};
  const used = new Set<number>();
  const normHeaders = headers.map(norm);

  for (const field of GUEST_FIELDS) {
    const targets = [norm(field.header), ...field.aliases.map(norm)];
    let best = -1;
    // Exact header/alias match first…
    for (let i = 0; i < normHeaders.length; i++) {
      if (used.has(i)) continue;
      if (targets.includes(normHeaders[i])) {
        best = i;
        break;
      }
    }
    // …then a contains match (either direction).
    if (best < 0) {
      for (let i = 0; i < normHeaders.length; i++) {
        if (used.has(i)) continue;
        const h = normHeaders[i];
        if (!h) continue;
        if (targets.some((t) => t && (h.includes(t) || t.includes(h)))) {
          best = i;
          break;
        }
      }
    }
    if (best >= 0) {
      map[field.key] = best;
      used.add(best);
    }
  }
  return map;
};

// ---- Value normalisers -----------------------------------------------------

export const normRsvp = (v: string): GuestStatus => {
  const s = norm(v);
  if (!s) return 'Waiting';
  if (/^(y|yes|yep|accept|accepted|attending|coming|confirmed|1|true|✓|x)$/.test(s)) return 'Yes';
  if (/^(n|no|nope|decline|declined|not attending|regret|regrets|cant|cannot|0|false)$/.test(s)) return 'No';
  return 'Waiting';
};

export const normKind = (v: string, age?: string): MemberKind => {
  const s = norm(v);
  if (/child|kid|infant|baby|minor/.test(s)) return 'child';
  if (/adult/.test(s)) return 'adult';
  const n = parseInt(age ?? v, 10);
  if (!Number.isNaN(n) && n > 0 && n < 18) return 'child';
  return 'adult';
};

export const normBool = (v: string): boolean => /^(y|yes|true|sent|mailed|1|✓|x|done)$/.test(norm(v));

export const normSide = (v: string): { side: GuestSide; guessed: boolean } => {
  const s = norm(v);
  if (!s) return { side: 'Both', guessed: true };
  if (/both|shared|mutual|couple/.test(s)) return { side: 'Both', guessed: false };
  if (/bride|hers?|her side|wife|she/.test(s)) return { side: 'Bride', guessed: false };
  if (/groom|his|his side|husband|he/.test(s)) return { side: 'Groom', guessed: false };
  return { side: 'Both', guessed: true };
};

const GROUP_ALL: GuestGroup[] = [
  'Couple Friends',
  'Bride Family',
  'Groom Family',
  'Bride Friends',
  'Groom Friends',
  'Work',
  'Other',
];

export const normGroup = (v: string, side: GuestSide): { group: GuestGroup; guessed: boolean } => {
  const s = norm(v);
  // Exact match to a known group first.
  const exact = GROUP_ALL.find((g) => norm(g) === s);
  if (exact) return { group: exact, guessed: false };
  if (!s) {
    return { group: side === 'Both' ? 'Couple Friends' : 'Other', guessed: true };
  }
  const isFamily = /family|parent|mother|father|mom|dad|sister|brother|aunt|uncle|cousin|grand|relative|niece|nephew/.test(s);
  const isWork = /work|colleague|coworker|co worker|office|boss|business|professional/.test(s);
  const isFriend = /friend|buddy|college|school|roommate|neighbou?r/.test(s);
  if (isWork) return { group: 'Work', guessed: false };
  if (isFamily) {
    if (side === 'Bride') return { group: 'Bride Family', guessed: false };
    if (side === 'Groom') return { group: 'Groom Family', guessed: false };
    return { group: 'Bride Family', guessed: true };
  }
  if (isFriend) {
    if (side === 'Bride') return { group: 'Bride Friends', guessed: false };
    if (side === 'Groom') return { group: 'Groom Friends', guessed: false };
    return { group: 'Couple Friends', guessed: false };
  }
  return { group: 'Other', guessed: true };
};

export const normList = (v: string): GuestList => {
  const s = norm(v);
  if (/b.?list|backup|second|round 2|tier 2|maybe|tentative|unsure|possible|tier 3/.test(s)) return 'B-list';
  return 'Invited';
};

// ---- Raw row extraction ----------------------------------------------------

interface RawGuest {
  household: string;
  name: string;
  kind: string;
  rsvp: string;
  meal: string;
  dietary: string;
  side: string;
  group: string;
  list: string;
  inviteSent: string;
  email: string;
  address: string;
  table: string;
  notes: string;
}

const getCell = (row: string[], map: ColumnMap, key: GuestFieldKey): string => {
  const idx = map[key];
  return idx == null ? '' : (row[idx] ?? '').trim();
};

const rawFromSheet = (sheet: Sheet, map: ColumnMap): RawGuest[] =>
  sheet.rows
    .map((row) => ({
      household: getCell(row, map, 'household'),
      name: getCell(row, map, 'name'),
      kind: getCell(row, map, 'kind'),
      rsvp: getCell(row, map, 'rsvp'),
      meal: getCell(row, map, 'meal'),
      dietary: getCell(row, map, 'dietary'),
      side: getCell(row, map, 'side'),
      group: getCell(row, map, 'group'),
      list: getCell(row, map, 'list'),
      inviteSent: getCell(row, map, 'inviteSent'),
      email: getCell(row, map, 'email'),
      address: getCell(row, map, 'address'),
      table: getCell(row, map, 'table'),
      notes: getCell(row, map, 'notes'),
    }))
    .filter((r) => r.name || r.household);

/** Split "John & Jane Smith" / "John and Jane Doe" into individual names. */
const splitNames = (name: string): string[] => {
  const parts = name
    .split(/\s*(?:&|\+|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [name.trim()].filter(Boolean);
  // If an earlier part lacks a surname ("John" vs "Jane Smith"), borrow the last surname.
  const surname = parts[parts.length - 1].split(/\s+/).slice(-1)[0];
  return parts.map((p) => (p.includes(' ') ? p : surname ? `${p} ${surname}` : p));
};

// ---- Household grouping ----------------------------------------------------

const surnameOf = (name: string) => name.trim().split(/\s+/).slice(-1)[0]?.toLowerCase() ?? '';

/**
 * Group flat person-rows into households. Precedence:
 *   1. an explicit Household/Party column,
 *   2. a shared, non-empty email,
 *   3. a shared address + surname,
 *   4. otherwise the person stands alone.
 */
export const groupIntoHouseholds = (raws: RawGuest[]): StagedHousehold[] => {
  const buckets = new Map<string, RawGuest[]>();
  let solo = 0;
  for (const r of raws) {
    let key: string;
    if (r.household) key = 'hh:' + norm(r.household);
    else if (r.email) key = 'em:' + norm(r.email);
    else if (r.address) key = 'ad:' + norm(r.address) + '|' + surnameOf(r.name);
    else key = 'solo:' + solo++;
    buckets.set(key, [...(buckets.get(key) ?? []), r]);
  }

  const out: StagedHousehold[] = [];
  for (const group of buckets.values()) {
    const members: StagedMember[] = [];
    for (const r of group) {
      for (const nm of splitNames(r.name || r.household)) {
        members.push({
          name: nm,
          kind: normKind(r.kind),
          rsvp: normRsvp(r.rsvp),
          meal: r.meal,
          dietary: r.dietary,
        });
      }
    }
    if (!members.length) continue;

    // Household-level fields come from the first row that supplies each.
    const first = group[0];
    const pick = (k: keyof RawGuest) => group.map((g) => g[k]).find((v) => v && v.trim()) ?? '';
    const { side, guessed: sideGuessed } = normSide(pick('side'));
    const { group: grp, guessed: groupGuessed } = normGroup(pick('group'), side);
    const flags: string[] = [];
    if (sideGuessed) flags.push('Side needs review');
    if (groupGuessed) flags.push('Relationship needs review');

    out.push({
      tmpId: 't_' + uid(),
      label: first.household.trim() || deriveLabel(members.map((m) => m.name)),
      side,
      group: grp,
      list: normList(pick('list')),
      email: pick('email'),
      address: pick('address'),
      inviteSent: normBool(pick('inviteSent')),
      notes: pick('notes'),
      table: pick('table'),
      members,
      status: 'new',
      flags,
    });
  }
  return out;
};

const deriveLabel = (names: string[]): string => {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return 'Untitled household';
  if (clean.length === 1) return clean[0];
  const surnames = clean.map(surnameOf);
  if (surnames.every((s) => s && s === surnames[0])) {
    return `The ${clean[0].split(/\s+/).slice(-1)[0]} Family`;
  }
  return clean.length === 2 ? `${clean[0]} & ${clean[1]}` : `${clean[0]} & ${clean.length - 1} others`;
};

// ---- Dedupe against the existing guest list --------------------------------

const nameKey = (name: string) =>
  norm(name)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

/**
 * Flag staged households that collide with the existing list. A match on any
 * member name (order-insensitive) or on a shared non-empty email marks the row
 * as a duplicate so the couple can skip or merge it instead of double-adding.
 */
export const markDuplicates = (staged: StagedHousehold[], existing: Household[]): void => {
  const byName = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const h of existing) {
    if (h.email) byEmail.set(norm(h.email), h.id);
    for (const m of h.members) {
      const k = nameKey(m.name);
      if (k) byName.set(k, h.id);
    }
  }
  for (const s of staged) {
    let match: string | undefined;
    if (s.email) match = byEmail.get(norm(s.email));
    if (!match) {
      for (const m of s.members) {
        const hit = byName.get(nameKey(m.name));
        if (hit) {
          match = hit;
          break;
        }
      }
    }
    if (match) {
      s.status = 'duplicate';
      s.matchId = match;
      s.flags = ['Possible duplicate', ...s.flags];
    }
  }
};

/** Full heuristic pipeline: sheet + mapping + existing list -> staged rows. */
export const stageImport = (sheet: Sheet, map: ColumnMap, existing: Household[]): StagedHousehold[] => {
  const staged = groupIntoHouseholds(rawFromSheet(sheet, map));
  markDuplicates(staged, existing);
  return staged;
};
