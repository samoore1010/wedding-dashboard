import { useStore } from '../../store';
import { useViewer } from '../../viewer';
import { partnerName, PARTNER_IDS } from '../../reviews';
import { cn } from '../../utils';

/**
 * "Which of you is this?" — asked once per browser.
 *
 * Review call-outs are addressed to a person, and both partners share one
 * synced dashboard, so the app has to know who is looking at it before it can
 * say what's waiting on you.
 */
export function ViewerPicker({
  label = "Who's using this device?",
  hint,
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  const settings = useStore((s) => s.settings);
  const viewer = useViewer((s) => s.viewer);
  const setViewer = useViewer((s) => s.setViewer);

  return (
    <div className={cn('space-y-2', className)}>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {PARTNER_IDS.map((p) => (
          <button
            key={p}
            onClick={() => setViewer(p)}
            className={cn(
              'px-3 h-8 rounded-lg border text-sm font-medium transition-colors',
              viewer === p
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-ink hover:border-primary-soft'
            )}
          >
            I'm {partnerName(settings, p)}
          </button>
        ))}
      </div>
    </div>
  );
}
