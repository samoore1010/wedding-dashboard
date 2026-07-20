import type { Audience, Venue, VenueField, VenuePlan, VenueSection, VenueSectionKind } from './types';
import { uid } from './utils';

export const makeVenueField = (patch?: Partial<VenueField>): VenueField => ({
  id: 'vf_' + uid(),
  label: '',
  value: '',
  audience: 'guest',
  ...patch,
});

export const makeVenueHotel = (patch?: Partial<import('./types').VenueHotel>) => ({
  id: 'vh_' + uid(),
  name: '',
  distance: '',
  price: '',
  phone: '',
  link: '',
  blockCode: '',
  ...patch,
});

export const makeVenueSection = (patch?: Partial<VenueSection>): VenueSection => ({
  id: 'vs_' + uid(),
  icon: '✨',
  title: 'New section',
  kind: 'fields',
  fields: [],
  ...patch,
});

const f = (label: string, value: string, audience: Audience = 'guest', span = false): VenueField =>
  makeVenueField({ label, value, audience, span });

const section = (
  icon: string,
  title: string,
  kind: VenueSectionKind,
  fields: VenueField[],
  hotels?: VenueSection['hotels']
): VenueSection => makeVenueSection({ icon, title, kind, fields, ...(hotels ? { hotels } : {}) });

/**
 * The default venue-plan template. Pre-fills from a chosen `Venue` (the
 * archived comparison record) where an obvious mapping exists. Every field is
 * fully editable afterward — this is a starting point, not a fixed schema.
 */
export function defaultVenuePlan(source?: Venue): VenuePlan {
  const v = source;
  return {
    venueName: v?.name || '',
    sections: [
      section('📍', 'The Venue', 'fields', [
        f('Venue name', v?.name || '', 'guest'),
        f('Date & time', '', 'guest'),
        f('Address', v?.location || '', 'guest', true),
        f('About', '', 'guest', true),
      ]),
      section('🚗', 'Getting there & parking', 'fields', [
        f('Guest parking', v?.parking || '', 'guest'),
        f('Shuttle / transport', '', 'guest'),
        f('Rideshare', '', 'guest'),
        f('Accessibility', '', 'guest'),
        f('Vendor load-in', '', 'internal'),
      ]),
      section('💍', 'Ceremony & reception', 'fields', [
        f('Ceremony', v?.ceremonyOnSite ? `On-site: ${v.ceremonyOnSite}` : '', 'guest'),
        f('Reception', '', 'guest'),
        f('Rain plan', v?.rainPlan || '', 'internal'),
        f('Noise curfew', '', 'internal'),
      ]),
      section(
        '🛏️',
        'Where to stay',
        'hotels',
        [
          f('On-site lodging', v?.lodging || '', 'guest'),
          f('On-site is for', '', 'internal'),
        ],
        []
      ),
      section('🌤️', 'Weather & what to wear', 'fields', [
        f('Typical weather', '', 'guest', true),
        f('Dress code', '', 'guest'),
        f('What to pack', '', 'guest'),
      ]),
      section('🗓️', 'Weekend & things to do', 'weekend', [
        f('Things to do nearby', '', 'guest', true),
      ]),
      section('🔧', 'Day-of logistics', 'fields', [
        f("What's included", v?.catering || '', 'internal'),
        f('Bar', v?.bar || '', 'internal'),
        f('Restrictions', v?.restrictions || '', 'internal'),
        f('Site fee', v?.fee || '', 'internal'),
        f('Per plate', v?.perPlate || '', 'internal'),
        f('Total est. cost', v?.totalCost || '', 'internal'),
        f('Notes', [v?.notes, v?.pros].filter(Boolean).join(' · '), 'internal', true),
      ]),
      section('📇', 'Contacts', 'fields', [
        f('Day-of questions (guests)', '', 'guest'),
        f('Venue coordinator', v?.contact || '', 'internal'),
        f('Planner', '', 'internal'),
      ]),
    ],
  };
}
