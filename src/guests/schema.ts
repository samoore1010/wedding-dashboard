import type { GuestGroup, GuestList, GuestSide, GuestStatus, MemberKind } from '../types';

/**
 * The canonical guest table schema. This single definition drives three things
 * so they can never drift apart:
 *   1. the CSV export column order + headers,
 *   2. the downloadable blank template,
 *   3. the set of fields the import wizard maps incoming columns onto.
 *
 * Each row in the table is ONE person. Household-level fields (side, list,
 * address, …) repeat on every member's row — that is the shape most couples
 * already keep their guest spreadsheet in, and it round-trips losslessly.
 */
export type GuestFieldKey =
  | 'household'
  | 'name'
  | 'kind'
  | 'rsvp'
  | 'meal'
  | 'dietary'
  | 'side'
  | 'group'
  | 'list'
  | 'inviteSent'
  | 'email'
  | 'address'
  | 'table'
  | 'notes';

export interface GuestField {
  key: GuestFieldKey;
  /** Column header shown in the exported CSV / template. */
  header: string;
  /** Whether this value lives on the person (member) or the invitation (household). */
  level: 'member' | 'household';
  /** Header aliases we recognise when auto-mapping an uploaded sheet. */
  aliases: string[];
}

export const GUEST_FIELDS: GuestField[] = [
  {
    key: 'household',
    header: 'Household',
    level: 'household',
    aliases: ['household', 'family', 'party', 'group name', 'invitation', 'invite', 'unit'],
  },
  {
    key: 'name',
    header: 'Name',
    level: 'member',
    aliases: ['name', 'full name', 'guest', 'guest name', 'first name', 'first', 'attendee', 'person'],
  },
  {
    key: 'kind',
    header: 'Adult/Child',
    level: 'member',
    aliases: ['adult/child', 'adult or child', 'type', 'age group', 'kid', 'child', 'age'],
  },
  {
    key: 'rsvp',
    header: 'RSVP',
    level: 'member',
    aliases: ['rsvp', 'attending', 'response', 'status', 'reply', 'coming', 'confirmed'],
  },
  {
    key: 'meal',
    header: 'Meal',
    level: 'member',
    aliases: ['meal', 'entree', 'entrée', 'dinner', 'food', 'menu', 'meal choice'],
  },
  {
    key: 'dietary',
    header: 'Dietary',
    level: 'member',
    aliases: ['dietary', 'dietary needs', 'allergies', 'restrictions', 'dietary restrictions', 'notes (food)'],
  },
  {
    key: 'side',
    header: 'Side',
    level: 'household',
    aliases: ['side', 'bride/groom', 'party side', 'whose side', 'his/hers', 'affiliation'],
  },
  {
    key: 'group',
    header: 'Relationship',
    level: 'household',
    aliases: ['relationship', 'group', 'category', 'relation', 'how we know them', 'connection'],
  },
  {
    key: 'list',
    header: 'List',
    level: 'household',
    aliases: ['list', 'tier', 'priority', 'a-list', 'invited/b-list', 'round'],
  },
  {
    key: 'inviteSent',
    header: 'Invite Sent',
    level: 'household',
    aliases: ['invite sent', 'invitation sent', 'sent', 'invited', 'mailed'],
  },
  {
    key: 'email',
    header: 'Email',
    level: 'household',
    aliases: ['email', 'e-mail', 'email address', 'contact email'],
  },
  {
    key: 'address',
    header: 'Address',
    level: 'household',
    aliases: ['address', 'mailing address', 'street', 'home address', 'postal address'],
  },
  {
    key: 'table',
    header: 'Table',
    level: 'household',
    aliases: ['table', 'table number', 'table name', 'seating', 'seat'],
  },
  {
    key: 'notes',
    header: 'Notes',
    level: 'household',
    aliases: ['notes', 'note', 'comments', 'remarks', 'misc'],
  },
];

export const GUEST_HEADERS = GUEST_FIELDS.map((f) => f.header);

// ---- Accepted values (used for normalising imported free-text) -------------
export const SIDES: GuestSide[] = ['Bride', 'Groom', 'Both'];
export const GROUPS: GuestGroup[] = [
  'Couple Friends',
  'Bride Family',
  'Groom Family',
  'Bride Friends',
  'Groom Friends',
  'Work',
  'Other',
];
export const LISTS: GuestList[] = ['Invited', 'B-list'];
export const RSVPS: GuestStatus[] = ['Yes', 'No', 'Waiting'];
export const KINDS: MemberKind[] = ['adult', 'child'];
