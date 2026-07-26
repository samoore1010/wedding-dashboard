import type { Household } from '../types';
import { GUEST_FIELDS, GUEST_HEADERS } from './schema';
import { suggestLabel } from '../utils';

/** Escape one CSV cell — wrap in quotes and double any embedded quotes. */
const cell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

/** Serialise a matrix of rows to CSV text with a UTF-8 BOM (keeps Excel happy). */
export const toCsv = (rows: (string | number | boolean)[][]): string =>
  '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');

/** Trigger a client-side download of the given text as a file. */
const download = (text: string, filename: string, mime = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** One clean row per person; household-level fields repeat across its members. */
export const householdsToRows = (households: Household[]): string[][] => {
  const rows: string[][] = [GUEST_HEADERS];
  for (const h of households) {
    const label = h.label.trim() || suggestLabel(h.members) || 'Untitled household';
    for (const m of h.members) {
      rows.push(
        GUEST_FIELDS.map((f) => {
          switch (f.key) {
            case 'household':
              return label;
            case 'name':
              return m.name;
            case 'kind':
              return m.kind === 'child' ? 'Child' : 'Adult';
            case 'rsvp':
              return m.rsvp;
            case 'meal':
              return m.meal;
            case 'dietary':
              return m.dietary;
            case 'guestEmail':
              return m.email;
            case 'guestPhone':
              return m.phone;
            case 'side':
              return h.side;
            case 'group':
              return h.group;
            case 'list':
              return h.list ?? 'Invited';
            case 'inviteSent':
              return h.inviteSent ? 'Yes' : 'No';
            case 'email':
              return h.email;
            case 'phone':
              return h.phone;
            case 'address':
              return h.address;
            case 'table':
              return h.table;
            case 'notes':
              return h.notes;
            default:
              return '';
          }
        })
      );
    }
  }
  return rows;
};

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const exportGuestsCsv = (households: Household[]) => {
  download(toCsv(householdsToRows(households)), `guest-list-${stamp()}.csv`);
};

/** A blank, self-documenting template with two illustrative example rows. */
export const downloadGuestTemplate = () => {
  const rows: string[][] = [
    GUEST_HEADERS,
    ['The Smith Family', 'John Smith', 'Adult', 'Yes', 'Beef', '', 'john@email.com', '555-0101', 'Groom', 'Groom Family', 'Invited', 'Yes', 'jsmith@email.com', '555-0100', '12 Oak St, Denver CO', '', ''],
    ['The Smith Family', 'Mary Smith', 'Adult', 'Yes', 'Fish', 'Gluten-free', 'mary@email.com', '555-0102', 'Groom', 'Groom Family', 'Invited', 'Yes', 'jsmith@email.com', '555-0100', '12 Oak St, Denver CO', '', ''],
    ['Jane Doe', 'Jane Doe', 'Adult', 'Waiting', '', '', 'jane@email.com', '555-0199', 'Bride', 'Bride Friends', 'Invited', 'No', 'jane@email.com', '', '', '', 'College roommate'],
  ];
  download(toCsv(rows), 'guest-list-template.csv');
};

/**
 * Parse CSV text into a matrix of string cells. Handles quoted fields,
 * embedded commas / newlines, escaped double-quotes, and CRLF or LF endings.
 * Deliberately dependency-free — the app already hand-rolls its CSV output.
 */
export const parseCsv = (text: string): string[][] => {
  // Strip a leading BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      endField();
      i++;
      continue;
    }
    if (c === '\r') {
      // swallow \r; \n (if present) handled next iteration
      if (text[i + 1] === '\n') i++;
      endRow();
      i++;
      continue;
    }
    if (c === '\n') {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Flush trailing field/row unless the file ended on a clean newline.
  if (field.length > 0 || row.length > 0) endRow();

  // Drop fully-empty trailing rows.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
};
