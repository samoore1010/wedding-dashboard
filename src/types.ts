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

export interface Guest {
  id: string;
  name: string;
  group: GuestGroup;
  side: GuestSide;
  status: GuestStatus;
  qty: number;
  meal: string;
  table: string;
  notes: string;
  email?: string;
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
  guests: string[];
  capacity?: number;
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
  guests: Guest[];
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
}

export type TabId =
  | 'overview'
  | 'budget'
  | 'guests'
  | 'venues'
  | 'checklist'
  | 'vendors'
  | 'seating'
  | 'timeline'
  | 'registry'
  | 'gifts'
  | 'honeymoon';
