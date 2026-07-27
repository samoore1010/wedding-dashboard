// Tool registry for the AI wedding-planning assistant.
//
// Each tool maps to one or more store actions. `read` tools run immediately;
// `write` tools are gated behind user approval (see agent.ts) and snapshotted
// for undo. Tool inputs are validated by the model against `input_schema`.

import { useStore } from '../store';
import { mergeContacts, toContacts } from '../guests/contacts';
import { uid } from '../utils';
import type {
  ChecklistLink,
  GuestSide,
  GuestGroup,
  GuestStatus,
  MemberKind,
  VendorStage,
  SeatingTable,
  Audience,
  VenueSection,
} from '../types';

export type ToolKind = 'read' | 'write';

export interface AssistantTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  kind: ToolKind;
  /** Short, human-readable description of the change, shown on the approval card. */
  summarize?: (input: any) => string;
  /** Execute the tool and return a result string for the model. Throws on bad input. */
  run: (input: any) => string;
}

const S = () => useStore.getState();

// Find the entity that exists in `after` but not `before` (i.e. just created).
function created<T extends { id: string }>(before: T[], after: T[]): T | undefined {
  const ids = new Set(before.map((x) => x.id));
  return after.find((x) => !ids.has(x.id));
}

const str = (d?: string) => ({ type: 'string', ...(d ? { description: d } : {}) });
const num = (d?: string) => ({ type: 'number', ...(d ? { description: d } : {}) });
const bool = (d?: string) => ({ type: 'boolean', ...(d ? { description: d } : {}) });
const strArr = (d?: string) => ({
  type: 'array',
  items: { type: 'string' },
  ...(d ? { description: d } : {}),
});
const enumStr = (values: readonly string[], d?: string) => ({
  type: 'string',
  enum: values,
  ...(d ? { description: d } : {}),
});
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});

const SIDES: GuestSide[] = ['Both', 'Bride', 'Groom'];
const GROUPS: GuestGroup[] = [
  'Couple Friends',
  'Bride Family',
  'Groom Family',
  'Bride Friends',
  'Groom Friends',
  'Work',
  'Other',
];
const RSVPS: GuestStatus[] = ['Yes', 'No', 'Waiting'];
const KINDS: MemberKind[] = ['adult', 'child'];
const MEALS = ['', 'Chicken', 'Beef', 'Fish', 'Vegetarian', 'Vegan', 'Kids'];
const VENDOR_STAGES: VendorStage[] = [
  'Not Started',
  'Researching',
  'Inquiry Sent',
  'Meeting Scheduled',
  'Proposal Received',
  'Booked',
  'Paid in Full',
];
const TABLE_TYPES: SeatingTable['type'][] = ['regular', 'kings', 'sweetheart'];

const memberSchema = obj(
  {
    name: str('Full name of the person'),
    kind: enumStr(KINDS, 'adult or child (default adult)'),
    rsvp: enumStr(RSVPS, 'RSVP status (default Waiting)'),
    meal: enumStr(MEALS, 'Meal choice, if known'),
    dietary: str('Dietary notes / allergies'),
    emails: strArr("This person's own email addresses — as many as are known"),
    phones: strArr("This person's own phone numbers — as many as are known"),
  },
  ['name']
);

export const TOOLS: AssistantTool[] = [
  // ---------------------------------------------------------------- read
  {
    name: 'get_dashboard',
    kind: 'read',
    description:
      'Read the current dashboard data so you know exact IDs, names, and values before making changes. ' +
      'Call this first whenever you need to reference or modify an existing entry. ' +
      'Omit `section` for a high-level overview of everything.',
    input_schema: obj({
      section: enumStr(
        [
          'overview',
          'guests',
          'party',
          'budget',
          'vendors',
          'seating',
          'venue',
          'checklist',
          'registry',
          'gifts',
          'honeymoon',
          'timeline',
          'settings',
        ],
        'Which part of the dashboard to read'
      ),
    }),
    run: (i) => JSON.stringify(readSection(i.section || 'overview')),
  },

  // ---------------------------------------------------------------- guests
  {
    name: 'add_household',
    kind: 'write',
    description:
      'Add a household (one invitation) with its people. A household groups people invited together and seated together. ' +
      'Party size is the number of members — do not ask for a separate count.',
    input_schema: obj(
      {
        label: str('Household label, e.g. "The Smith Family" or "Jane Doe"'),
        side: enumStr(SIDES, 'Bride, Groom, or Both'),
        group: enumStr(GROUPS, 'Relationship group'),
        list: enumStr(
          ['Invited', 'B-list'],
          'Invited (firm) or B-list (backup — invite if space frees up). Default Invited.'
        ),
        emails: strArr('Contact emails for the invitation'),
        phones: strArr('Contact phone numbers for the invitation'),
        address: str('Mailing address'),
        inviteSent: bool('Whether the invitation has been sent'),
        notes: str('Notes'),
        members: { type: 'array', items: memberSchema, description: 'People in this household' },
      },
      ['label', 'members']
    ),
    summarize: (i) =>
      `Add household "${i.label}" (${i.side || 'Both'}) with ${(i.members || []).length} ` +
      `${(i.members || []).length === 1 ? 'person' : 'people'}: ${(i.members || [])
        .map((m: any) => m.name)
        .join(', ')}`,
    run: (i) => {
      const members = (i.members || []).map((m: any) => ({
        name: m.name || '',
        kind: (m.kind as MemberKind) || 'adult',
        rsvp: (m.rsvp as GuestStatus) || 'Waiting',
        meal: m.meal || '',
        dietary: m.dietary || '',
        emails: toContacts(m.emails),
        phones: toContacts(m.phones),
      }));
      S().addHousehold({
        label: i.label || '',
        side: (i.side as GuestSide) || 'Both',
        group: (i.group as GuestGroup) || 'Couple Friends',
        list: (i.list as any) || 'Invited',
        emails: toContacts(i.emails),
        phones: toContacts(i.phones),
        address: i.address || '',
        inviteSent: !!i.inviteSent,
        notes: i.notes || '',
        members: members.length ? (members as any) : undefined,
      });
      return `Added household "${i.label}" with ${members.length} people.`;
    },
  },
  {
    name: 'update_household',
    kind: 'write',
    description: 'Update a household\'s details (not its members — use member tools for those).',
    input_schema: obj(
      {
        id: str('Household id (from get_dashboard)'),
        label: str(),
        side: enumStr(SIDES),
        group: enumStr(GROUPS),
        list: enumStr(['Invited', 'B-list'], 'Move to Invited / B-list'),
        emails: strArr('Replaces the household\'s email list — use set_contacts to add to it'),
        phones: strArr('Replaces the household\'s phone list — use set_contacts to add to it'),
        address: str(),
        inviteSent: bool(),
        notes: str(),
      },
      ['id']
    ),
    summarize: (i) =>
      i.list && Object.keys(i).length === 2
        ? `Move ${label('households', i.id)} to ${i.list}`
        : `Update household ${label('households', i.id)}`,
    run: (i) => {
      requireEntity('households', i.id);
      const { id, emails, phones, ...patch } = i;
      S().updateHousehold(id, clean({ ...patch, ...contactPatch(emails, phones) }));
      return `Updated household "${label('households', id)}".`;
    },
  },
  {
    name: 'delete_household',
    kind: 'write',
    description: 'Remove a household and everyone in it from the guest list.',
    input_schema: obj({ id: str('Household id') }, ['id']),
    summarize: (i) => `Delete household ${label('households', i.id)} and all its members`,
    run: (i) => {
      const name = label('households', i.id);
      requireEntity('households', i.id);
      S().removeHousehold(i.id);
      return `Removed household "${name}".`;
    },
  },
  {
    name: 'add_member',
    kind: 'write',
    description: 'Add a person to an existing household.',
    input_schema: obj(
      {
        householdId: str('Household id'),
        name: str('Full name'),
        kind: enumStr(KINDS),
        rsvp: enumStr(RSVPS),
        meal: enumStr(MEALS),
        dietary: str(),
        emails: strArr("This person's own email addresses"),
        phones: strArr("This person's own phone numbers"),
      },
      ['householdId', 'name']
    ),
    summarize: (i) => `Add ${i.name} to ${label('households', i.householdId)}`,
    run: (i) => {
      requireEntity('households', i.householdId);
      S().addMember(i.householdId, {
        name: i.name,
        kind: (i.kind as MemberKind) || 'adult',
        rsvp: (i.rsvp as GuestStatus) || 'Waiting',
        meal: i.meal || '',
        dietary: i.dietary || '',
        emails: toContacts(i.emails),
        phones: toContacts(i.phones),
      });
      return `Added ${i.name} to "${label('households', i.householdId)}".`;
    },
  },
  {
    name: 'update_member',
    kind: 'write',
    description:
      'Update one person: their name, adult/child, RSVP, meal, dietary notes, email, or phone.',
    input_schema: obj(
      {
        householdId: str('Household id'),
        memberId: str('Member id (from get_dashboard)'),
        name: str(),
        kind: enumStr(KINDS),
        rsvp: enumStr(RSVPS),
        meal: enumStr(MEALS),
        dietary: str(),
        emails: strArr("Replaces this person's email list — use set_contacts to add to it"),
        phones: strArr("Replaces this person's phone list — use set_contacts to add to it"),
      },
      ['householdId', 'memberId']
    ),
    summarize: (i) => `Update ${memberLabel(i.householdId, i.memberId)}`,
    run: (i) => {
      const { householdId, memberId, emails, phones, ...patch } = i;
      requireMember(householdId, memberId);
      S().updateMember(householdId, memberId, clean({ ...patch, ...contactPatch(emails, phones) }));
      return `Updated ${memberLabel(householdId, memberId)}.`;
    },
  },
  {
    name: 'delete_member',
    kind: 'write',
    description: 'Remove a person from a household.',
    input_schema: obj({ householdId: str(), memberId: str() }, ['householdId', 'memberId']),
    summarize: (i) => `Remove ${memberLabel(i.householdId, i.memberId)}`,
    run: (i) => {
      const name = memberLabel(i.householdId, i.memberId);
      requireMember(i.householdId, i.memberId);
      S().removeMember(i.householdId, i.memberId);
      return `Removed ${name}.`;
    },
  },
  {
    name: 'set_contacts',
    kind: 'write',
    description:
      'Fill in emails and phone numbers for many people and households in one step — use this when the couple ' +
      'uploads a spreadsheet of contact details rather than calling update_member once per person. ' +
      'Give a memberId to set that person\'s own contacts, or omit it to set the household\'s contacts. ' +
      'People and households can each hold any number of emails and numbers. ' +
      'Values are ADDED to whatever is already there (repeats are ignored); pass mode "replace" to overwrite instead. ' +
      'Get the ids from get_dashboard section "guests" first, and match spreadsheet rows to people by name.',
    input_schema: obj(
      {
        mode: enumStr(
          ['add', 'replace'],
          'add (default) keeps existing values and appends new ones; replace overwrites the list'
        ),
        entries: {
          type: 'array',
          description: 'One entry per person or household',
          items: obj(
            {
              householdId: str('Household id (from get_dashboard)'),
              memberId: str("Member id — omit to set the household's own contact details"),
              emails: strArr('Email addresses for this person / household'),
              phones: strArr('Phone numbers for this person / household'),
            },
            ['householdId']
          ),
        },
      },
      ['entries']
    ),
    summarize: (i) => {
      const entries: any[] = Array.isArray(i.entries) ? i.entries : [];
      const emails = entries.reduce((n, e) => n + toContacts(e.emails).length, 0);
      const phones = entries.reduce((n, e) => n + toContacts(e.phones).length, 0);
      const bits = [
        emails ? `${emails} ${emails === 1 ? 'email' : 'emails'}` : '',
        phones ? `${phones} ${phones === 1 ? 'number' : 'numbers'}` : '',
      ].filter(Boolean);
      const verb = i.mode === 'replace' ? 'Replace contacts on' : 'Add';
      return `${verb} ${bits.join(' and ') || 'contacts'}${
        i.mode === 'replace' ? '' : ' to'
      } ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    },
    run: (i) => {
      const entries: any[] = Array.isArray(i.entries) ? i.entries : [];
      if (!entries.length) throw new Error('No entries given.');
      const replace = i.mode === 'replace';
      let people = 0;
      let houses = 0;

      for (const e of entries) {
        const emails = e.emails === undefined ? undefined : toContacts(e.emails);
        const phones = e.phones === undefined ? undefined : toContacts(e.phones);
        if (!emails?.length && !phones?.length && !replace) continue;

        if (e.memberId) {
          requireMember(e.householdId, e.memberId);
          const m = S()
            .households.find((h) => h.id === e.householdId)!
            .members.find((x) => x.id === e.memberId)!;
          S().updateMember(
            e.householdId,
            e.memberId,
            clean({
              emails: emails && (replace ? emails : mergeContacts(m.emails, emails)),
              phones: phones && (replace ? phones : mergeContacts(m.phones, phones)),
            })
          );
          people++;
        } else {
          requireEntity('households', e.householdId);
          const h = S().households.find((x) => x.id === e.householdId)!;
          S().updateHousehold(
            e.householdId,
            clean({
              emails: emails && (replace ? emails : mergeContacts(h.emails, emails)),
              phones: phones && (replace ? phones : mergeContacts(h.phones, phones)),
            })
          );
          houses++;
        }
      }

      const parts = [
        people ? `${people} ${people === 1 ? 'person' : 'people'}` : '',
        houses ? `${houses} ${houses === 1 ? 'household' : 'households'}` : '',
      ].filter(Boolean);
      return parts.length
        ? `Updated contacts for ${parts.join(' and ')}.`
        : 'Nothing to update — no emails or numbers were given.';
    },
  },
  {
    name: 'seat_household',
    kind: 'write',
    description:
      'Seat a household at a table, or unseat it (pass tableId: null). Each household occupies ' +
      'one seat per member. Use get_dashboard section "seating" for table ids.',
    input_schema: obj(
      {
        householdId: str('Household id'),
        tableId: { type: ['string', 'null'], description: 'Table id, or null to unseat' },
      },
      ['householdId']
    ),
    summarize: (i) =>
      i.tableId
        ? `Seat ${label('households', i.householdId)} at ${label('seating', i.tableId)}`
        : `Unseat ${label('households', i.householdId)}`,
    run: (i) => {
      requireEntity('households', i.householdId);
      S().setGuestTable(i.householdId, i.tableId ?? null);
      return i.tableId
        ? `Seated "${label('households', i.householdId)}" at ${label('seating', i.tableId)}.`
        : `Unseated "${label('households', i.householdId)}".`;
    },
  },

  // ---------------------------------------------------------------- budget
  {
    name: 'set_budget_total',
    kind: 'write',
    description: 'Set the overall wedding budget total.',
    input_schema: obj({ amount: num('Total budget amount') }, ['amount']),
    summarize: (i) => `Set total budget to ${i.amount}`,
    run: (i) => {
      S().setBudgetTotal(Number(i.amount) || 0);
      return `Set budget total to ${i.amount}.`;
    },
  },
  {
    name: 'add_budget_category',
    kind: 'write',
    description: 'Add a budget category. `pct` is the percentage of the total budget allocated to it.',
    input_schema: obj({ name: str(), pct: num('Percent of total budget') }, ['name']),
    summarize: (i) => `Add budget category "${i.name}"${i.pct != null ? ` (${i.pct}%)` : ''}`,
    run: (i) => {
      const before = S().budgetCats;
      S().addBudgetCat();
      const c = created(before, S().budgetCats);
      if (c) S().updateBudgetCat(c.id, clean({ name: i.name, pct: i.pct }));
      return `Added budget category "${i.name}".`;
    },
  },
  {
    name: 'update_budget_category',
    kind: 'write',
    description: 'Rename a budget category or change its percentage allocation.',
    input_schema: obj({ id: str(), name: str(), pct: num() }, ['id']),
    summarize: (i) => `Update budget category ${label('budgetCats', i.id)}`,
    run: (i) => {
      requireEntity('budgetCats', i.id);
      const { id, ...patch } = i;
      S().updateBudgetCat(id, clean(patch));
      return `Updated budget category "${label('budgetCats', id)}".`;
    },
  },
  {
    name: 'delete_budget_category',
    kind: 'write',
    description: 'Remove a budget category.',
    input_schema: obj({ id: str() }, ['id']),
    summarize: (i) => `Delete budget category ${label('budgetCats', i.id)}`,
    run: (i) => {
      const name = label('budgetCats', i.id);
      requireEntity('budgetCats', i.id);
      S().removeBudgetCat(i.id);
      return `Removed budget category "${name}".`;
    },
  },
  {
    name: 'set_category_spent',
    kind: 'write',
    description: 'Record how much has actually been spent in a budget category.',
    input_schema: obj({ id: str('Budget category id'), amount: num() }, ['id', 'amount']),
    summarize: (i) => `Set spend for ${label('budgetCats', i.id)} to ${i.amount}`,
    run: (i) => {
      requireEntity('budgetCats', i.id);
      S().setBudgetSpent(i.id, Number(i.amount) || 0);
      return `Set spend for "${label('budgetCats', i.id)}" to ${i.amount}.`;
    },
  },

  // ---------------------------------------------------------------- vendors
  {
    name: 'add_vendor',
    kind: 'write',
    description: 'Add a vendor (photographer, florist, caterer, etc.).',
    input_schema: obj(
      {
        name: str('Business/vendor name'),
        type: str('Vendor type, e.g. Photographer, Florist, Caterer'),
        contact: str('Contact person'),
        phone: str(),
        email: str(),
        stage: enumStr(VENDOR_STAGES),
        cost: str('Quoted cost'),
        notes: str(),
      },
      ['name']
    ),
    summarize: (i) => `Add vendor "${i.name}"${i.type ? ` (${i.type})` : ''}`,
    run: (i) => {
      S().addVendor(
        clean({
          name: i.name,
          type: i.type || 'New Vendor',
          contact: i.contact,
          phone: i.phone,
          email: i.email,
          stage: i.stage,
          cost: i.cost,
          notes: i.notes,
        })
      );
      return `Added vendor "${i.name}".`;
    },
  },
  {
    name: 'update_vendor',
    kind: 'write',
    description: 'Update a vendor\'s details or booking stage.',
    input_schema: obj(
      {
        id: str(),
        name: str(),
        type: str(),
        contact: str(),
        phone: str(),
        email: str(),
        stage: enumStr(VENDOR_STAGES),
        cost: str(),
        notes: str(),
      },
      ['id']
    ),
    summarize: (i) => `Update vendor ${label('vendors', i.id)}`,
    run: (i) => {
      requireEntity('vendors', i.id);
      const { id, ...patch } = i;
      S().updateVendor(id, clean(patch));
      return `Updated vendor "${label('vendors', id)}".`;
    },
  },
  {
    name: 'delete_vendor',
    kind: 'write',
    description: 'Remove a vendor.',
    input_schema: obj({ id: str() }, ['id']),
    summarize: (i) => `Delete vendor ${label('vendors', i.id)}`,
    run: (i) => {
      const name = label('vendors', i.id);
      requireEntity('vendors', i.id);
      S().removeVendor(i.id);
      return `Removed vendor "${name}".`;
    },
  },

  // ---------------------------------------------------------------- seating
  {
    name: 'add_table',
    kind: 'write',
    description: 'Add a table to the seating chart.',
    input_schema: obj(
      {
        name: str('Table name, e.g. "Table 1" or "Head Table"'),
        type: enumStr(TABLE_TYPES, 'regular, kings, or sweetheart'),
        capacity: num('Number of seats'),
      },
      []
    ),
    summarize: (i) => `Add table "${i.name || 'Table'}"${i.capacity ? ` (seats ${i.capacity})` : ''}`,
    run: (i) => {
      S().addTable(
        clean({ name: i.name, type: i.type, capacity: i.capacity != null ? Number(i.capacity) : undefined })
      );
      return `Added table "${i.name || 'new table'}".`;
    },
  },
  {
    name: 'update_table',
    kind: 'write',
    description: 'Rename a table or change its type or capacity.',
    input_schema: obj({ id: str(), name: str(), type: enumStr(TABLE_TYPES), capacity: num() }, ['id']),
    summarize: (i) => `Update table ${label('seating', i.id)}`,
    run: (i) => {
      requireEntity('seating', i.id);
      const { id, ...patch } = i;
      if (patch.capacity != null) patch.capacity = Number(patch.capacity);
      S().updateTable(id, clean(patch));
      return `Updated table "${label('seating', id)}".`;
    },
  },
  {
    name: 'delete_table',
    kind: 'write',
    description: 'Remove a table. Anyone seated there is returned to the unseated list.',
    input_schema: obj({ id: str() }, ['id']),
    summarize: (i) => `Delete table ${label('seating', i.id)}`,
    run: (i) => {
      const name = label('seating', i.id);
      requireEntity('seating', i.id);
      S().removeTable(i.id);
      return `Removed table "${name}".`;
    },
  },

  // ---------------------------------------------------------------- venue plan
  // The venue plan is a flexible list of sections; each section has fields
  // (label + value + audience: guest|internal). Call get_dashboard('venue')
  // first to get section/field ids. Web search/fetch is ideal for filling
  // hotels, weather, directions, and things-to-do from the venue's website.
  {
    name: 'venue_add_section',
    kind: 'write',
    description: 'Add a new section/category to the venue plan (e.g. "Transportation", "Childcare").',
    input_schema: obj(
      {
        title: str('Section title'),
        icon: str('An emoji icon'),
        fields: {
          type: 'array',
          description: 'Optional initial fields',
          items: obj(
            { label: str(), value: str(), audience: enumStr(['guest', 'internal']) },
            ['label']
          ),
        },
      },
      ['title']
    ),
    summarize: (i) => `Add venue section "${i.title}"`,
    run: (i) => {
      const before = S().venuePlan.sections;
      S().addVenueSection({ title: i.title, icon: (i.icon || '✨').slice(0, 2), fields: [] });
      const sec = created(before, S().venuePlan.sections);
      if (sec && Array.isArray(i.fields)) {
        for (const f of i.fields)
          S().addVenueField(sec.id, {
            label: f.label,
            value: f.value || '',
            audience: (f.audience as Audience) || 'guest',
          });
      }
      return `Added section "${i.title}".`;
    },
  },
  {
    name: 'venue_update_section',
    kind: 'write',
    description: 'Rename a venue section or change its icon.',
    input_schema: obj({ sectionId: str(), title: str(), icon: str() }, ['sectionId']),
    summarize: (i) => `Update venue section ${venueSectionLabel(i.sectionId)}`,
    run: (i) => {
      requireVenueSection(i.sectionId);
      S().updateVenueSection(i.sectionId, clean({ title: i.title, icon: i.icon?.slice(0, 2) }));
      return `Updated section ${venueSectionLabel(i.sectionId)}.`;
    },
  },
  {
    name: 'venue_remove_section',
    kind: 'write',
    description: 'Delete a venue section and its fields.',
    input_schema: obj({ sectionId: str() }, ['sectionId']),
    summarize: (i) => `Delete venue section ${venueSectionLabel(i.sectionId)}`,
    run: (i) => {
      const name = venueSectionLabel(i.sectionId);
      requireVenueSection(i.sectionId);
      S().removeVenueSection(i.sectionId);
      return `Removed section ${name}.`;
    },
  },
  {
    name: 'venue_add_field',
    kind: 'write',
    description: 'Add a field (a labeled detail) to a venue section. Tag it guest or internal.',
    input_schema: obj(
      {
        sectionId: str('Section id from get_dashboard'),
        label: str('Field label'),
        value: str('Field value'),
        audience: enumStr(['guest', 'internal'], 'Who sees it (default guest)'),
      },
      ['sectionId', 'label']
    ),
    summarize: (i) =>
      `Add ${i.audience === 'internal' ? '🔒' : '🌐'} "${i.label}" to ${venueSectionLabel(i.sectionId)}`,
    run: (i) => {
      requireVenueSection(i.sectionId);
      S().addVenueField(i.sectionId, {
        label: i.label,
        value: i.value || '',
        audience: (i.audience as Audience) || 'guest',
      });
      return `Added "${i.label}".`;
    },
  },
  {
    name: 'venue_update_field',
    kind: 'write',
    description:
      "Update a venue field's label, value, or audience. Set audience to 'guest' to include it in " +
      "the guest guide, or 'internal' to keep it private.",
    input_schema: obj(
      {
        sectionId: str(),
        fieldId: str(),
        label: str(),
        value: str(),
        audience: enumStr(['guest', 'internal']),
      },
      ['sectionId', 'fieldId']
    ),
    summarize: (i) => `Update venue field ${venueFieldLabel(i.sectionId, i.fieldId)}`,
    run: (i) => {
      requireVenueField(i.sectionId, i.fieldId);
      S().updateVenueField(
        i.sectionId,
        i.fieldId,
        clean({ label: i.label, value: i.value, audience: i.audience })
      );
      return `Updated field.`;
    },
  },
  {
    name: 'venue_remove_field',
    kind: 'write',
    description: 'Remove a field from a venue section.',
    input_schema: obj({ sectionId: str(), fieldId: str() }, ['sectionId', 'fieldId']),
    summarize: (i) => `Remove venue field ${venueFieldLabel(i.sectionId, i.fieldId)}`,
    run: (i) => {
      requireVenueField(i.sectionId, i.fieldId);
      S().removeVenueField(i.sectionId, i.fieldId);
      return `Removed field.`;
    },
  },
  {
    name: 'venue_add_hotel',
    kind: 'write',
    description:
      'Add a nearby hotel/lodging option for guests. Great for saving results from web search. ' +
      'Adds to the "Where to stay" section automatically.',
    input_schema: obj(
      {
        name: str('Hotel name'),
        distance: str('Distance/time from venue'),
        price: str('Price per night'),
        phone: str(),
        link: str('Booking URL'),
        blockCode: str('Room-block code, if any'),
      },
      ['name']
    ),
    summarize: (i) => `Add hotel "${i.name}" to Where to stay`,
    run: (i) => {
      const sec = hotelsSection();
      if (!sec) throw new Error('No hotels section exists. Add a section with a hotels list first.');
      S().addVenueHotel(sec.id, clean(i));
      return `Added hotel "${i.name}".`;
    },
  },
  {
    name: 'venue_remove_hotel',
    kind: 'write',
    description: 'Remove a hotel from the Where-to-stay list.',
    input_schema: obj({ hotelId: str() }, ['hotelId']),
    summarize: (i) => `Remove hotel ${venueHotelLabel(i.hotelId)}`,
    run: (i) => {
      const sec = hotelsSection();
      if (!sec) throw new Error('No hotels section.');
      const name = venueHotelLabel(i.hotelId);
      S().removeVenueHotel(sec.id, i.hotelId);
      return `Removed hotel ${name}.`;
    },
  },

  // ---------------------------------------------------------------- wedding party
  // The party has customizable groups (columns) and members. Members usually
  // link to a guest via memberId. Call get_dashboard('party') for group/member
  // ids, and get_dashboard('guests') for guest member ids to link.
  {
    name: 'party_add_group',
    kind: 'write',
    description: 'Add a wedding-party group/column (e.g. a partner\'s party, or "Other honor roles").',
    input_schema: obj({ label: str('Group name') }, ['label']),
    summarize: (i) => `Add party group "${i.label}"`,
    run: (i) => {
      S().addPartyGroup(i.label);
      return `Added party group "${i.label}".`;
    },
  },
  {
    name: 'party_rename_group',
    kind: 'write',
    description: 'Rename a wedding-party group.',
    input_schema: obj({ groupId: str(), label: str() }, ['groupId', 'label']),
    summarize: (i) => `Rename party group to "${i.label}"`,
    run: (i) => {
      if (!S().weddingParty.groups.some((g) => g.id === i.groupId))
        throw new Error(`No party group "${i.groupId}".`);
      S().updatePartyGroup(i.groupId, { label: i.label });
      return `Renamed group to "${i.label}".`;
    },
  },
  {
    name: 'party_add_member',
    kind: 'write',
    description:
      'Add a person to a wedding-party group. Link to a guest by passing householdId + memberId ' +
      '(from get_dashboard("guests")), or just pass a name for someone not on the guest list.',
    input_schema: obj(
      {
        groupId: str('Party group id from get_dashboard("party")'),
        name: str('Person name (required if not linking a guest)'),
        householdId: str('Guest household id to link'),
        memberId: str('Guest member id to link'),
        role: str('e.g. Best Man, Person of Honor, Officiant'),
        ask: enumStr(['Not yet', 'Asked', 'Confirmed', 'Declined']),
      },
      ['groupId']
    ),
    summarize: (i) =>
      `Add ${i.name || guestMemberName(i.householdId, i.memberId) || 'a member'} to ${partyGroupLabel(i.groupId)}${
        i.role ? ` as ${i.role}` : ''
      }`,
    run: (i) => {
      if (!S().weddingParty.groups.some((g) => g.id === i.groupId))
        throw new Error(`No party group "${i.groupId}". Call get_dashboard("party").`);
      const name = i.name || guestMemberName(i.householdId, i.memberId);
      if (!name) throw new Error('Provide a name, or a valid householdId + memberId.');
      S().addPartyMember(i.groupId, {
        name,
        householdId: i.householdId || '',
        memberId: i.memberId || '',
        role: i.role || '',
        ask: (i.ask as any) || 'Not yet',
      });
      return `Added ${name} to the wedding party.`;
    },
  },
  {
    name: 'party_update_member',
    kind: 'write',
    description: "Update a party member's group, role, asked-status, attire, gift, thank-you, contact, or notes.",
    input_schema: obj(
      {
        id: str('Party member id'),
        groupId: str('Move to this group'),
        role: str(),
        ask: enumStr(['Not yet', 'Asked', 'Confirmed', 'Declined']),
        attireSize: str(),
        attireStatus: str(),
        gift: str(),
        thankYou: bool(),
        contact: str(),
        notes: str(),
      },
      ['id']
    ),
    summarize: (i) => `Update party member ${partyMemberLabel(i.id)}`,
    run: (i) => {
      if (!S().weddingParty.members.some((m) => m.id === i.id))
        throw new Error(`No party member "${i.id}".`);
      const { id, ...patch } = i;
      S().updatePartyMember(id, clean(patch));
      return `Updated ${partyMemberLabel(id)}.`;
    },
  },
  {
    name: 'party_remove_member',
    kind: 'write',
    description: 'Remove someone from the wedding party (they stay on the guest list).',
    input_schema: obj({ id: str() }, ['id']),
    summarize: (i) => `Remove ${partyMemberLabel(i.id)} from the wedding party`,
    run: (i) => {
      const name = partyMemberLabel(i.id);
      if (!S().weddingParty.members.some((m) => m.id === i.id))
        throw new Error(`No party member "${i.id}".`);
      S().removePartyMember(i.id);
      return `Removed ${name} from the wedding party.`;
    },
  },

  // ---------------------------------------------------------------- checklist
  {
    name: 'add_checklist_item',
    kind: 'write',
    description: 'Add a to-do item under a checklist phase. Create the phase first if it does not exist.',
    input_schema: obj(
      {
        phase: str('Phase name'),
        text: str('Task text'),
        notes: str('Longer detail for the task, shown on its own page'),
        due: str('Due date as yyyy-mm-dd'),
        links: {
          type: 'array',
          description: 'Reference links for the task',
          items: obj({ label: str('What the link is'), url: str('https://…') }, ['url']),
        },
      },
      ['phase', 'text']
    ),
    summarize: (i) => `Add checklist task "${i.text}" under "${i.phase}"`,
    run: (i) => {
      const id = S().addCheckItem(i.phase, i.text);
      S().updateCheckItem(i.phase, id, clean({ notes: i.notes, due: i.due, links: toLinks(i.links) }));
      return `Added task "${i.text}" to "${i.phase}".`;
    },
  },
  {
    name: 'update_checklist_item',
    kind: 'write',
    description:
      "Update a checklist task: rename it, or fill in the detail on its page — notes, a due date, reference links. " +
      'Links replace the existing list, so include any that should stay.',
    input_schema: obj(
      {
        id: str('Checklist item id (from get_dashboard section "checklist")'),
        text: str('New task name'),
        notes: str('Notes shown on the task page'),
        due: str('Due date as yyyy-mm-dd, or "" to clear'),
        links: {
          type: 'array',
          description: 'Replaces the task\'s links',
          items: obj({ label: str('What the link is'), url: str('https://…') }, ['url']),
        },
      },
      ['id']
    ),
    summarize: (i) => `Update checklist task "${checkItemLabel(i.id)}"`,
    run: (i) => {
      const phase = phaseOf(i.id);
      S().updateCheckItem(
        phase,
        i.id,
        clean({ text: i.text, notes: i.notes, due: i.due, links: toLinks(i.links) })
      );
      return `Updated checklist task "${checkItemLabel(i.id)}".`;
    },
  },
  {
    name: 'toggle_checklist_item',
    kind: 'write',
    description: 'Mark a checklist item done or not done.',
    input_schema: obj({ id: str('Checklist item id'), done: bool() }, ['id', 'done']),
    summarize: (i) => `Mark checklist item ${i.done ? 'done' : 'not done'}`,
    run: (i) => {
      S().toggleCheck(i.id, !!i.done);
      return `Marked checklist item ${i.done ? 'done' : 'not done'}.`;
    },
  },
  {
    name: 'add_checklist_phase',
    kind: 'write',
    description: 'Add a new checklist phase (a grouping of tasks).',
    input_schema: obj({ name: str() }, ['name']),
    summarize: (i) => `Add checklist phase "${i.name}"`,
    run: (i) => {
      S().addPhase(i.name);
      return `Added checklist phase "${i.name}".`;
    },
  },

  // ---------------------------------------------------------------- registry
  {
    name: 'add_registry_category',
    kind: 'write',
    description: 'Add a registry category (a grouping of registry items).',
    input_schema: obj({ name: str() }, ['name']),
    summarize: (i) => `Add registry category "${i.name}"`,
    run: (i) => {
      S().addRegCat(i.name);
      return `Added registry category "${i.name}".`;
    },
  },
  {
    name: 'add_registry_item',
    kind: 'write',
    description: 'Add an item to a registry category.',
    input_schema: obj(
      { category: str('Registry category name'), text: str('Item description'), link: str('URL') },
      ['category', 'text']
    ),
    summarize: (i) => `Add registry item "${i.text}" to "${i.category}"`,
    run: (i) => {
      S().addRegItem(i.category, i.text);
      if (i.link) {
        const items = S().registryCats[i.category] || [];
        const it = items[items.length - 1];
        if (it) S().updateRegItem(i.category, it.id, { link: i.link });
      }
      return `Added registry item "${i.text}".`;
    },
  },
  {
    name: 'toggle_registry_item',
    kind: 'write',
    description: 'Mark a registry item as purchased or not.',
    input_schema: obj({ id: str('Registry item id'), purchased: bool() }, ['id', 'purchased']),
    summarize: (i) => `Mark registry item ${i.purchased ? 'purchased' : 'not purchased'}`,
    run: (i) => {
      S().toggleRegChecked(i.id, !!i.purchased);
      return `Marked registry item ${i.purchased ? 'purchased' : 'not purchased'}.`;
    },
  },

  // ---------------------------------------------------------------- gifts
  {
    name: 'add_gift',
    kind: 'write',
    description: 'Record a gift received, for thank-you tracking.',
    input_schema: obj(
      {
        from: str('Who the gift is from'),
        item: str('What the gift is'),
        type: enumStr(['Cash/Check', 'Registry', 'Other']),
        received: str('Date received'),
        thankYou: bool('Whether a thank-you was sent'),
        address: str('Their mailing address'),
      },
      ['from', 'item']
    ),
    summarize: (i) => `Add gift from ${i.from}: "${i.item}"`,
    run: (i) => {
      const before = S().giftTracker;
      S().addGift();
      const g = created(before, S().giftTracker);
      if (g) S().updateGift(g.id, clean(i));
      return `Recorded gift from ${i.from}.`;
    },
  },
  {
    name: 'update_gift',
    kind: 'write',
    description: 'Update a recorded gift (e.g. mark the thank-you note sent).',
    input_schema: obj(
      {
        id: str(),
        from: str(),
        item: str(),
        type: enumStr(['Cash/Check', 'Registry', 'Other']),
        received: str(),
        thankYou: bool(),
        address: str(),
      },
      ['id']
    ),
    summarize: (i) => `Update gift ${label('giftTracker', i.id, 'from')}`,
    run: (i) => {
      requireEntity('giftTracker', i.id);
      const { id, ...patch } = i;
      S().updateGift(id, clean(patch));
      return `Updated gift.`;
    },
  },

  // ---------------------------------------------------------------- honeymoon
  {
    name: 'add_honeymoon_day',
    kind: 'write',
    description: 'Add a day to the honeymoon itinerary.',
    input_schema: obj({ title: str('Day title'), desc: str('What to do that day') }, []),
    summarize: (i) => `Add honeymoon day "${i.title || 'New day'}"`,
    run: (i) => {
      const before = S().honeymoonDays;
      S().addHDay();
      const d = created(before, S().honeymoonDays);
      if (d) S().updateHDay(d.id, clean({ title: i.title, desc: i.desc }));
      return `Added honeymoon day "${i.title || ''}".`;
    },
  },
  {
    name: 'update_honeymoon_day',
    kind: 'write',
    description: 'Update a honeymoon itinerary day.',
    input_schema: obj({ id: str(), title: str(), desc: str() }, ['id']),
    summarize: (i) => `Update honeymoon day ${label('honeymoonDays', i.id, 'title')}`,
    run: (i) => {
      requireEntity('honeymoonDays', i.id);
      const { id, ...patch } = i;
      S().updateHDay(id, clean(patch));
      return `Updated honeymoon day.`;
    },
  },
  {
    name: 'set_honeymoon_details',
    kind: 'write',
    description: 'Set honeymoon destination, budget, notes, or packing list.',
    input_schema: obj({
      destination: str(),
      budget: num(),
      notes: str(),
      packingList: str(),
    }),
    summarize: (i) =>
      `Update honeymoon ${[
        i.destination != null && 'destination',
        i.budget != null && 'budget',
        i.notes != null && 'notes',
        i.packingList != null && 'packing list',
      ]
        .filter(Boolean)
        .join(', ')}`,
    run: (i) => {
      if (i.destination != null) S().setHoneymoonDestination(i.destination);
      if (i.budget != null) S().setHoneymoonBudget(Number(i.budget) || 0);
      if (i.notes != null) S().setHoneymoonNotes(i.notes);
      if (i.packingList != null) S().setPackingList(i.packingList);
      return `Updated honeymoon details.`;
    },
  },

  // ---------------------------------------------------------------- timeline
  {
    name: 'add_run_of_show_item',
    kind: 'write',
    description: 'Add an item to the wedding-day run of show (timeline).',
    input_schema: obj(
      { event: str('What happens'), time: str('Time, e.g. "4:00 PM"'), detail: str() },
      ['event']
    ),
    summarize: (i) => `Add timeline item "${i.event}"${i.time ? ` at ${i.time}` : ''}`,
    run: (i) => {
      const before = S().runOfShow;
      S().addROS();
      const r = created(before, S().runOfShow);
      if (r) S().updateROS(r.id, clean({ event: i.event, time: i.time, detail: i.detail }));
      return `Added timeline item "${i.event}".`;
    },
  },
  {
    name: 'add_weekend_event',
    kind: 'write',
    description: 'Add a weekend event (rehearsal dinner, brunch, etc.).',
    input_schema: obj(
      { event: str(), day: str('e.g. Friday, Saturday, Sunday'), time: str(), notes: str() },
      ['event']
    ),
    summarize: (i) => `Add weekend event "${i.event}"${i.day ? ` (${i.day})` : ''}`,
    run: (i) => {
      const before = S().weekend;
      S().addWeekend();
      const w = created(before, S().weekend);
      if (w) S().updateWeekend(w.id, clean({ event: i.event, day: i.day, time: i.time, notes: i.notes }));
      return `Added weekend event "${i.event}".`;
    },
  },

  // ---------------------------------------------------------------- settings
  {
    name: 'update_settings',
    kind: 'write',
    description: 'Update core wedding settings: names, date, time, venue name, or currency.',
    input_schema: obj({
      brideName: str(),
      groomName: str(),
      weddingDate: str('ISO date, YYYY-MM-DD'),
      weddingTime: str('24h time, HH:mm'),
      venueName: str(),
      currency: str('Currency symbol, e.g. $'),
    }),
    summarize: (i) => `Update settings: ${Object.keys(clean(i)).join(', ')}`,
    run: (i) => {
      S().updateSettings(clean(i));
      return `Updated wedding settings.`;
    },
  },
];

export const TOOL_BY_NAME: Record<string, AssistantTool> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t])
);

/** Compact overview of the whole dashboard, for the system prompt. */
export function dashboardSummary() {
  return readSection('overview');
}

/** Tool definitions in Anthropic's tool schema (name/description/input_schema only). */
export function anthropicToolDefs() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

// ---- helpers ------------------------------------------------------------

/** Normalise contact lists for a patch, leaving unmentioned ones untouched. */
function contactPatch(emails: unknown, phones: unknown) {
  return {
    emails: emails === undefined ? undefined : toContacts(emails),
    phones: phones === undefined ? undefined : toContacts(phones),
  };
}

/** Drop undefined/null keys so patches don't overwrite fields with blanks. */
function clean<T extends Record<string, any>>(o: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}

/** Which phase holds a checklist item — the store keys tasks by phase. */
function phaseOf(itemId: string): string {
  const entries = Object.entries(S().checklistItems);
  const hit = entries.find(([, items]) => items.some((it) => it.id === itemId));
  if (!hit) {
    throw new Error(`No checklist item with id "${itemId}". Call get_dashboard section "checklist".`);
  }
  return hit[0];
}

function checkItemLabel(itemId: string): string {
  for (const items of Object.values(S().checklistItems)) {
    const hit = items.find((it) => it.id === itemId);
    if (hit) return hit.text;
  }
  return itemId;
}

/** Normalise assistant-supplied links, giving each one an id. */
function toLinks(links: unknown): ChecklistLink[] | undefined {
  if (!Array.isArray(links)) return undefined;
  return links
    .filter((l: any) => l && String(l.url ?? '').trim())
    .map((l: any) => ({ id: 'l_' + uid(), label: String(l.label ?? ''), url: String(l.url).trim() }));
}

function requireEntity(key: 'households' | 'budgetCats' | 'vendors' | 'seating' | 'venues' | 'giftTracker' | 'honeymoonDays', id: string) {
  const list = (S() as any)[key] as Array<{ id: string }>;
  if (!list.some((x) => x.id === id)) {
    throw new Error(`No ${key} entry with id "${id}". Call get_dashboard to get valid ids.`);
  }
}

function requireMember(householdId: string, memberId: string) {
  const h = S().households.find((x) => x.id === householdId);
  if (!h) throw new Error(`No household with id "${householdId}".`);
  if (!h.members.some((m) => m.id === memberId))
    throw new Error(`No member "${memberId}" in household "${householdId}".`);
}

function label(key: string, id: string, field = 'name'): string {
  const list = (S() as any)[key] as Array<Record<string, any>> | undefined;
  const found = list?.find((x) => x.id === id);
  if (!found) return `"${id}"`;
  if (key === 'households') return `"${found.label || found.members?.[0]?.name || id}"`;
  return `"${found[field] ?? found.label ?? id}"`;
}

function memberLabel(householdId: string, memberId: string): string {
  const h = S().households.find((x) => x.id === householdId);
  const m = h?.members.find((x) => x.id === memberId);
  return m ? `"${m.name || 'unnamed'}"` : `"${memberId}"`;
}

// ---- venue-plan helpers ----
function venueSection(id: string): VenueSection | undefined {
  return S().venuePlan.sections.find((s) => s.id === id);
}
function hotelsSection(): VenueSection | undefined {
  return S().venuePlan.sections.find((s) => s.kind === 'hotels');
}
function requireVenueSection(id: string) {
  if (!venueSection(id)) throw new Error(`No venue section "${id}". Call get_dashboard("venue") for ids.`);
}
function requireVenueField(sectionId: string, fieldId: string) {
  const sec = venueSection(sectionId);
  if (!sec) throw new Error(`No venue section "${sectionId}".`);
  if (!sec.fields.some((f) => f.id === fieldId)) throw new Error(`No field "${fieldId}" in that section.`);
}
function venueSectionLabel(id: string): string {
  return `"${venueSection(id)?.title ?? id}"`;
}
function venueFieldLabel(sectionId: string, fieldId: string): string {
  const f = venueSection(sectionId)?.fields.find((x) => x.id === fieldId);
  return `"${f?.label ?? fieldId}"`;
}
function venueHotelLabel(hotelId: string): string {
  for (const s of S().venuePlan.sections) {
    const h = (s.hotels ?? []).find((x) => x.id === hotelId);
    if (h) return `"${h.name || hotelId}"`;
  }
  return `"${hotelId}"`;
}

// ---- wedding-party helpers ----
function guestMemberName(householdId?: string, memberId?: string): string {
  if (!householdId || !memberId) return '';
  const h = S().households.find((x) => x.id === householdId);
  return h?.members.find((m) => m.id === memberId)?.name || '';
}
function partyGroupLabel(id: string): string {
  return `"${S().weddingParty.groups.find((g) => g.id === id)?.label ?? id}"`;
}
function partyMemberName(m: { memberId: string; householdId: string; name: string }): string {
  return guestMemberName(m.householdId, m.memberId) || m.name;
}
function partyMemberLabel(id: string): string {
  const m = S().weddingParty.members.find((x) => x.id === id);
  return m ? `"${partyMemberName(m) || 'unnamed'}"` : `"${id}"`;
}

// ---- dashboard reads ----------------------------------------------------

function readSection(section: string): unknown {
  const s = S();
  switch (section) {
    case 'guests':
      return {
        households: s.households.map((h) => ({
          id: h.id,
          label: h.label,
          side: h.side,
          group: h.group,
          list: h.list ?? 'Invited',
          emails: h.emails,
          phones: h.phones,
          inviteSent: h.inviteSent,
          table: h.table,
          notes: h.notes,
          members: h.members.map((m) => ({
            id: m.id,
            name: m.name,
            kind: m.kind,
            rsvp: m.rsvp,
            meal: m.meal,
            dietary: m.dietary,
            emails: m.emails,
            phones: m.phones,
          })),
        })),
      };
    case 'budget':
      return {
        total: s.budgetTotal,
        currency: s.settings.currency,
        categories: s.budgetCats.map((c) => ({
          id: c.id,
          name: c.name,
          pct: c.pct,
          spent: s.budgetSpent[c.id] ?? 0,
        })),
      };
    case 'vendors':
      return { vendors: s.vendors };
    case 'seating':
      return {
        tables: s.seating.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          capacity: t.capacity,
          seated: (t.guestIds ?? []).map((gid) => ({
            id: gid,
            label: s.households.find((h) => h.id === gid)?.label ?? gid,
          })),
        })),
        unseated: s.households
          .filter((h) => (h.label || h.members.some((m) => m.name)) && !s.seating.some((t) => (t.guestIds ?? []).includes(h.id)))
          .map((h) => ({ id: h.id, label: h.label, size: h.members.length })),
      };
    case 'party':
      return {
        groups: s.weddingParty.groups.map((g) => ({ id: g.id, label: g.label })),
        members: s.weddingParty.members.map((m) => ({
          id: m.id,
          groupId: m.groupId,
          name: partyMemberName(m),
          role: m.role,
          ask: m.ask,
          attireSize: m.attireSize,
          attireStatus: m.attireStatus,
          gift: m.gift,
          thankYou: m.thankYou,
        })),
      };
    case 'venue':
      return {
        venueName: s.venuePlan.venueName,
        sections: s.venuePlan.sections.map((sec) => ({
          id: sec.id,
          title: sec.title,
          icon: sec.icon,
          kind: sec.kind,
          fields: sec.fields.map((f) => ({
            id: f.id,
            label: f.label,
            value: f.value,
            audience: f.audience,
          })),
          ...(sec.kind === 'hotels' ? { hotels: sec.hotels ?? [] } : {}),
        })),
        weekendSchedule: s.weekend.map((w) => ({ day: w.day, event: w.event, time: w.time })),
      };
    case 'checklist':
      return {
        phases: Object.entries(s.checklistItems).map(([phase, items]) => ({
          phase,
          items: items.map((it) => ({
            id: it.id,
            text: it.text,
            done: !!s.checklist[it.id],
            notes: it.notes,
            due: it.due,
            links: it.links,
          })),
        })),
      };
    case 'registry':
      return {
        categories: Object.entries(s.registryCats).map(([cat, items]) => ({
          category: cat,
          items: items.map((it) => ({
            id: it.id,
            text: it.text,
            link: it.link,
            purchased: !!s.registryChecked[it.id],
          })),
        })),
      };
    case 'gifts':
      return { gifts: s.giftTracker };
    case 'honeymoon':
      return {
        destination: s.honeymoonDestination,
        budget: s.honeymoonBudget,
        notes: s.honeymoonNotes,
        packingList: s.packingList,
        days: s.honeymoonDays,
      };
    case 'timeline':
      return { runOfShow: s.runOfShow, weekend: s.weekend };
    case 'settings':
      return s.settings;
    case 'overview':
    default: {
      const invited = s.households.filter((h) => (h.list ?? 'Invited') === 'Invited');
      const members = invited.flatMap((h) => h.members);
      return {
        settings: s.settings,
        guests: {
          households: invited.length,
          people: members.length,
          confirmed: members.filter((m) => m.rsvp === 'Yes').length,
          waiting: members.filter((m) => m.rsvp === 'Waiting').length,
          declined: members.filter((m) => m.rsvp === 'No').length,
          bListPeople: s.households.filter((h) => h.list === 'B-list').reduce((a, h) => a + h.members.length, 0),
        },
        budget: {
          total: s.budgetTotal,
          spent: Object.values(s.budgetSpent).reduce((a, b) => a + (Number(b) || 0), 0),
          categories: s.budgetCats.length,
        },
        vendors: { total: s.vendors.length, booked: s.vendors.filter((v) => v.stage === 'Booked' || v.stage === 'Paid in Full').length },
        seating: { tables: s.seating.length },
        weddingParty: { members: s.weddingParty.members.length, groups: s.weddingParty.groups.length },
        venue: { name: s.venuePlan.venueName || s.settings.venueName, sections: s.venuePlan.sections.length },
        sections: ['guests', 'party', 'budget', 'vendors', 'seating', 'venue', 'checklist', 'registry', 'gifts', 'honeymoon', 'timeline', 'settings'],
      };
    }
  }
}
