/**
 * Helpers for the multi-value contact lists (emails / phone numbers) carried by
 * both households and individual people.
 *
 * Real guest spreadsheets put several numbers in one cell — "555-0100 / 555-0101",
 * "mom@x.com; dad@x.com", "555-0100 or 555-0199" — so anything arriving from a
 * sheet, a paste, or the assistant goes through {@link splitContacts} first.
 */

/** Split one free-text cell into the individual contacts it holds. */
export const splitContacts = (raw: string): string[] =>
  String(raw ?? '')
    .split(/[;,\n\r|]+|\s+or\s+|\s*\/\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

/** Trim, drop blanks, and drop case-insensitive repeats, keeping first order. */
export const cleanContacts = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = String(v ?? '').trim();
    if (!t) continue;
    const key = t.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
};

/** Accept either a list or a single free-text cell and normalise to a list. */
export const toContacts = (value: unknown): string[] => {
  if (Array.isArray(value)) return cleanContacts(value.flatMap((v) => splitContacts(String(v ?? ''))));
  if (value == null) return [];
  return cleanContacts(splitContacts(String(value)));
};

/** Add to an existing list without losing or duplicating what's already there. */
export const mergeContacts = (existing: readonly string[], added: readonly string[]): string[] =>
  cleanContacts([...existing, ...added]);

/** One cell holding every value — the shape {@link splitContacts} reads back. */
export const joinContacts = (values: readonly string[] = []): string =>
  cleanContacts(values).join('; ');
