export type ThemeId = 'sage' | 'rose' | 'coastal' | 'burgundy' | 'modern';

export type GuestStatus = 'Yes' | 'No' | 'Waiting';
export type GuestSide = 'Both' | 'Bride' | 'Groom';
/** Whether a household is firmly invited or a backup to invite if space frees up. */
export type GuestList = 'Invited' | 'B-list';
export type GuestGroup =
  | 'Couple Friends'
  | 'Bride Family'
  | 'Groom Family'
  | 'Bride Friends'
  | 'Groom Friends'
  | 'Work'
  | 'Other';

export type MemberKind = 'adult' | 'child';

/**
 * A single person. RSVP, meal, dietary needs, and email are tracked per person,
 * because at a real wedding those answers differ within one household.
 */
export interface Member {
  id: string;
  name: string;
  kind: MemberKind;
  rsvp: GuestStatus;
  meal: string;
  dietary: string;
  /**
   * This person's own emails / phone numbers — people routinely have more than
   * one (work + personal, mobile + landline). The household keeps its own
   * separate contact lists for whoever the invitation is addressed to.
   */
  emails: string[];
  phones: string[];
}

/**
 * A household is one invitation — the unit you address an envelope to and
 * that gets seated together. It holds one or more {@link Member}s. Party size
 * is derived from `members.length`, never stored separately.
 */
export interface Household {
  id: string;
  /** Display label, e.g. "The Smith Family" or "Jane Doe". */
  label: string;
  side: GuestSide;
  group: GuestGroup;
  /** Firm invite, backup (invite if space frees up), or undecided. */
  list: GuestList;
  /** Contact details for the invitation itself; any number of each. */
  emails: string[];
  phones: string[];
  address: string;
  inviteSent: boolean;
  notes: string;
  /** Name of the table this household is seated at. Synced from the Seating tab. */
  table: string;
  members: Member[];
}

export interface BudgetCategory {
  id: string;
  name: string;
  pct: number;
}

export type VendorStage =
  | 'Not Started'
  | 'Researching'
  | 'Inquiry Sent'
  | 'Meeting Scheduled'
  | 'Proposal Received'
  | 'Booked'
  | 'Paid in Full';

/** A loose idea pinned to a vendor category before any names are in play. */
export interface VendorPin {
  id: string;
  /** Uploaded image src, if this pin is a screenshot / photo. */
  image: string;
  /** Instagram post, website, video… */
  url: string;
  caption: string;
}

/** A question to put to a vendor, and what they said. */
export interface VendorQuestion {
  id: string;
  text: string;
  answer: string;
  asked: boolean;
}

/** One dated entry in a vendor's contact history. */
export interface VendorLogEntry {
  id: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Called / Emailed / Met / Quote received … */
  kind: string;
  note: string;
}

/** A real business you're considering (or have booked) for a category. */
export interface VendorCandidate {
  id: string;
  name: string;
  /** Carried over when a pin is promoted into a candidate. */
  image: string;

  // --- while shortlisting
  /** 0 = unrated, otherwise 1–5. */
  rating: number;
  quote: string;
  available: 'Yes' | 'No' | 'Unknown';
  packageName: string;
  pros: string;
  cons: string;

  // --- contact
  contact: string;
  emails: string[];
  phones: string[];
  website: string;
  instagram: string;

  // --- money
  finalPrice: string;
  deposit: string;
  depositPaid: string;
  included: string;
  extras: string;

  // --- logistics, once booked
  contractSigned: string;
  arrivalTime: string;
  coverageHours: string;
  setupNeeds: string;
  cancellation: string;

  questions: VendorQuestion[];
  log: VendorLogEntry[];
  links: ChecklistLink[];
  notes: string;
}

/**
 * One vendor category (Photographer, DJ / Band…). It carries the whole arc of
 * the decision: loose ideas first, then candidates to compare, then the one
 * you book — whose details are mirrored onto the headline fields so the
 * tracker table, budget and assistant keep seeing a simple row.
 */
export interface Vendor {
  id: string;
  type: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  stage: VendorStage;
  cost: string;
  /** What you're going for — "DJ or band?", must-haves, open questions. */
  notes: string;

  pins: VendorPin[];
  candidates: VendorCandidate[];
  /** Candidate id you've booked, or '' while still deciding. */
  chosenId: string;
  /** Budget category this vendor is paid from; shown, never auto-applied. */
  budgetCatId: string;
}

export interface ChecklistLink {
  id: string;
  /** What to call the link; falls back to the URL when blank. */
  label: string;
  url: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  /** Free-form detail for the task, edited on its own page. */
  notes: string;
  links: ChecklistLink[];
  /** ISO yyyy-mm-dd, or '' for no date. */
  due: string;
}

// ---- Review call-outs ---------------------------------------------------
/**
 * Which half of the couple, by settings slot: `p1` is `brideName`, `p2` is
 * `groomName`. Stored as a slot rather than a name so renaming a partner in
 * Settings doesn't orphan every call-out addressed to them.
 */
export type PartnerId = 'p1' | 'p2';

export type ReviewStatus = 'open' | 'done';

/** What a call-out points at. `none` is a note with no record behind it. */
export type ReviewTargetKind = 'none' | 'checklist' | 'vendor';

/** Enough to reopen the record the call-out is about. */
export interface ReviewTarget {
  kind: ReviewTargetKind;
  /**
   * Ids the owning tab needs: `{ phase, itemId }` for a checklist task,
   * `{ vendorId }` for a vendor category. Empty when `kind` is `none`.
   */
  ref: Record<string, string>;
}

/**
 * One partner asking the other to go look at something. The pair plan in
 * parallel, so this is the hand-off: it names the record, says what to look
 * at, and stays open until the other person marks it reviewed.
 */
export interface ReviewRequest {
  id: string;
  /** Partner being asked to look. */
  to: PartnerId;
  /** Partner who asked. */
  from: PartnerId;
  /** Headline — usually the record's own name. */
  title: string;
  /** What you want them to look at or decide. */
  ask: string;
  /** Reference link, for a call-out not tied to a record. */
  url: string;
  target: ReviewTarget;
  status: ReviewStatus;
  /** What they said when they marked it reviewed. */
  reply: string;
  /** Epoch ms. `resolvedAt` is 0 while still open. */
  createdAt: number;
  resolvedAt: number;
}

export interface SeatingTable {
  id: string;
  name: string;
  type: 'sweetheart' | 'regular' | 'kings';
  /** IDs of Household records seated at this table. Each household occupies `members.length` seats. */
  guestIds: string[];
  capacity?: number;
  /** Legacy: free-text guest names. Migrated to guestIds in v2. Do not write. */
  guests?: string[];
}

export interface RunOfShowItem {
  id: string;
  time: string;
  event: string;
  detail: string;
}

export interface WeekendEvent {
  id: string;
  day: string;
  event: string;
  time: string;
  notes: string;
}

export interface RegistryItem {
  id: string;
  text: string;
  link?: string;
}

export interface Gift {
  id: string;
  from: string;
  item: string;
  type: 'Cash/Check' | 'Registry' | 'Other';
  received: string;
  thankYou: boolean;
  address: string;
}

export interface Venue {
  id: string;
  name: string;
  location: string;
  type: string;
  capacity: string;
  fee: string;
  fbMin: string;
  perPlate: string;
  totalCost: string;
  setting: string;
  catering: string;
  bar: string;
  availability: string;
  contact: string;
  website: string;
  parking: string;
  lodging: string;
  distance: string;
  ceremonyOnSite: string;
  rainPlan: string;
  restrictions: string;
  pros: string;
  cons: string;
  notes: string;
  favorite: boolean;
}

// ---- Wedding party ------------------------------------------------------
export type PartyAsk = 'Not yet' | 'Asked' | 'Confirmed' | 'Declined';

/** A customizable party group / column (e.g. "Drew's Party", "Other roles"). */
export interface PartyGroup {
  id: string;
  label: string;
}

/** A person in the wedding party. Usually linked to a guest member for name/sync. */
export interface PartyMember {
  id: string;
  groupId: string;
  /** Link to a guest member (empty for a manually-added person). */
  householdId: string;
  memberId: string;
  name: string;
  role: string;
  ask: PartyAsk;
  attireSize: string;
  attireStatus: string;
  gift: string;
  thankYou: boolean;
  contact: string;
  notes: string;
}

export interface WeddingParty {
  groups: PartyGroup[];
  members: PartyMember[];
}

// ---- Venue plan (single chosen venue) ----------------------------------
export type Audience = 'guest' | 'internal';

/** One labeled piece of venue info. `audience` decides if it exports to guests. */
export interface VenueField {
  id: string;
  label: string;
  value: string;
  audience: Audience;
  /** Render full-width in the editor (for longer values). */
  span?: boolean;
}

/** A nearby hotel / lodging option for guests. */
export interface VenueHotel {
  id: string;
  name: string;
  distance: string;
  price: string;
  phone: string;
  link: string;
  blockCode: string;
}

export type VenueSectionKind = 'fields' | 'hotels' | 'weekend';

/** A section/category in the venue plan. Fully user-editable (add/rename/delete). */
export interface VenueSection {
  id: string;
  icon: string;
  title: string;
  kind: VenueSectionKind;
  fields: VenueField[];
  /** Present when kind === 'hotels'. */
  hotels?: VenueHotel[];
}

/**
 * The venue planning hub. Not a fixed schema — a list of sections the user can
 * reshape freely. The guest guide exports whatever is tagged `guest`.
 */
export interface VenuePlan {
  venueName: string;
  sections: VenueSection[];
}

// ---- Bach party ---------------------------------------------------------
/** Where someone stands on coming. */
export type BachRsvp = 'Invited' | 'In' | 'Maybe' | 'Out';

/**
 * How a cost is divided. `total` is one bill for the group (a house rental)
 * and gets divided by the headcount; `perPerson` is already a per-head price
 * (a plane ticket) and is multiplied up for the trip total.
 */
export type BachSplit = 'total' | 'perPerson';

/** One line of a destination's cost, so the per-person price is derived, not typed. */
export interface BachCostLine {
  id: string;
  /** "Airbnb", "Flights", "Golf round"… */
  label: string;
  amount: number;
  split: BachSplit;
  /** The group eats the honoree's share of this line, splitting it among the payers. */
  coversHonoree: boolean;
  notes: string;
}

export type BachDestStatus = 'Idea' | 'Shortlist' | 'Booked' | 'Passed';

/** A place being considered for the trip, with everything needed to compare it. */
export interface BachDestination {
  id: string;
  /** "Nashville", "Scottsdale"… */
  name: string;
  location: string;
  status: BachDestStatus;
  /** Free text — dates are rarely firm while comparing ("Apr 17–19"). */
  dates: string;
  nights: string;
  /** "3.5 hr drive" / "direct flight, 2 hr". */
  travel: string;
  /** Where you'd stay — name, or paste a listing URL. */
  lodging: string;
  links: ChecklistLink[];
  costs: BachCostLine[];
  /**
   * Price this option as if N people were going, for before the roster is
   * firm. 0 means use the live count of who's in.
   */
  headcountEstimate: number;
  pros: string;
  cons: string;
  notes: string;
}

/**
 * Someone coming on the trip. They may be a wedding-party member, any guest,
 * or nobody on either list — a college roommate who isn't invited to the
 * wedding still comes to the bach party.
 */
export interface BachAttendee {
  id: string;
  name: string;
  /** Where the name and contact come from; 'none' means typed in here. */
  linkKind: 'party' | 'guest' | 'none';
  /** Set when linkKind is 'party'. */
  partyMemberId: string;
  /** Both set when linkKind is 'guest'. */
  householdId: string;
  memberId: string;
  /** Freeform, so the roster isn't limited to groomsmen — "Brother", "Work". */
  tag: string;
  rsvp: BachRsvp;
  contact: string;
  /** Money handed over so far. */
  paid: number;
  /** Replaces the computed share for someone with a different arrangement. */
  shareOverride: number | null;
  /** The guy the trip is for: counted in the headcount, owes nothing. */
  isHonoree: boolean;
  notes: string;
}

/** The bach party hub: options to compare, who's coming, and what it costs each of them. */
export interface BachParty {
  /** Renamable — defaults from the groom's name. */
  title: string;
  honoreeName: string;
  /** Free text, since the date usually follows the destination. */
  dates: string;
  /** Destination id that got booked, or '' while still deciding. */
  chosenId: string;
  /** Count Maybes in the headcount when pricing. */
  countMaybes: boolean;
  destinations: BachDestination[];
  attendees: BachAttendee[];
  notes: string;
}

export interface HoneymoonDay {
  id: string;
  day: number;
  title: string;
  desc: string;
}

export interface MoodBoardItem {
  id: string;
  /** Either a `/api/images/<id>` URL (cloud mode) or a base64 data URL (dev mode). */
  src: string;
  caption?: string;
  /** Optional grouping label, e.g. "Florals", "Color Palette". */
  section?: string;
}

export interface WeddingSettings {
  brideName: string;
  groomName: string;
  weddingDate: string; // ISO date string
  weddingTime: string; // HH:mm
  venueName: string;
  theme: ThemeId;
  currency: string;
}

export interface AppState {
  settings: WeddingSettings;
  budgetTotal: number;
  budgetCats: BudgetCategory[];
  budgetSpent: Record<string, number>;
  households: Household[];
  checklist: Record<string, boolean>;
  checklistItems: Record<string, ChecklistItem[]>;
  vendors: Vendor[];
  /** Open (and answered) "go look at this" hand-offs between the couple. */
  reviewRequests: ReviewRequest[];
  seating: SeatingTable[];
  runOfShow: RunOfShowItem[];
  weekend: WeekendEvent[];
  registryCats: Record<string, RegistryItem[]>;
  registryChecked: Record<string, boolean>;
  giftTracker: Gift[];
  /** Archived multi-venue comparison (pre-decision). Retained, not surfaced. */
  venues: Venue[];
  /** The active venue planning hub + guest-guide source. */
  venuePlan: VenuePlan;
  weddingParty: WeddingParty;
  /** Bach party planning: location ideas, the roster, and the per-person math. */
  bachParty: BachParty;
  honeymoonDays: HoneymoonDay[];
  notes: string;
  honeymoonNotes: string;
  packingList: string;
  honeymoonDestination?: string;
  honeymoonBudget?: number;
  moodBoard?: MoodBoardItem[];
}

export type TabId =
  | 'overview'
  | 'budget'
  | 'guests'
  | 'weddingparty'
  | 'bachparty'
  | 'venues'
  | 'moodboard'
  | 'checklist'
  | 'vendors'
  | 'seating'
  | 'timeline'
  | 'registry'
  | 'gifts'
  | 'honeymoon';
