import { Plus, Trash2 } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { BudgetDonut } from '../components/charts/BudgetDonut';
import { SpendBar } from '../components/charts/SpendBar';
import { COLORS } from '../defaults';
import { fmtMoney, pct } from '../utils';
import { confirmAction } from '../components/ui/ConfirmDialog';

export function Budget() {
  const {
    budgetTotal,
    budgetCats,
    budgetSpent,
    settings,
    setBudgetTotal,
    updateBudgetCat,
    addBudgetCat,
    removeBudgetCat,
    setBudgetSpent,
  } = useShallowStore((s) => ({
    budgetTotal: s.budgetTotal,
    budgetCats: s.budgetCats,
    budgetSpent: s.budgetSpent,
    settings: s.settings,
    setBudgetTotal: s.setBudgetTotal,
    updateBudgetCat: s.updateBudgetCat,
    addBudgetCat: s.addBudgetCat,
    removeBudgetCat: s.removeBudgetCat,
    setBudgetSpent: s.setBudgetSpent,
  }));

  const spent = Object.values(budgetSpent).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = budgetTotal - spent;
  const totalPct = budgetCats.reduce((s, c) => s + (Number(c.pct) || 0), 0);
  const cur = settings.currency;

  return (
    <div className="space-y-6">
      <Card title="Wedding Budget">
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <span className="text-sm font-semibold">Total Budget</span>
          <Input
            type="number"
            value={budgetTotal}
            onChange={(e) => setBudgetTotal(Number(e.target.value) || 0)}
            className="w-40"
          />
          {totalPct !== 100 && (
            <span className="text-xs text-warning">
              Allocations sum to {totalPct}% (target 100%)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Total Budget" value={fmtMoney(budgetTotal, cur)} />
          <StatCard label="Total Spent" value={fmtMoney(spent, cur)} tone="accent" />
          <StatCard
            label={remaining >= 0 ? 'Remaining' : 'Over Budget'}
            value={fmtMoney(remaining, cur)}
            tone={remaining >= 0 ? 'sage' : 'danger'}
          />
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Budget Used</span>
            <span>{pct(spent, budgetTotal)}%</span>
          </div>
          <ProgressBar
            value={pct(spent, budgetTotal)}
            tone={remaining < 0 ? 'danger' : 'accent'}
          />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Allocation">
          <div className="h-72">
            <BudgetDonut />
          </div>
        </Card>
        <Card title="Spent vs Allocated">
          <div className="h-72">
            <SpendBar />
          </div>
        </Card>
      </div>

      <Card
        title="Budget Breakdown"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={addBudgetCat}>
            Add Category
          </Button>
        }
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2 w-16 text-center">%</th>
                <th className="px-2 py-2 text-right">Allocated</th>
                <th className="px-2 py-2 text-right w-32">Spent</th>
                <th className="px-2 py-2 text-right">Remaining</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {budgetCats.map((c, i) => {
                const alloc = Math.round((budgetTotal * (Number(c.pct) || 0)) / 100);
                const sp = Number(budgetSpent[c.id]) || 0;
                const r = alloc - sp;
                return (
                  <tr key={c.id} className="hover:bg-bg/40">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm flex-shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <EditableText
                          value={c.name}
                          onChange={(v) => updateBudgetCat(c.id, { name: v })}
                          placeholder="Category name"
                          className="font-medium"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <EditableText
                        value={String(c.pct)}
                        onChange={(v) =>
                          updateBudgetCat(c.id, { pct: Number(v) || 0 })
                        }
                        numeric
                        align="center"
                        className="w-16"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold">
                      {fmtMoney(alloc, cur)}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        value={sp || ''}
                        placeholder="0"
                        className="text-right"
                        onChange={(e) => setBudgetSpent(c.id, Number(e.target.value) || 0)}
                      />
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-semibold ${
                        r < 0 ? 'text-danger' : 'text-sage'
                      }`}
                    >
                      {fmtMoney(r, cur)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <IconButton
                        tone="danger"
                        onClick={async () => {
                          if (
                            await confirmAction({
                              title: 'Delete category?',
                              message: `Remove "${c.name}" from your budget?`,
                              confirmLabel: 'Delete',
                              variant: 'danger',
                            })
                          )
                            removeBudgetCat(c.id);
                        }}
                        aria-label="Delete category"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
              <tr className="font-bold bg-bg/40">
                <td className="px-2 py-2">Total</td>
                <td className="px-2 py-2 text-center">{totalPct}%</td>
                <td className="px-2 py-2 text-right">{fmtMoney(budgetTotal, cur)}</td>
                <td className="px-2 py-2 text-right">{fmtMoney(spent, cur)}</td>
                <td
                  className={`px-2 py-2 text-right ${
                    remaining < 0 ? 'text-danger' : 'text-sage'
                  }`}
                >
                  {fmtMoney(remaining, cur)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
