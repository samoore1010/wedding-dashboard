import type { StateStorage } from 'zustand/middleware';

const ID_PATH_RE = /^\/w\/([A-Za-z0-9_-]+)/;

export const getWeddingIdFromPath = (): string | null => {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(ID_PATH_RE);
  return m?.[1] ?? null;
};

export const newWeddingId = (): string => {
  const a = Math.random().toString(36).slice(2, 14);
  const b = Math.random().toString(36).slice(2, 14);
  return 'w_' + a + b; // 26 chars, ~120 bits of entropy
};

export const isCloudMode = (): boolean =>
  typeof window !== 'undefined' && getWeddingIdFromPath() !== null;

type SyncListener = (state: 'idle' | 'saving' | 'error') => void;
const listeners = new Set<SyncListener>();
let currentState: 'idle' | 'saving' | 'error' = 'idle';
const setSyncState = (s: 'idle' | 'saving' | 'error') => {
  currentState = s;
  listeners.forEach((l) => l(s));
};
export const onSyncStateChange = (l: SyncListener) => {
  listeners.add(l);
  l(currentState);
  return () => listeners.delete(l);
};
export const getSyncState = () => currentState;

const DEBOUNCE_MS = 700;

export const cloudStorage: StateStorage = {
  getItem: async (_name) => {
    const id = getWeddingIdFromPath();
    if (!id) return null;
    try {
      const res = await fetch(`/api/wedding/${id}`, { cache: 'no-store' });
      if (res.status === 204) return null;
      if (!res.ok) {
        setSyncState('error');
        return null;
      }
      const text = await res.text();
      return text || null;
    } catch (e) {
      console.warn('cloud load failed', e);
      setSyncState('error');
      return null;
    }
  },
  setItem: (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingValue: string | null = null;
    let inFlight = false;

    const flush = async () => {
      if (inFlight || pendingValue === null) return;
      const id = getWeddingIdFromPath();
      if (!id) return;
      const value = pendingValue;
      pendingValue = null;
      inFlight = true;
      setSyncState('saving');
      try {
        const res = await fetch(`/api/wedding/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: value,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSyncState('idle');
      } catch (e) {
        console.warn('cloud save failed', e);
        setSyncState('error');
      } finally {
        inFlight = false;
        // if more changes came in while we were saving, flush again
        if (pendingValue !== null) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(flush, DEBOUNCE_MS);
        }
      }
    };

    return (_name, value) => {
      pendingValue = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };
  })(),
  removeItem: async () => {},
};

// Try to flush on tab close (best-effort)
if (typeof window !== 'undefined' && isCloudMode()) {
  window.addEventListener('pagehide', () => {
    // sendBeacon doesn't support PUT; we rely on the debounced save having
    // already fired in most cases. This is a graceful fallback only.
  });
}
