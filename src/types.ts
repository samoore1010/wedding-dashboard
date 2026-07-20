export type ThemeId = 'sage' | 'rose' | 'coastal' | 'burgundy' | 'modern';

export type GuestStatus = 'Yes' | 'No' | 'Waiting';
export type GuestSide = 'Both' | 'Bride' | 'Groom';
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
 * A single person. RSVP, meal, and dietary needs are tracked per person,
 * because at a real wedding those answers differ within one household.
 */
export interface Member {
  id: string;
  name: string;
  kind: MemberKind;
  rsvp: GuestStatus;
  meal: string;
  dietary: string;
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
  email: string;
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

export interface Vendor {
  id: string;
  type: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  stage: VendorStage;
  cost: string;
  notes: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
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
  seating: SeatingTable[];
  runOfShow: RunOfShowItem[];
  weekend: WeekendEvent[];
  registryCats: Record<string, RegistryItem[]>;
  registryChecked: Record<string, boolean>;
  giftTracker: Gift[];
  venues: Venue[];
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
  | 'venues'
  | 'moodboard'
  | 'checklist'
  | 'vendors'
  | 'seating'
  | 'timeline'
  | 'registry'
  | 'gifts'
  | 'honeymoon';
