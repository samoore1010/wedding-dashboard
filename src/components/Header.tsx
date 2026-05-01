import { Settings as SettingsIcon, Heart, Menu } from 'lucide-react';
import { useStore } from '../store';
import { useCountdown } from '../hooks/useCountdown';
import { buildWeddingDate, formatDate, formatWeekday } from '../utils';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenMobileNav: () => void;
}

export function Header({ onOpenSettings, onOpenMobileNav }: HeaderProps) {
  const settings = useStore((s) => s.settings);
  const target = buildWeddingDate(settings.weddingDate, settings.weddingTime);
  const cd = useCountdown(target);
  const couple = `${settings.brideName || 'Partner 1'} & ${settings.groomName || 'Partner 2'}`;
  const dateLabel = settings.weddingDate
    ? `${formatDate(settings.weddingDate)} • ${formatWeekday(settings.weddingDate)}`
    : 'Set your wedding date in Settings';

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-soft to-accent text-white">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_60%)]" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMobileNav}
              className="no-print md:hidden inline-flex items-center justify-center text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full h-8 w-8 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <div className="text-white/70 text-xs tracking-[0.3em] uppercase flex items-center gap-2">
              <Heart size={14} className="fill-white/80 text-white/80" />
              <span className="hidden sm:inline">Wedding Dashboard</span>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="no-print inline-flex items-center gap-2 text-xs uppercase tracking-widest bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 transition-colors"
            aria-label="Open settings"
          >
            <SettingsIcon size={14} />
            <span className="hidden sm:inline">Customize</span>
          </button>
        </div>

        <div className="text-center">
          <h1 className="font-display font-light text-4xl md:text-6xl tracking-wider">
            {couple}
          </h1>
          <div className="text-xs md:text-sm tracking-[0.25em] uppercase opacity-90 mt-2">
            {dateLabel}
          </div>

          <div className="flex justify-center gap-6 md:gap-10 mt-6">
            {cd.isPast ? (
              <div className="font-display text-3xl">Just Married! 🎉</div>
            ) : cd.invalid ? (
              <div className="text-sm opacity-80">Set a date in Customize →</div>
            ) : (
              <>
                <CountdownItem num={cd.days} label="Days" />
                <CountdownItem num={cd.hours} label="Hours" />
                <CountdownItem num={cd.minutes} label="Minutes" />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function CountdownItem({ num, label }: { num: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold tabular-nums leading-none">
        {num}
      </div>
      <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase opacity-80 mt-1">
        {label}
      </div>
    </div>
  );
}
