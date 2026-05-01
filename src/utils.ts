export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const fmtMoney = (n: number, currency = '$') =>
  `${currency}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const pct = (n: number, d: number) =>
  d > 0 ? Math.round((n / d) * 100) : 0;

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const formatDate = (iso: string, opts?: Intl.DateTimeFormatOptions) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(
    undefined,
    opts ?? { year: 'numeric', month: 'long', day: 'numeric' }
  );
};

export const formatWeekday = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long' });
};

export const buildWeddingDate = (date: string, time: string) => {
  if (!date) return new Date(NaN);
  return new Date(`${date}T${time || '16:00'}:00`);
};

export const parseTimeToMin = (s: string): number => {
  // "4:30 PM" -> minutes since midnight
  if (!s) return Number.MAX_SAFE_INTEGER;
  const m = s.trim().match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

export const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');
