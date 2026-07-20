import type { PartyGroup, PartyMember, WeddingParty, WeddingSettings } from './types';
import { uid } from './utils';

export const makePartyGroup = (label = 'New group'): PartyGroup => ({ id: 'pg_' + uid(), label });

export const makePartyMember = (patch?: Partial<PartyMember>): PartyMember => ({
  id: 'pm_' + uid(),
  groupId: '',
  householdId: '',
  memberId: '',
  name: '',
  role: '',
  ask: 'Not yet',
  attireSize: '',
  attireStatus: '',
  gift: '',
  thankYou: false,
  contact: '',
  notes: '',
  ...patch,
});

/** Default groups — labeled from the couple's names when available. */
export function defaultWeddingParty(settings?: Partial<WeddingSettings>): WeddingParty {
  const a = settings?.brideName?.trim();
  const b = settings?.groomName?.trim();
  return {
    groups: [
      makePartyGroup(a ? `${a}'s Party` : 'Party 1'),
      makePartyGroup(b ? `${b}'s Party` : 'Party 2'),
      makePartyGroup('Other honor roles'),
    ],
    members: [],
  };
}

export const PARTY_ROLES = [
  'Person of Honor',
  'Maid of Honor',
  'Matron of Honor',
  'Best Man',
  'Bridesmaid',
  'Groomsman',
  'Attendant',
  'Usher',
  'Officiant',
  'Ring Bearer',
  'Flower Attendant',
  'Reader',
  'Parent',
  'Grandparent',
];

export const ATTIRE_STATUSES = ['Not started', 'Measured', 'Ordered', 'Fitted', 'Received'];
