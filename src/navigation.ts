import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { ReviewTarget, ReviewTargetKind } from './types';

interface FocusState {
  /**
   * A record another part of the app asked to be opened. The owning tab picks
   * it up when it mounts and clears it. Session-only — never persisted.
   */
  focus: ReviewTarget | null;
  setFocus: (t: ReviewTarget | null) => void;
}

export const useFocusStore = create<FocusState>((set) => ({
  focus: null,
  setFocus: (focus) => set({ focus }),
}));

/** Queue a record to be opened, e.g. before jumping to the tab that owns it. */
export const focusTarget = (t: ReviewTarget) => useFocusStore.getState().setFocus(t);

/**
 * Open the record you were sent to, once, when this tab mounts.
 *
 *   useFocusTarget('checklist', (ref) => setOpenItem({ phase: ref.phase, id: ref.itemId }));
 */
export function useFocusTarget(
  kind: ReviewTargetKind,
  open: (ref: Record<string, string>) => void
) {
  const focus = useFocusStore((s) => s.focus);
  const setFocus = useFocusStore((s) => s.setFocus);
  // Held in a ref so a fresh closure each render doesn't re-fire the effect.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!focus || focus.kind !== kind) return;
    openRef.current(focus.ref);
    setFocus(null);
  }, [focus, kind, setFocus]);
}
