import { uid } from './utils';
import type {
  AppState,
  PartnerId,
  ReviewRequest,
  ReviewTarget,
  ReviewTargetKind,
  TabId,
  WeddingSettings,
} from './types';

export const PARTNER_IDS: PartnerId[] = ['p1', 'p2'];

/** The other half of the couple. */
export const otherPartner = (p: PartnerId): PartnerId => (p === 'p1' ? 'p2' : 'p1');

/** Display name for a partner slot, with a sensible fallback if unnamed. */
export const partnerName = (settings: WeddingSettings, p: PartnerId): string =>
  (p === 'p1' ? settings.brideName : settings.groomName).trim() ||
  (p === 'p1' ? 'Partner 1' : 'Partner 2');

/** Which tab owns a target, i.e. where "Open" should take you. */
const TARGET_TAB: Record<ReviewTargetKind, TabId> = {
  none: 'overview',
  checklist: 'checklist',
  vendor: 'vendors',
};

export const targetTab = (t: ReviewTarget): TabId => TARGET_TAB[t.kind];

/** Label for the record a call-out points at ("Checklist task", "Vendor"). */
export const targetLabel = (t: ReviewTarget): string =>
  t.kind === 'checklist' ? 'Checklist task' : t.kind === 'vendor' ? 'Vendor' : '';

export const noTarget = (): ReviewTarget => ({ kind: 'none', ref: {} });

export const checklistTarget = (phase: string, itemId: string): ReviewTarget => ({
  kind: 'checklist',
  ref: { phase, itemId },
});

export const vendorTarget = (vendorId: string): ReviewTarget => ({
  kind: 'vendor',
  ref: { vendorId },
});

export const makeReviewRequest = (patch?: Partial<ReviewRequest>): ReviewRequest => ({
  id: 'rv_' + uid(),
  to: 'p2',
  from: 'p1',
  title: '',
  ask: '',
  url: '',
  target: noTarget(),
  status: 'open',
  reply: '',
  createdAt: Date.now(),
  resolvedAt: 0,
  ...patch,
});

/** Do two call-outs point at the same record? (`none` targets never match.) */
export const sameTarget = (a: ReviewTarget, b: ReviewTarget): boolean => {
  if (a.kind !== b.kind || a.kind === 'none') return false;
  const keys = new Set([...Object.keys(a.ref), ...Object.keys(b.ref)]);
  return [...keys].every((k) => a.ref[k] === b.ref[k]);
};

/** Call-outs attached to one record, newest first. */
export const requestsForTarget = (
  requests: ReviewRequest[],
  target: ReviewTarget
): ReviewRequest[] =>
  requests.filter((r) => sameTarget(r.target, target)).sort((a, b) => b.createdAt - a.createdAt);

/** Open call-outs waiting on a given partner, oldest first (act on these first). */
export const openFor = (requests: ReviewRequest[], who: PartnerId): ReviewRequest[] =>
  requests.filter((r) => r.status === 'open' && r.to === who).sort((a, b) => a.createdAt - b.createdAt);

/** Open call-outs a given partner is waiting to hear back on. */
export const openFrom = (requests: ReviewRequest[], who: PartnerId): ReviewRequest[] =>
  requests.filter((r) => r.status === 'open' && r.from === who).sort((a, b) => a.createdAt - b.createdAt);

/** Recently answered call-outs involving a partner, newest first. */
export const recentlyDone = (requests: ReviewRequest[], who: PartnerId): ReviewRequest[] =>
  requests
    .filter((r) => r.status === 'done' && (r.to === who || r.from === who))
    .sort((a, b) => b.resolvedAt - a.resolvedAt);

/** "just now" / "3d ago" — precise enough for a call-out list, no library needed. */
export const timeAgo = (ts: number): string => {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
};

/**
 * Drop call-outs whose record no longer exists, so deleting a task or vendor
 * doesn't leave a dead link sitting on the overview.
 */
export const pruneRequests = (
  requests: ReviewRequest[],
  state: Pick<AppState, 'checklistItems' | 'vendors'>
): ReviewRequest[] =>
  requests.filter((r) => {
    if (r.target.kind === 'checklist') {
      const { phase, itemId } = r.target.ref;
      return (state.checklistItems[phase] ?? []).some((it) => it.id === itemId);
    }
    if (r.target.kind === 'vendor') {
      return state.vendors.some((v) => v.id === r.target.ref.vendorId);
    }
    return true;
  });
