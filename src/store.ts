import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { cloudStorage, isCloudMode } from './cloudStorage';
import type {
  AppState,
  Gift,
  Guest,
  HoneymoonDay,
  MoodBoardItem,
  RegistryItem,
  RunOfShowItem,
  SeatingTable,
  Vendor,
  Venue,
  WeekendEvent,
  WeddingSettings,
  BudgetCategory,
  ChecklistItem,
} from './types';
import { DEFAULT_STATE } from './defaults';
import { uid } from './utils';

interface Actions {
  // Settings
  updateSettings: (patch: Partial<WeddingSettings>) => void;

  // Budget
  setBudgetTotal: (n: number) => void;
  updateBudgetCat: (id: string, patch: Partial<BudgetCategory>) => void;
  addBudgetCat: () => void;
  removeBudgetCat: (id: string) => void;
  setBudgetSpent: (id: string, value: number) => void;

  // Guests
  addGuest: (guest?: Partial<Guest>) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;

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
  /** Move a guest to a table (or unseat with tableId=null). Keeps Guest.table in sync. */
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

  // Venues
  addVenue: () => void;
  updateVenue: (id: string, patch: Partial<Venue>) => void;
  removeVenue: (id: string) => void;
  setFavoriteVenue: (id: string) => void;

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

export const useStore = create<AppState & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

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

      addGuest: (guest) =>
        set((s) => ({
          guests: [
            ...s.guests,
            {
              id: 'g_' + uid(),
              name: '',
              group: 'Couple Friends',
              side: 'Both',
              status: 'Waiting',
              qty: 1,
              meal: '',
              table: '',
              notes: '',
              companions: [],
              ...guest,
            },
          ],
        })),
      updateGuest: (id, patch) =>
        set((s) => ({
          guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      removeGuest: (id) =>
        set((s) => ({
          guests: s.guests.filter((g) => g.id !== id),
          seating: s.seating.map((t) => ({
            ...t,
            guestIds: (t.guestIds ?? []).filter((gid) => gid !== id),
          })),
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
            const memberIds = new Set(updated?.guestIds ?? []);
            return {
              seating: newSeating,
              guests: s.guests.map((g) =>
                memberIds.has(g.id) ? { ...g, table: updated?.name ?? '' } : g
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
            guests: s.guests.map((g) =>
              orphaned.has(g.id) ? { ...g, table: '' } : g
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
            guests: s.guests.map((g) =>
              g.id === guestId ? { ...g, table: tableName } : g
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
      version: 2,
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
        return persisted;
      },
    }
  )
);

export const useShallowStore = <T,>(selector: (s: AppState & Actions) => T): T =>
  useStore(useShallow(selector));
