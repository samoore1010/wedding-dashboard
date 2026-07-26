import type { GuestGroup, GuestList, GuestSide, GuestStatus, Household, MemberKind } from '../types';
import type { Sheet } from './importParse';
import {
  type ColumnMap,
  type StagedHousehold,
  type StagedMember,
  markDuplicates,
} from './importCategorize';
import { GROUPS, LISTS, SIDES } from './schema';
import { uid } from '../utils';

interface AiGuest {
  index: number;
  name: string;
  household: string;
  side: string;
  group: string;
  list: string;
  kind: string;
  rsvp: string;
}

/** Is the AI categorizer available on this deployment? */
export const aiConfigured = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/assistant/status');
    if (!res.ok) return false;
    const j = await res.json();
    return Boolean(j?.configured);
  } catch {
    return false;
  }
};

const oneOf = <T extends string>(v: string, allowed: T[], fallback: T): T =>
  (allowed as string[]).includes(v) ? (v as T) : fallback;

/**
 * AI-first categorization. Sends the full sheet (every column, for context) to
 * the server categorizer, then merges Claude's per-person categorization with
 * the literal contact/meal fields taken from the mapped columns.
 *
 * Returns null when the categorizer is unavailable or errors, so the caller can
 * fall back to the deterministic heuristics.
 */
export const aiStageImport = async (
  sheet: Sheet,
  map: ColumnMap,
  existing: Household[],
  signal?: AbortSignal
): Promise<StagedHousehold[] | null> => {
  // Every column becomes context, keyed by header (deduped/blank-safe).
  const records = sheet.rows.map((row) => {
    const rec: Record<string, string> = {};
    sheet.headers.forEach((h, i) => {
      const key = h || `col${i + 1}`;
      const val = (row[i] ?? '').trim();
      if (val) rec[key] = val;
    });
    return rec;
  });

  let guests: AiGuest[];
  try {
    const res = await fetch('/api/import/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.guests)) return null;
    guests = data.guests;
  } catch {
    return null;
  }
  if (!guests.length) return null;

  // Literal per-row fields the AI doesn't infer, pulled from the mapping.
  const cell = (rowIdx: number, key: keyof ColumnMap): string => {
    const col = map[key];
    const row = sheet.rows[rowIdx];
    return col == null || !row ? '' : (row[col] ?? '').trim();
  };

  const byHousehold = new Map<string, AiGuest[]>();
  for (const g of guests) {
    const key = (g.household || g.name || `solo-${g.index}`).trim().toLowerCase();
    byHousehold.set(key, [...(byHousehold.get(key) ?? []), g]);
  }

  const staged: StagedHousehold[] = [];
  for (const group of byHousehold.values()) {
    const rowIdxs = [...new Set(group.map((g) => g.index))].filter((i) => i >= 0 && i < sheet.rows.length);
    const firstWith = (key: keyof ColumnMap) =>
      rowIdxs.map((i) => cell(i, key)).find((v) => v) ?? '';

    const members: StagedMember[] = group.map((g) => ({
      name: g.name.trim(),
      kind: oneOf<MemberKind>(g.kind, ['adult', 'child'], 'adult'),
      rsvp: oneOf<GuestStatus>(g.rsvp, ['Yes', 'No', 'Waiting'], 'Waiting'),
      meal: cell(g.index, 'meal'),
      dietary: cell(g.index, 'dietary'),
      email: cell(g.index, 'guestEmail'),
    }));

    const side = oneOf<GuestSide>(group[0].side, SIDES, 'Both');
    const grp = oneOf<GuestGroup>(group[0].group, GROUPS, 'Other');
    const list = oneOf<GuestList>(group[0].list, LISTS, 'Invited');

    staged.push({
      tmpId: 't_' + uid(),
      label: group[0].household.trim() || members[0]?.name || 'Untitled household',
      side,
      group: grp,
      list,
      email: firstWith('email'),
      address: firstWith('address'),
      inviteSent: /^(y|yes|true|sent|1)$/i.test(firstWith('inviteSent')),
      notes: firstWith('notes'),
      table: firstWith('table'),
      members: members.filter((m) => m.name),
      status: 'new',
      flags: [],
    });
  }

  const cleaned = staged.filter((s) => s.members.length);
  markDuplicates(cleaned, existing);
  return cleaned;
};
