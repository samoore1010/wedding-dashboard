import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useShallowStore } from '../../store';
import { fmtMoney } from '../../utils';

export function SpendBar() {
  const { budgetCats, budgetTotal, budgetSpent, settings } = useShallowStore((s) => ({
    budgetCats: s.budgetCats,
    budgetTotal: s.budgetTotal,
    budgetSpent: s.budgetSpent,
    settings: s.settings,
  }));

  const data = budgetCats.map((c) => ({
    name: c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name,
    Allocated: Math.round((budgetTotal * (Number(c.pct) || 0)) / 100),
    Spent: Number(budgetSpent[c.id]) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--c-border))" horizontal={false} />
        <XAxis
          type="number"
          stroke="rgb(var(--c-muted))"
          fontSize={11}
          tickFormatter={(v) => `${settings.currency}${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          dataKey="name"
          type="category"
          stroke="rgb(var(--c-muted))"
          fontSize={10}
          width={130}
        />
        <Tooltip
          formatter={(v: number) => fmtMoney(v, settings.currency)}
          contentStyle={{
            background: 'rgb(var(--c-surface))',
            border: '1px solid rgb(var(--c-border))',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Allocated" fill="rgba(123,109,94,0.25)" radius={[0, 4, 4, 0]} />
        <Bar dataKey="Spent" fill="rgb(var(--c-accent))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
