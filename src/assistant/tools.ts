// Tool registry for the AI wedding-planning assistant.
//
// Each tool maps to one or more store actions. `read` tools run immediately;
// `write` tools are gated behind user approval (see agent.ts) and snapshotted
// for undo. Tool inputs are validated by the model against `input_schema`.

import { useStore } from '../store';
import type {
  GuestSide,
  GuestGroup,
  GuestStatus,
  MemberKind,
  VendorStage,
  SeatingTable,
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
          'budget',
          'vendors',
          'seating',
          'venues',
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
        email: str('Contact email for the invitation'),
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
      }));
      S().addHousehold({
        label: i.label || '',
        side: (i.side as GuestSide) || 'Both',
        group: (i.group as GuestGroup) || 'Couple Friends',
        email: i.email || '',
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
        email: str(),
        address: str(),
        inviteSent: bool(),
        notes: str(),
      },
      ['id']
    ),
    summarize: (i) => `Update household ${label('households', i.id)}`,
    run: (i) => {
      requireEntity('households', i.id);
      const { id, ...patch } = i;
      S().updateHousehold(id, clean(patch));
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
      });
      return `Added ${i.name} to "${label('households', i.householdId)}".`;
    },
  },
  {
    name: 'update_member',
    kind: 'write',
    description: 'Update one person: their name, adult/child, RSVP, meal, or dietary notes.',
    input_schema: obj(
      {
        householdId: str('Household id'),
        memberId: str('Member id (from get_dashboard)'),
        name: str(),
        kind: enumStr(KINDS),
        rsvp: enumStr(RSVPS),
        meal: enumStr(MEALS),
        dietary: str(),
      },
      ['householdId', 'memberId']
    ),
    summarize: (i) => `Update ${memberLabel(i.householdId, i.memberId)}`,
    run: (i) => {
      const { householdId, memberId, ...patch } = i;
      requireMember(householdId, memberId);
      S().updateMember(householdId, memberId, clean(patch));
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

  // ---------------------------------------------------------------- venues
  {
    name: 'add_venue',
    kind: 'write',
    description:
      'Add a venue under consideration. Fill in whatever details you have — this is ideal for ' +
      'saving details pulled from a venue website via web_fetch/web_search.',
    input_schema: obj(
      {
        name: str('Venue name'),
        location: str('City / area'),
        type: str('e.g. Barn, Ballroom, Winery'),
        capacity: str('Guest capacity'),
        fee: str('Site/rental fee'),
        perPlate: str('Per-plate catering cost'),
        totalCost: str('Estimated total cost'),
        contact: str('Contact info'),
        website: str('Website URL'),
        pros: str(),
        cons: str(),
        notes: str(),
      },
      ['name']
    ),
    summarize: (i) => `Add venue "${i.name}"${i.location ? ` — ${i.location}` : ''}`,
    run: (i) => {
      const before = S().venues;
      S().addVenue();
      const v = created(before, S().venues);
      if (v) S().updateVenue(v.id, clean(i));
      return `Added venue "${i.name}".`;
    },
  },
  {
    name: 'update_venue',
    kind: 'write',
    description: 'Update details on a saved venue.',
    input_schema: obj(
      {
        id: str(),
        name: str(),
        location: str(),
        type: str(),
        capacity: str(),
        fee: str(),
        perPlate: str(),
        totalCost: str(),
        contact: str(),
        website: str(),
        pros: str(),
        cons: str(),
        notes: str(),
      },
      ['id']
    ),
    summarize: (i) => `Update venue ${label('venues', i.id)}`,
    run: (i) => {
      requireEntity('venues', i.id);
      const { id, ...patch } = i;
      S().updateVenue(id, clean(patch));
      return `Updated venue "${label('venues', id)}".`;
    },
  },
  {
    name: 'delete_venue',
    kind: 'write',
    description: 'Remove a venue from consideration.',
    input_schema: obj({ id: str() }, ['id']),
    summarize: (i) => `Delete venue ${label('venues', i.id)}`,
    run: (i) => {
      const name = label('venues', i.id);
      requireEntity('venues', i.id);
      S().removeVenue(i.id);
      return `Removed venue "${name}".`;
    },
  },
  {
    name: 'set_favorite_venue',
    kind: 'write',
    description: 'Mark a venue as the favorite (clears other favorites).',
    input_schema: obj({ id: str() }, ['id']),
    summarize: (i) => `Mark ${label('venues', i.id)} as favorite venue`,
    run: (i) => {
      requireEntity('venues', i.id);
      S().setFavoriteVenue(i.id);
      return `Marked "${label('venues', i.id)}" as favorite.`;
    },
  },

  // ---------------------------------------------------------------- checklist
  {
    name: 'add_checklist_item',
    kind: 'write',
    description: 'Add a to-do item under a checklist phase. Create the phase first if it does not exist.',
    input_schema: obj({ phase: str('Phase name'), text: str('Task text') }, ['phase', 'text']),
    summarize: (i) => `Add checklist task "${i.text}" under "${i.phase}"`,
    run: (i) => {
      S().addCheckItem(i.phase, i.text);
      return `Added task "${i.text}" to "${i.phase}".`;
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

/** Drop undefined/null keys so patches don't overwrite fields with blanks. */
function clean<T extends Record<string, any>>(o: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) out[k] = v;
  return out;
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
          email: h.email,
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
    case 'venues':
      return { venues: s.venues };
    case 'checklist':
      return {
        phases: Object.entries(s.checklistItems).map(([phase, items]) => ({
          phase,
          items: items.map((it) => ({ id: it.id, text: it.text, done: !!s.checklist[it.id] })),
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
      const members = s.households.flatMap((h) => h.members);
      return {
        settings: s.settings,
        guests: {
          households: s.households.length,
          people: members.length,
          confirmed: members.filter((m) => m.rsvp === 'Yes').length,
          waiting: members.filter((m) => m.rsvp === 'Waiting').length,
          declined: members.filter((m) => m.rsvp === 'No').length,
        },
        budget: {
          total: s.budgetTotal,
          spent: Object.values(s.budgetSpent).reduce((a, b) => a + (Number(b) || 0), 0),
          categories: s.budgetCats.length,
        },
        vendors: { total: s.vendors.length, booked: s.vendors.filter((v) => v.stage === 'Booked' || v.stage === 'Paid in Full').length },
        seating: { tables: s.seating.length },
        venues: s.venues.length,
        sections: ['guests', 'budget', 'vendors', 'seating', 'venues', 'checklist', 'registry', 'gifts', 'honeymoon', 'timeline', 'settings'],
      };
    }
  }
}
