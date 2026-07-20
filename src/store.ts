import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { cloudStorage, isCloudMode } from './cloudStorage';
import type {
  AppState,
  Gift,
  Household,
  Member,
  HoneymoonDay,
  MoodBoardItem,
  RegistryItem,
  RunOfShowItem,
  SeatingTable,
  Vendor,
  Venue,
  VenueField,
  VenueHotel,
  VenueSection,
  PartyGroup,
  PartyMember,
  WeekendEvent,
  WeddingSettings,
  BudgetCategory,
  ChecklistItem,
  GuestStatus,
} from './types';
import { DEFAULT_STATE } from './defaults';
import { defaultVenuePlan, makeVenueField, makeVenueHotel, makeVenueSection } from './venuePlan';
import { defaultWeddingParty, makePartyGroup, makePartyMember } from './weddingParty';
import { uid } from './utils';

const makeMember = (patch?: Partial<Member>): Member => ({
  id: 'm_' + uid(),
  name: '',
  kind: 'adult',
  rsvp: 'Waiting',
  meal: '',
  dietary: '',
  ...patch,
});

// Data slices captured for undo — everything the assistant can mutate.
const UNDO_DATA_KEYS = [
  'settings',
  'budgetTotal',
  'budgetCats',
  'budgetSpent',
  'households',
  'checklist',
  'checklistItems',
  'vendors',
  'seating',
  'runOfShow',
  'weekend',
  'registryCats',
  'registryChecked',
  'giftTracker',
  'venues',
  'venuePlan',
  'weddingParty',
  'honeymoonDays',
  'notes',
  'honeymoonNotes',
  'packingList',
  'honeymoonDestination',
  'honeymoonBudget',
  'moodBoard',
] as const;

export interface UndoEntry {
  id: string;
  label: string;
  ts: number;
  data: Partial<AppState>;
}

interface UndoState {
  /** Most-recent-first stack of pre-change snapshots. Not persisted. */
  undoStack: UndoEntry[];
  /** Snapshot current data before a change and return the entry id. */
  pushUndo: (label: string) => string;
  /** Restore a snapshot (latest by default). Also drops any newer snapshots. */
  undo: (id?: string) => void;
}

interface Actions {
  // Settings
  updateSettings: (patch: Partial<WeddingSettings>) => void;

  // Budget
  setBudgetTotal: (n: number) => void;
  updateBudgetCat: (id: string, patch: Partial<BudgetCategory>) => void;
  addBudgetCat: () => void;
  removeBudgetCat: (id: string) => void;
  setBudgetSpent: (id: string, value: number) => void;

  // Guests (households of members)
  addHousehold: (household?: Partial<Household>) => string;
  updateHousehold: (id: string, patch: Partial<Household>) => void;
  removeHousehold: (id: string) => void;
  addMember: (householdId: string, member?: Partial<Member>) => void;
  updateMember: (householdId: string, memberId: string, patch: Partial<Member>) => void;
  removeMember: (householdId: string, memberId: string) => void;

  // Checklist
  toggleCheck: (id: string, value?: boolean) => void;
  addCheckItem: (phase: string, text: string) => void;
  updateCheckItem: (phase: string, id: string, text: string) => void;
  removeCheckItem: (phase: string, id: string) => void;
  addPhase: (name: string) => void;
  removePhase: (name: string) => void;

  // Vendors
  addVendor: (v?: Partial<Vendor>) => void;
  updateVendor: (id: string, patch: Partial<Vendor>) => void;
  removeVendor: (id: string) => void;

  // Seating
  addTable: (t?: Partial<SeatingTable>) => void;
  updateTable: (id: string, patch: Partial<SeatingTable>) => void;
  removeTable: (id: string) => void;
  /** Seat a household at a table (or unseat with tableId=null). Keeps Household.table in sync. */
  setGuestTable: (guestId: string, tableId: string | null) => void;

  // Run of Show
  addROS: () => void;
  updateROS: (id: string, patch: Partial<RunOfShowItem>) => void;
  removeROS: (id: string) => void;
  reorderROS: (orderedIds: string[]) => void;
  sortROSByTime: () => void;

  // Weekend
  addWeekend: () => void;
  updateWeekend: (id: string, patch: Partial<WeekendEvent>) => void;
  removeWeekend: (id: string) => void;

  // Registry
  addRegCat: (name: string) => void;
  removeRegCat: (name: string) => void;
  addRegItem: (cat: string, text: string) => void;
  updateRegItem: (cat: string, id: string, patch: Partial<RegistryItem>) => void;
  removeRegItem: (cat: string, id: string) => void;
  toggleRegChecked: (id: string, value?: boolean) => void;

  // Gifts
  addGift: () => void;
  updateGift: (id: string, patch: Partial<Gift>) => void;
  removeGift: (id: string) => void;

  // Venues (archived comparison)
  addVenue: () => void;
  updateVenue: (id: string, patch: Partial<Venue>) => void;
  removeVenue: (id: string) => void;
  setFavoriteVenue: (id: string) => void;

  // Venue plan (active planning hub)
  addVenueSection: (section?: Partial<VenueSection>) => void;
  updateVenueSection: (id: string, patch: Partial<VenueSection>) => void;
  removeVenueSection: (id: string) => void;
  moveVenueSection: (id: string, dir: -1 | 1) => void;
  addVenueField: (sectionId: string, field?: Partial<VenueField>) => void;
  updateVenueField: (sectionId: string, fieldId: string, patch: Partial<VenueField>) => void;
  removeVenueField: (sectionId: string, fieldId: string) => void;
  addVenueHotel: (sectionId: string, hotel?: Partial<VenueHotel>) => void;
  updateVenueHotel: (sectionId: string, hotelId: string, patch: Partial<VenueHotel>) => void;
  removeVenueHotel: (sectionId: string, hotelId: string) => void;

  // Wedding party
  addPartyGroup: (label?: string) => string;
  updatePartyGroup: (id: string, patch: Partial<PartyGroup>) => void;
  removePartyGroup: (id: string) => void;
  addPartyMember: (groupId: string, member?: Partial<PartyMember>) => string;
  updatePartyMember: (id: string, patch: Partial<PartyMember>) => void;
  removePartyMember: (id: string) => void;
  /** Move a member to a group, optionally before another member (for ordering). */
  movePartyMember: (id: string, toGroupId: string, beforeId?: string | null) => void;

  // Honeymoon
  addHDay: () => void;
  updateHDay: (id: string, patch: Partial<HoneymoonDay>) => void;
  removeHDay: (id: string) => void;
  setHoneymoonNotes: (s: string) => void;
  setPackingList: (s: string) => void;
  setHoneymoonDestination: (s: string) => void;
  setHoneymoonBudget: (n: number) => void;

  // Mood Board
  addMoodImage: (item: Omit<MoodBoardItem, 'id'>) => MoodBoardItem;
  updateMoodImage: (id: string, patch: Partial<MoodBoardItem>) => void;
  removeMoodImage: (id: string) => void;

  // Notes
  setNotes: (s: string) => void;

  // Bulk
  importState: (s: AppState) => void;
  resetState: () => void;
}

export const useStore = create<AppState & Actions & UndoState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      undoStack: [],
      pushUndo: (label) => {
        const id = 'u_' + uid();
        const s = get();
        const data: Partial<AppState> = {};
        for (const k of UNDO_DATA_KEYS) {
          (data as any)[k] = structuredClone((s as any)[k]);
        }
        set((st) => ({
          undoStack: [{ id, label, ts: Date.now(), data }, ...st.undoStack].slice(0, 25),
        }));
        return id;
      },
      undo: (id) =>
        set((st) => {
          const idx = id ? st.undoStack.findIndex((e) => e.id === id) : 0;
          if (idx < 0) return {} as any;
          const entry = st.undoStack[idx];
          const restored: any = {};
          for (const k of UNDO_DATA_KEYS) {
            if (k in entry.data) restored[k] = (entry.data as any)[k];
          }
          return { ...restored, undoStack: st.undoStack.slice(idx + 1) };
        }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      setBudgetTotal: (n) => set({ budgetTotal: n }),
      updateBudgetCat: (id, patch) =>
        set((s) => ({
          budgetCats: s.budgetCats.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      addBudgetCat: () =>
        set((s) => ({
          budgetCats: [
            ...s.budgetCats,
            { id: 'bc_' + uid(), name: 'New Category', pct: 0 },
          ],
        })),
      removeBudgetCat: (id) =>
        set((s) => {
          const next = { ...s.budgetSpent };
          delete next[id];
          return {
            budgetCats: s.budgetCats.filter((c) => c.id !== id),
            budgetSpent: next,
          };
        }),
      setBudgetSpent: (id, value) =>
        set((s) => ({ budgetSpent: { ...s.budgetSpent, [id]: value } })),

      addHousehold: (household) => {
        const id = 'g_' + uid();
        // Normalize any provided members through makeMember so each gets an id
        // and defaults — callers (UI, assistant) may pass bare member objects.
        const members =
          household?.members && household.members.length
            ? household.members.map((m) => makeMember(m))
            : [makeMember()];
        set((s) => ({
          households: [
            ...s.households,
            {
              id,
              label: '',
              group: 'Couple Friends',
              side: 'Both',
              email: '',
              address: '',
              inviteSent: false,
              notes: '',
              table: '',
              ...household,
              members,
            },
          ],
        }));
        return id;
      },
      updateHousehold: (id, patch) =>
        set((s) => ({
          households: s.households.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),
      removeHousehold: (id) =>
        set((s) => ({
          households: s.households.filter((h) => h.id !== id),
          seating: s.seating.map((t) => ({
            ...t,
            guestIds: (t.guestIds ?? []).filter((gid) => gid !== id),
          })),
          weddingParty: {
            ...s.weddingParty,
            members: s.weddingParty.members.filter((m) => m.householdId !== id),
          },
        })),
      addMember: (householdId, member) =>
        set((s) => ({
          households: s.households.map((h) =>
            h.id === householdId
              ? { ...h, members: [...h.members, makeMember(member)] }
              : h
          ),
        })),
      updateMember: (householdId, memberId, patch) =>
        set((s) => ({
          households: s.households.map((h) =>
            h.id === householdId
              ? {
                  ...h,
                  members: h.members.map((m) =>
                    m.id === memberId ? { ...m, ...patch } : m
                  ),
                }
              : h
          ),
        })),
      removeMember: (householdId, memberId) =>
        set((s) => ({
          households: s.households.map((h) =>
            h.id === householdId
              ? { ...h, members: h.members.filter((m) => m.id !== memberId) }
              : h
          ),
          weddingParty: {
            ...s.weddingParty,
            members: s.weddingParty.members.filter((m) => m.memberId !== memberId),
          },
        })),

      toggleCheck: (id, value) =>
        set((s) => ({
          checklist: {
            ...s.checklist,
            [id]: value !== undefined ? value : !s.checklist[id],
          },
        })),
      addCheckItem: (phase, text) =>
        set((s) => {
          const list = s.checklistItems[phase] || [];
          const item: ChecklistItem = { id: phase + '_' + uid(), text: text.trim() };
          return {
            checklistItems: { ...s.checklistItems, [phase]: [...list, item] },
          };
        }),
      updateCheckItem: (phase, id, text) =>
        set((s) => ({
          checklistItems: {
            ...s.checklistItems,
            [phase]: (s.checklistItems[phase] || []).map((it) =>
              it.id === id ? { ...it, text } : it
            ),
          },
        })),
      removeCheckItem: (phase, id) =>
        set((s) => ({
          checklistItems: {
            ...s.checklistItems,
            [phase]: (s.checklistItems[phase] || []).filter((it) => it.id !== id),
          },
        })),
      addPhase: (name) =>
        set((s) => ({
          checklistItems: { ...s.checklistItems, [name]: s.checklistItems[name] || [] },
        })),
      removePhase: (name) =>
        set((s) => {
          const next = { ...s.checklistItems };
          delete next[name];
          return { checklistItems: next };
        }),

      addVendor: (v) =>
        set((s) => ({
          vendors: [
            ...s.vendors,
            {
              id: 'v_' + uid(),
              type: 'New Vendor',
              name: '',
              contact: '',
              phone: '',
              email: '',
              stage: 'Not Started',
              cost: '',
              notes: '',
              ...v,
            },
          ],
        })),
      updateVendor: (id, patch) =>
        set((s) => ({
          vendors: s.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      removeVendor: (id) =>
        set((s) => ({ vendors: s.vendors.filter((v) => v.id !== id) })),

      addTable: (t) =>
        set((s) => ({
          seating: [
            ...s.seating,
            {
              id: 's_' + uid(),
              name: 'Table ' + s.seating.length,
              type: 'regular',
              guestIds: [],
              capacity: 8,
              ...t,
            },
          ],
        })),
      updateTable: (id, patch) =>
        set((s) => {
          const newSeating = s.seating.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          );
          // If the table was renamed, propagate the new name to every Guest seated there
          if (patch.name !== undefined) {
            const updated = newSeating.find((t) => t.id === id);
            const seatedIds = new Set(updated?.guestIds ?? []);
            return {
              seating: newSeating,
              households: s.households.map((h) =>
                seatedIds.has(h.id) ? { ...h, table: updated?.name ?? '' } : h
              ),
            };
          }
          return { seating: newSeating };
        }),
      removeTable: (id) =>
        set((s) => {
          const tbl = s.seating.find((t) => t.id === id);
          const orphaned = new Set(tbl?.guestIds ?? []);
          return {
            seating: s.seating.filter((t) => t.id !== id),
            households: s.households.map((h) =>
              orphaned.has(h.id) ? { ...h, table: '' } : h
            ),
          };
        }),
      setGuestTable: (guestId, tableId) =>
        set((s) => {
          // Pull the guest off any table they may already be on
          const cleared = s.seating.map((t) => ({
            ...t,
            guestIds: (t.guestIds ?? []).filter((id) => id !== guestId),
          }));
          let tableName = '';
          let next = cleared;
          if (tableId) {
            next = cleared.map((t) =>
              t.id === tableId
                ? { ...t, guestIds: [...t.guestIds, guestId] }
                : t
            );
            tableName = next.find((t) => t.id === tableId)?.name ?? '';
          }
          return {
            seating: next,
            households: s.households.map((h) =>
              h.id === guestId ? { ...h, table: tableName } : h
            ),
          };
        }),

      addROS: () =>
        set((s) => ({
          runOfShow: [
            ...s.runOfShow,
            { id: 'r_' + uid(), time: '', event: 'New Event', detail: '' },
          ],
        })),
      updateROS: (id, patch) =>
        set((s) => ({
          runOfShow: s.runOfShow.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeROS: (id) =>
        set((s) => ({ runOfShow: s.runOfShow.filter((r) => r.id !== id) })),
      reorderROS: (orderedIds) =>
        set((s) => {
          const map = new Map(s.runOfShow.map((r) => [r.id, r]));
          return {
            runOfShow: orderedIds
              .map((id) => map.get(id))
              .filter(Boolean) as RunOfShowItem[],
          };
        }),
      sortROSByTime: () =>
        set((s) => {
          const items = [...s.runOfShow];
          const toMin = (t: string) => {
            const m = t.trim().match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
            if (!m) return Number.MAX_SAFE_INTEGER;
            let h = parseInt(m[1], 10);
            const min = m[2] ? parseInt(m[2], 10) : 0;
            const ampm = m[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return h * 60 + min;
          };
          items.sort((a, b) => toMin(a.time) - toMin(b.time));
          return { runOfShow: items };
        }),

      addWeekend: () =>
        set((s) => ({
          weekend: [
            ...s.weekend,
            { id: 'w_' + uid(), day: 'Friday', event: '', time: '', notes: '' },
          ],
        })),
      updateWeekend: (id, patch) =>
        set((s) => ({
          weekend: s.weekend.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),
      removeWeekend: (id) =>
        set((s) => ({ weekend: s.weekend.filter((w) => w.id !== id) })),

      addRegCat: (name) =>
        set((s) => ({
          registryCats: { ...s.registryCats, [name]: s.registryCats[name] || [] },
        })),
      removeRegCat: (name) =>
        set((s) => {
          const next = { ...s.registryCats };
          delete next[name];
          return { registryCats: next };
        }),
      addRegItem: (cat, text) =>
        set((s) => ({
          registryCats: {
            ...s.registryCats,
            [cat]: [
              ...(s.registryCats[cat] || []),
              { id: 'reg_' + uid(), text: text.trim() },
            ],
          },
        })),
      updateRegItem: (cat, id, patch) =>
        set((s) => ({
          registryCats: {
            ...s.registryCats,
            [cat]: (s.registryCats[cat] || []).map((it) =>
              it.id === id ? { ...it, ...patch } : it
            ),
          },
        })),
      removeRegItem: (cat, id) =>
        set((s) => ({
          registryCats: {
            ...s.registryCats,
            [cat]: (s.registryCats[cat] || []).filter((it) => it.id !== id),
          },
        })),
      toggleRegChecked: (id, value) =>
        set((s) => ({
          registryChecked: {
            ...s.registryChecked,
            [id]: value !== undefined ? value : !s.registryChecked[id],
          },
        })),

      addGift: () =>
        set((s) => ({
          giftTracker: [
            ...s.giftTracker,
            {
              id: 'gift_' + uid(),
              from: '',
              item: '',
              type: 'Cash/Check',
              received: '',
              thankYou: false,
              address: '',
            },
          ],
        })),
      updateGift: (id, patch) =>
        set((s) => ({
          giftTracker: s.giftTracker.map((g) =>
            g.id === id ? { ...g, ...patch } : g
          ),
        })),
      removeGift: (id) =>
        set((s) => ({ giftTracker: s.giftTracker.filter((g) => g.id !== id) })),

      addVenue: () =>
        set((s) => ({
          venues: [
            ...s.venues,
            {
              id: 'ven_' + uid(),
              name: '',
              location: '',
              type: '',
              capacity: '',
              fee: '',
              fbMin: '',
              perPlate: '',
              totalCost: '',
              setting: '',
              catering: '',
              bar: '',
              availability: '',
              contact: '',
              website: '',
              parking: '',
              lodging: '',
              distance: '',
              ceremonyOnSite: '',
              rainPlan: '',
              restrictions: '',
              pros: '',
              cons: '',
              notes: '',
              favorite: false,
            },
          ],
        })),
      updateVenue: (id, patch) =>
        set((s) => ({
          venues: s.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      removeVenue: (id) =>
        set((s) => ({ venues: s.venues.filter((v) => v.id !== id) })),
      setFavoriteVenue: (id) =>
        set((s) => ({
          venues: s.venues.map((v) =>
            v.id === id ? { ...v, favorite: !v.favorite } : { ...v, favorite: false }
          ),
        })),

      // --- Venue plan ---
      addVenueSection: (section) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: [...s.venuePlan.sections, makeVenueSection({ fields: [makeVenueField()], ...section })],
          },
        })),
      updateVenueSection: (id, patch) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
          },
        })),
      removeVenueSection: (id) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.filter((sec) => sec.id !== id),
          },
        })),
      moveVenueSection: (id, dir) =>
        set((s) => {
          const secs = [...s.venuePlan.sections];
          const i = secs.findIndex((x) => x.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= secs.length) return {} as any;
          [secs[i], secs[j]] = [secs[j], secs[i]];
          return { venuePlan: { ...s.venuePlan, sections: secs } };
        }),
      addVenueField: (sectionId, field) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) =>
              sec.id === sectionId ? { ...sec, fields: [...sec.fields, makeVenueField(field)] } : sec
            ),
          },
        })),
      updateVenueField: (sectionId, fieldId, patch) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, fields: sec.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
                : sec
            ),
          },
        })),
      removeVenueField: (sectionId, fieldId) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) =>
              sec.id === sectionId ? { ...sec, fields: sec.fields.filter((f) => f.id !== fieldId) } : sec
            ),
          },
        })),
      addVenueHotel: (sectionId, hotel) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, hotels: [...(sec.hotels ?? []), makeVenueHotel(hotel)] }
                : sec
            ),
          },
        })),
      updateVenueHotel: (sectionId, hotelId, patch) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, hotels: (sec.hotels ?? []).map((h) => (h.id === hotelId ? { ...h, ...patch } : h)) }
                : sec
            ),
          },
        })),
      removeVenueHotel: (sectionId, hotelId) =>
        set((s) => ({
          venuePlan: {
            ...s.venuePlan,
            sections: s.venuePlan.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, hotels: (sec.hotels ?? []).filter((h) => h.id !== hotelId) }
                : sec
            ),
          },
        })),

      // --- Wedding party ---
      addPartyGroup: (label) => {
        const g = makePartyGroup(label || 'New group');
        set((s) => ({ weddingParty: { ...s.weddingParty, groups: [...s.weddingParty.groups, g] } }));
        return g.id;
      },
      updatePartyGroup: (id, patch) =>
        set((s) => ({
          weddingParty: {
            ...s.weddingParty,
            groups: s.weddingParty.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          },
        })),
      removePartyGroup: (id) =>
        set((s) => ({
          weddingParty: {
            groups: s.weddingParty.groups.filter((g) => g.id !== id),
            members: s.weddingParty.members.filter((m) => m.groupId !== id),
          },
        })),
      addPartyMember: (groupId, member) => {
        const m = makePartyMember({ groupId, ...member });
        set((s) => ({ weddingParty: { ...s.weddingParty, members: [...s.weddingParty.members, m] } }));
        return m.id;
      },
      updatePartyMember: (id, patch) =>
        set((s) => ({
          weddingParty: {
            ...s.weddingParty,
            members: s.weddingParty.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          },
        })),
      removePartyMember: (id) =>
        set((s) => ({
          weddingParty: {
            ...s.weddingParty,
            members: s.weddingParty.members.filter((m) => m.id !== id),
          },
        })),
      movePartyMember: (id, toGroupId, beforeId) =>
        set((s) => {
          const members = [...s.weddingParty.members];
          const idx = members.findIndex((m) => m.id === id);
          if (idx < 0) return {} as any;
          const [orig] = members.splice(idx, 1);
          const moved = { ...orig, groupId: toGroupId };
          let insertAt: number;
          if (beforeId) {
            const bi = members.findIndex((x) => x.id === beforeId);
            insertAt = bi >= 0 ? bi : members.length;
          } else {
            let last = -1;
            members.forEach((x, i) => {
              if (x.groupId === toGroupId) last = i;
            });
            insertAt = last + 1;
          }
          members.splice(insertAt, 0, moved);
          return { weddingParty: { ...s.weddingParty, members } };
        }),

      addHDay: () =>
        set((s) => ({
          honeymoonDays: [
            ...s.honeymoonDays,
            {
              id: 'h_' + uid(),
              day: s.honeymoonDays.length + 1,
              title: 'Day ' + (s.honeymoonDays.length + 1),
              desc: 'Plan your activities',
            },
          ],
        })),
      updateHDay: (id, patch) =>
        set((s) => ({
          honeymoonDays: s.honeymoonDays.map((d) =>
            d.id === id ? { ...d, ...patch } : d
          ),
        })),
      removeHDay: (id) =>
        set((s) => {
          const next = s.honeymoonDays
            .filter((d) => d.id !== id)
            .map((d, i) => ({ ...d, day: i + 1 }));
          return { honeymoonDays: next };
        }),
      setHoneymoonNotes: (s2) => set({ honeymoonNotes: s2 }),
      setPackingList: (s2) => set({ packingList: s2 }),
      setHoneymoonDestination: (s2) => set({ honeymoonDestination: s2 }),
      setHoneymoonBudget: (n) => set({ honeymoonBudget: n }),

      addMoodImage: (item) => {
        const next: MoodBoardItem = { id: 'mb_' + uid(), ...item };
        set((s) => ({ moodBoard: [...(s.moodBoard ?? []), next] }));
        return next;
      },
      updateMoodImage: (id, patch) =>
        set((s) => ({
          moodBoard: (s.moodBoard ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMoodImage: (id) =>
        set((s) => ({ moodBoard: (s.moodBoard ?? []).filter((m) => m.id !== id) })),

      setNotes: (s2) => set({ notes: s2 }),

      importState: (s2) => set(s2),
      resetState: () => set(DEFAULT_STATE),
    }),
    {
      name: 'wedding-dashboard-v1',
      version: 5,
      // Undo history is session-only — never sync it to the server/localStorage.
      partialize: (s) => {
        const { undoStack: _u, ...rest } = s as any;
        return rest;
      },
      storage: isCloudMode()
        ? createJSONStorage(() => cloudStorage)
        : createJSONStorage(() => localStorage),
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        // v2: SeatingTable.guests (string[]) -> SeatingTable.guestIds (Guest.id[])
        if (version < 2) {
          const guestsByName = new Map<string, string>();
          for (const g of persisted.guests ?? []) {
            const key = (g.name ?? '').trim().toLowerCase();
            if (key) guestsByName.set(key, g.id);
          }
          persisted.seating = (persisted.seating ?? []).map((t: any) => {
            const ids: string[] = [];
            for (const name of t.guests ?? []) {
              const id = guestsByName.get((name ?? '').trim().toLowerCase());
              if (id && !ids.includes(id)) ids.push(id);
            }
            return { ...t, guestIds: ids };
          });
        }
        // v3: flat Guest[] (party + companion name strings) -> Household[] of Members.
        // Each old guest becomes one household; its primary name + companions become
        // members. The household id is preserved so Seating.guestIds still resolves.
        if (version < 3) {
          const deriveLabel = (name: string, size: number): string => {
            const n = (name ?? '').trim();
            if (!n) return '';
            const last = n.split(/\s+/).slice(-1)[0];
            return size > 1 && last ? `The ${last} Family` : n;
          };
          persisted.households = (persisted.guests ?? []).map((g: any) => {
            const status: GuestStatus = g.status ?? 'Waiting';
            const qty = Math.max(1, Number(g.qty) || 1);
            const companions: string[] = (g.companions ?? []).filter(
              (c: any) => typeof c === 'string'
            );
            const members: Member[] = [
              makeMember({ name: g.name ?? '', rsvp: status, meal: g.meal ?? '' }),
            ];
            for (let i = 0; i < qty - 1; i++) {
              members.push(makeMember({ name: companions[i] ?? '', rsvp: status }));
            }
            return {
              id: g.id ?? 'g_' + uid(),
              label: deriveLabel(g.name ?? '', qty),
              group: g.group ?? 'Couple Friends',
              side: g.side ?? 'Both',
              email: g.email ?? '',
              address: '',
              inviteSent: false,
              notes: g.notes ?? '',
              table: g.table ?? '',
              members,
            };
          });
          delete persisted.guests;
        }
        // v4: seed the venue planning hub from the chosen (favorite) venue.
        // The old `venues` comparison array is kept, just no longer surfaced.
        if (version < 4 && !persisted.venuePlan) {
          const vs = persisted.venues ?? [];
          const chosen = vs.find((v: any) => v?.favorite) || vs[0];
          persisted.venuePlan = defaultVenuePlan(chosen);
        }
        // v5: introduce the wedding party, groups labeled from the couple.
        if (version < 5 && !persisted.weddingParty) {
          persisted.weddingParty = defaultWeddingParty(persisted.settings);
        }
        return persisted;
      },
    }
  )
);

export const useShallowStore = <T,>(selector: (s: AppState & Actions & UndoState) => T): T =>
  useStore(useShallow(selector));
