import type { StateStorage } from 'zustand/middleware';

// Single-wedding model: in production we sync against one shared
// /api/wedding endpoint backed by a single file on the Railway volume.
// In dev we fall through to localStorage (no API server is running).
export const isCloudMode = (): boolean =>
  typeof window !== 'undefined' && import.meta.env.PROD;

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
  return () => {
    listeners.delete(l);
  };
};
export const getSyncState = () => currentState;

const DEBOUNCE_MS = 700;
const ENDPOINT = '/api/wedding';

export const cloudStorage: StateStorage = {
  getItem: async () => {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' });
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
      const value = pendingValue;
      pendingValue = null;
      inFlight = true;
      setSyncState('saving');
      try {
        const res = await fetch(ENDPOINT, {
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
