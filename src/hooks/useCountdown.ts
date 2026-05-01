import { useEffect, useState } from 'react';

export function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now.getTime();
  if (isNaN(diff)) return { days: 0, hours: 0, minutes: 0, isPast: false, invalid: true };
  if (diff <= 0)
    return { days: 0, hours: 0, minutes: 0, isPast: true, invalid: false };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes, isPast: false, invalid: false };
}
