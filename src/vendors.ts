import { uid } from './utils';
import type { Vendor, VendorCandidate, VendorLogEntry, VendorPin, VendorQuestion } from './types';

/** Stock questions worth asking almost any vendor, offered on a new candidate. */
export const STARTER_QUESTIONS = [
  'Are you available on our date?',
  "What's included in the price, and what costs extra?",
  'What deposit do you need, and when is the balance due?',
  'What happens if you have to cancel?',
  'How many weddings do you take on in a weekend?',
];

export const LOG_KINDS = ['Called', 'Emailed', 'Met', 'Quote received', 'Other'];

export const makeVendorPin = (patch?: Partial<VendorPin>): VendorPin => ({
  id: 'vp_' + uid(),
  image: '',
  url: '',
  caption: '',
  ...patch,
});

export const makeVendorQuestion = (patch?: Partial<VendorQuestion>): VendorQuestion => ({
  id: 'vq_' + uid(),
  text: '',
  answer: '',
  asked: false,
  ...patch,
});

export const makeVendorLogEntry = (patch?: Partial<VendorLogEntry>): VendorLogEntry => ({
  id: 'vl_' + uid(),
  date: '',
  kind: 'Called',
  note: '',
  ...patch,
});

export const makeVendorCandidate = (patch?: Partial<VendorCandidate>): VendorCandidate => ({
  id: 'vc_' + uid(),
  name: '',
  image: '',
  rating: 0,
  quote: '',
  available: 'Unknown',
  packageName: '',
  pros: '',
  cons: '',
  contact: '',
  emails: [],
  phones: [],
  website: '',
  instagram: '',
  finalPrice: '',
  deposit: '',
  depositPaid: '',
  included: '',
  extras: '',
  contractSigned: '',
  arrivalTime: '',
  coverageHours: '',
  setupNeeds: '',
  cancellation: '',
  questions: [],
  log: [],
  links: [],
  notes: '',
  ...patch,
});

/**
 * The headline fields the tracker table, budget and assistant read. They mirror
 * whichever candidate is booked, so nothing downstream has to know about the
 * category page's ideas and shortlist.
 */
export const headlineFrom = (v: Vendor): Pick<Vendor, 'name' | 'contact' | 'phone' | 'email' | 'cost'> => {
  const chosen = v.candidates.find((c) => c.id === v.chosenId);
  if (!chosen) return { name: v.name, contact: v.contact, phone: v.phone, email: v.email, cost: v.cost };
  return {
    name: chosen.name,
    contact: chosen.contact,
    phone: chosen.phones[0] ?? '',
    email: chosen.emails[0] ?? '',
    cost: chosen.finalPrice || chosen.quote,
  };
};

/** Short summary of where a category has got to, shown on the tracker row. */
export const vendorProgress = (v: Vendor): string => {
  const chosen = v.candidates.find((c) => c.id === v.chosenId);
  if (chosen) return chosen.name || 'Booked';
  if (v.candidates.length) {
    return `${v.candidates.length} ${v.candidates.length === 1 ? 'candidate' : 'candidates'}`;
  }
  if (v.pins.length) return `${v.pins.length} ${v.pins.length === 1 ? 'idea' : 'ideas'}`;
  return '';
};
