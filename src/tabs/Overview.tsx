import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import { BudgetDonut } from '../components/charts/BudgetDonut';
import { GuestDonut } from '../components/charts/GuestDonut';
import { Textarea } from '../components/ui/Field';
import { fmtMoney, pct } from '../utils';
import type { TabId, VendorStage } from '../types';

const stageTone = (stage: VendorStage) => {
  if (stage === 'Booked' || stage === 'Paid in Full') return 'yes' as const;
  if (stage === 'Not Started') return 'neutral' as const;
  return 'waiting' as const;
};

interface OverviewProps {
  onJump: (id: TabId) => void;
}

export function Overview({ onJump }: OverviewProps) {
  const { guests, vendors, checklistItems, checklist, budgetSpent, budgetTotal, settings, notes, setNotes } =
    useShallowStore((s) => ({
      guests: s.guests,
      vendors: s.vendors,
      checklistItems: s.checklistItems,
      checklist: s.checklist,
      budgetSpent: s.budgetSpent,
      budgetTotal: s.budgetTotal,
      settings: s.settings,
      notes: s.notes,
      setNotes: s.setNotes,
    }));

  const total = guests.reduce((s, g) => s + (Number(g.qty) || 1), 0);
  const yes = guests.filter((g) => g.status === 'Yes').reduce((s, g) => s + (Number(g.qty) || 1), 0);
  const waiting = guests
    .filter((g) => g.status === 'Waiting')
    .reduce((s, g) => s + (Number(g.qty) || 1), 0);
  const no = guests.filter((g) => g.status === 'No').reduce((s, g) => s + (Number(g.qty) || 1), 0);

  let totalChecks = 0;
  let doneChecks = 0;
  Object.values(checklistItems).forEach((arr) =>
    arr.forEach((it) => {
      totalChecks++;
      if (checklist[it.id]) doneChecks++;
    })
  );

  const spent = Object.values(budgetSpent).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = budgetTotal - spent;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Budget" value={fmtMoney(budgetTotal, settings.currency)} />
        <StatCard
          label="Spent So Far"
          value={fmtMoney(spent, settings.currency)}
          tone="accent"
          hint={`${pct(spent, budgetTotal)}% of budget`}
        />
        <StatCard
          label="RSVPs Confirmed"
          value={`${yes} / ${total}`}
          tone="rose"
          hint={total ? `${pct(yes, total)}% replied yes` : 'No guests yet'}
        />
        <StatCard
          label="Tasks Done"
          value={`${pct(doneChecks, totalChecks)}%`}
          tone="sage"
          hint={`${doneChecks} of ${totalChecks}`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card
          title="Budget Overview"
          action={
            <button onClick={() => onJump('budget')} className="text-xs text-accent hover:underline">
              View details →
            </button>
          }
        >
          <div className="h-56">
            <BudgetDonut />
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Spent</span>
              <span>
                {fmtMoney(spent, settings.currency)} of{' '}
                {fmtMoney(budgetTotal, settings.currency)}
              </span>
            </div>
            <ProgressBar value={pct(spent, budgetTotal)} tone={remaining < 0 ? 'danger' : 'accent'} />
          </div>
        </Card>

        <Card
          title="Guest Breakdown"
          action={
            <button onClick={() => onJump('guests')} className="text-xs text-accent hover:underline">
              View details →
            </button>
          }
        >
          <div className="h-56">
            <GuestDonut yes={yes} waiting={waiting} no={no} />
          </div>
          <div className="flex justify-around text-sm mt-3">
            <div>
              <span className="text-sage font-bold">{yes}</span>{' '}
              <span className="text-muted">Confirmed</span>
            </div>
            <div>
              <span className="text-warning font-bold">{waiting}</span>{' '}
              <span className="text-muted">Waiting</span>
            </div>
            <div>
              <span className="text-danger font-bold">{no}</span>{' '}
              <span className="text-muted">Declined</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card
          title="Planning Progress"
          action={
            <button onClick={() => onJump('checklist')} className="text-xs text-accent hover:underline">
              View details →
            </button>
          }
        >
          <div className="space-y-3">
            {Object.entries(checklistItems).map(([phase, items]) => {
              const done = items.filter((it) => checklist[it.id]).length;
              const p = pct(done, items.length);
              return (
                <div key={phase}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-ink">{phase}</span>
                    <span className="text-muted">
                      {done}/{items.length}
                    </span>
                  </div>
                  <ProgressBar value={p} tone={p === 100 ? 'sage' : 'primary'} height="sm" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Vendor Status"
          action={
            <button onClick={() => onJump('vendors')} className="text-xs text-accent hover:underline">
              View details →
            </button>
          }
        >
          <div className="divide-y divide-border">
            {vendors.map((v) => (
              <div key={v.id} className="flex justify-between items-center py-2">
                <div>
                  <div className="text-sm font-semibold text-ink">{v.type}</div>
                  {v.name && <div className="text-xs text-muted">{v.name}</div>}
                </div>
                <Badge tone={stageTone(v.stage)}>{v.stage}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Quick Notes">
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jot down thoughts, ideas, reminders..."
        />
      </Card>
    </div>
  );
}
