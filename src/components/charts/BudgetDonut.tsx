import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useShallowStore } from '../../store';
import { COLORS } from '../../defaults';
import { fmtMoney } from '../../utils';

export function BudgetDonut() {
  const { budgetCats, budgetTotal, settings } = useShallowStore((s) => ({
    budgetCats: s.budgetCats,
    budgetTotal: s.budgetTotal,
    settings: s.settings,
  }));
  const data = budgetCats.map((c, i) => ({
    name: c.name,
    value: Number(c.pct) || 0,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          stroke="white"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number, _k, p: any) => [
            `${v}% — ${fmtMoney((budgetTotal * v) / 100, settings.currency)}`,
            p.payload.name,
          ]}
          contentStyle={{
            background: 'rgb(var(--c-surface))',
            border: '1px solid rgb(var(--c-border))',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
