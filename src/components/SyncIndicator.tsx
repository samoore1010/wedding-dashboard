import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, HardDrive } from 'lucide-react';
import { isCloudMode, onSyncStateChange } from '../cloudStorage';

export function SyncIndicator() {
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const cloud = isCloudMode();

  useEffect(() => {
    if (!cloud) return;
    const unsubscribe = onSyncStateChange(setState);
    return () => {
      unsubscribe();
    };
  }, [cloud]);

  if (!cloud) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <HardDrive size={12} />
        Stored locally in your browser
      </span>
    );
  }

  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Loader2 size={12} className="animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <CloudOff size={12} />
        Couldn't reach server — changes will retry
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sage">
      <Cloud size={12} />
      Synced
    </span>
  );
}
