import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface GuestDonutProps {
  yes: number;
  waiting: number;
  no: number;
}

export function GuestDonut({ yes, waiting, no }: GuestDonutProps) {
  const data = [
    { name: 'Confirmed', value: yes, color: 'rgb(143,166,138)' },
    { name: 'Waiting', value: waiting, color: 'rgb(230,126,34)' },
    { name: 'Declined', value: no, color: 'rgb(192,57,43)' },
  ];
  const total = yes + waiting + no;
  if (!total) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        Add guests to see breakdown
      </div>
    );
  }

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
