import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PartnerId } from './types';

interface ViewerState {
  /** Which partner is sitting at this browser — null until they say. */
  viewer: PartnerId | null;
  setViewer: (p: PartnerId | null) => void;
}

/**
 * Who's using *this* device.
 *
 * Deliberately kept out of the dashboard state: the couple share one synced
 * wedding.json, so "me" has to live per-browser — otherwise picking a name on
 * one laptop would change who the other person is on theirs.
 */
export const useViewer = create<ViewerState>()(
  persist(
    (set) => ({
      viewer: null,
      setViewer: (viewer) => set({ viewer }),
    }),
    {
      name: 'wedding-dashboard-viewer',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
