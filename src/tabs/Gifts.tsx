import { Plus, Trash2, Gift as GiftIcon } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import type { Gift } from '../types';

export function Gifts() {
  const { giftTracker, addGift, updateGift, removeGift } = useShallowStore((s) => ({
    giftTracker: s.giftTracker,
    addGift: s.addGift,
    updateGift: s.updateGift,
    removeGift: s.removeGift,
  }));
  const sent = giftTracker.filter((g) => g.thankYou).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gifts Received" value={giftTracker.length} />
        <StatCard label="Thank Yous Sent" value={sent} tone="sage" />
        <StatCard label="Still Need Thanks" value={giftTracker.length - sent} tone="rose" />
      </div>

      <Card
        title="Gift Tracker"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={addGift}>
            Add Gift
          </Button>
        }
      >
        {giftTracker.length === 0 ? (
          <EmptyState
            icon={<GiftIcon size={22} />}
            title="No gifts tracked yet"
            description="Log gifts here as they arrive so you can keep up with thank-yous."
            action={
              <Button icon={<Plus size={14} />} onClick={addGift}>
                Add Gift
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="px-2 py-2">From</th>
                  <th className="px-2 py-2">Gift / Amount</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Received</th>
                  <th className="px-2 py-2 text-center">Thanked</th>
                  <th className="px-2 py-2">Address</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {giftTracker.map((g) => (
                  <GiftRow
                    key={g.id}
                    gift={g}
                    onUpdate={(p) => updateGift(g.id, p)}
                    onDelete={async () => {
                      if (
                        await confirmAction({
                          title: 'Remove gift?',
                          message: `Remove ${g.from || 'this gift'} from the list?`,
                          confirmLabel: 'Remove',
                          variant: 'danger',
                        })
                      )
                        removeGift(g.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function GiftRow({
  gift,
  onUpdate,
  onDelete,
}: {
  gift: Gift;
  onUpdate: (p: Partial<Gift>) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="hover:bg-bg/40">
      <td className="px-2 py-1.5 min-w-[120px]">
        <EditableText
          value={gift.from}
          onChange={(v) => onUpdate({ from: v })}
          placeholder="From"
          className="font-medium"
        />
      </td>
      <td className="px-2 py-1.5 min-w-[140px]">
        <EditableText
          value={gift.item}
          onChange={(v) => onUpdate({ item: v })}
          placeholder="Gift / amount"
        />
      </td>
      <td className="px-2 py-1.5">
        <Select
          value={gift.type}
          onChange={(e) => onUpdate({ type: e.target.value as Gift['type'] })}
          className="text-xs"
        >
          <option>Cash/Check</option>
          <option>Registry</option>
          <option>Other</option>
        </Select>
      </td>
      <td className="px-2 py-1.5">
        <Input
          type="date"
          value={gift.received || ''}
          onChange={(e) => onUpdate({ received: e.target.value })}
          className="text-xs"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={gift.thankYou}
          onChange={(e) => onUpdate({ thankYou: e.target.checked })}
          className="h-4 w-4 accent-sage cursor-pointer"
        />
      </td>
      <td className="px-2 py-1.5 min-w-[140px]">
        <EditableText
          value={gift.address}
          onChange={(v) => onUpdate({ address: v })}
          placeholder="—"
          className="text-xs"
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <IconButton tone="danger" onClick={onDelete} aria-label="Remove gift">
          <Trash2 size={14} />
        </IconButton>
      </td>
    </tr>
  );
}
