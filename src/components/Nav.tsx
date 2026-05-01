import { useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  Building2,
  CheckSquare,
  Briefcase,
  Armchair,
  Clock,
  Gift,
  PackageOpen,
  Plane,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import type { TabId } from '../types';
import { useShallowStore } from '../store';
import { cn, pct } from '../utils';

interface NavProps {
  active: TabId;
  onChange: (id: TabId) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'venues', label: 'Venues', icon: Building2 },
  { id: 'moodboard', label: 'Mood Board', icon: ImageIcon },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare },
  { id: 'vendors', label: 'Vendors', icon: Briefcase },
  { id: 'seating', label: 'Seating', icon: Armchair },
  { id: 'timeline', label: 'Day-Of', icon: Clock },
  { id: 'registry', label: 'Registry', icon: PackageOpen },
  { id: 'gifts', label: 'Gifts', icon: Gift },
  { id: 'honeymoon', label: 'Honeymoon', icon: Plane },
];

export function Nav({ active, onChange, mobileOpen, onMobileClose }: NavProps) {
  const { guests, vendors, venues, checklistItems, checklist, registryCats, registryChecked, gifts, moodBoard } =
    useShallowStore((s) => ({
      guests: s.guests,
      vendors: s.vendors,
      venues: s.venues,
      checklistItems: s.checklistItems,
      checklist: s.checklist,
      registryCats: s.registryCats,
      registryChecked: s.registryChecked,
      gifts: s.giftTracker,
      moodBoard: s.moodBoard ?? [],
    }));

  const badges = useMemo(() => {
    const guestCount = guests.reduce((s, g) => s + (Number(g.qty) || 1), 0);
    let totalChecks = 0;
    let doneChecks = 0;
    Object.values(checklistItems).forEach((arr) =>
      arr.forEach((it) => {
        totalChecks++;
        if (checklist[it.id]) doneChecks++;
      })
    );
    const booked = vendors.filter((v) => v.stage === 'Booked' || v.stage === 'Paid in Full').length;
    const totalReg = Object.values(registryCats).reduce((s, items) => s + items.length, 0);
    const purchasedReg = Object.values(registryChecked).filter(Boolean).length;
    const giftsToThank = gifts.length - gifts.filter((g) => g.thankYou).length;

    return {
      guests: guestCount || null,
      venues: venues.length || null,
      moodboard: moodBoard.length || null,
      checklist: totalChecks ? `${pct(doneChecks, totalChecks)}%` : null,
      vendors: vendors.length ? `${booked}/${vendors.length}` : null,
      registry: totalReg ? `${purchasedReg}/${totalReg}` : null,
      gifts: giftsToThank > 0 ? giftsToThank : null,
    } as Record<string, string | number | null>;
  }, [guests, vendors, venues, checklistItems, checklist, registryCats, registryChecked, gifts, moodBoard]);

  // close mobile drawer when tab changes via Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  const TabButton = ({ tab }: { tab: (typeof TABS)[number] }) => {
    const Icon = tab.icon;
    const isActive = tab.id === active;
    const badge = badges[tab.id];
    const isPercent = typeof badge === 'string' && badge.endsWith('%');
    return (
      <button
        onClick={() => {
          onChange(tab.id);
          onMobileClose();
        }}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          isActive
            ? 'bg-accent/12 text-accent'
            : 'text-muted hover:text-ink hover:bg-bg'
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
        )}
        <Icon size={16} className="flex-shrink-0" />
        <span className="flex-1">{tab.label}</span>
        {badge != null && (
          <span
            className={cn(
              'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
              isActive
                ? 'bg-accent/20 text-accent'
                : isPercent
                ? 'bg-sage/15 text-sage'
                : 'bg-bg text-muted group-hover:bg-border/60'
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="no-print hidden md:block sticky top-6 self-start w-56 lg:w-60 flex-shrink-0">
        <nav className="bg-surface border border-border rounded-xl2 shadow-soft p-2 space-y-0.5">
          {TABS.map((t) => (
            <TabButton key={t.id} tab={t} />
          ))}
        </nav>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'no-print md:hidden fixed inset-0 z-40 transition-opacity',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onMobileClose} />
        <aside
          className={cn(
            'absolute left-0 top-0 h-full w-72 max-w-[85%] bg-surface border-r border-border shadow-lift transform transition-transform overflow-y-auto',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="px-4 py-4 border-b border-border flex items-center justify-between">
            <span className="font-display text-xl text-primary">Menu</span>
            <button
              onClick={onMobileClose}
              className="text-muted hover:text-ink p-1 rounded transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="p-2 space-y-0.5">
            {TABS.map((t) => (
              <TabButton key={t.id} tab={t} />
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
