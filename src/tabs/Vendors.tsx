import { useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { EditableSelect } from '../components/ui/EditableSelect';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import { vendorProgress } from '../vendors';
import { VendorDetail } from './vendors/VendorDetail';
import type { VendorStage } from '../types';

/** Placeholder for an empty read-only cell. */
const Dash = () => <span className="text-muted/60">—</span>;

const STAGES: VendorStage[] = [
  'Not Started',
  'Researching',
  'Inquiry Sent',
  'Meeting Scheduled',
  'Proposal Received',
  'Booked',
  'Paid in Full',
];

const stageColor = (s: VendorStage) =>
  s === 'Booked' || s === 'Paid in Full'
    ? 'text-success'
    : s === 'Not Started'
    ? 'text-muted'
    : 'text-warning';

export function Vendors() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { vendors, addVendor, updateVendor, removeVendor } = useShallowStore((s) => ({
    vendors: s.vendors,
    addVendor: s.addVendor,
    updateVendor: s.updateVendor,
    removeVendor: s.removeVendor,
  }));

  const [search, setSearch] = useState('');
  const filtered = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.type.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      v.contact.toLowerCase().includes(q) ||
      v.notes.toLowerCase().includes(q) ||
      v.candidates.some((c) => c.name.toLowerCase().includes(q))
    );
  });

  if (openId && vendors.some((v) => v.id === openId)) {
    return <VendorDetail vendorId={openId} onBack={() => setOpenId(null)} />;
  }

  const booked = vendors.filter((v) => v.stage === 'Booked' || v.stage === 'Paid in Full').length;
  const inProg = vendors.filter(
    (v) => v.stage !== 'Not Started' && v.stage !== 'Booked' && v.stage !== 'Paid in Full'
  ).length;
  const notStarted = vendors.filter((v) => v.stage === 'Not Started').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Booked" value={booked} tone="sage" />
        <StatCard label="In Progress" value={inProg} tone="warning" />
        <StatCard label="Not Started" value={notStarted} tone="rose" />
      </div>

      <Card
        title="Vendor Tracker"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={() => addVendor()}>
            Add Category
          </Button>
        }
      >
        <div className="relative max-w-sm mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search vendors…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Booked vendor</th>
                <th className="px-2 py-2">Contact</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Cost</th>
                <th className="px-2 py-2">Notes</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-bg/40">
                  <td className="px-2 py-1.5 min-w-[150px]">
                    {/* The category name, its progress, and the way in. */}
                    <button onClick={() => setOpenId(v.id)} className="text-left group/open">
                      <span className="font-semibold text-ink group-hover/open:text-accent transition-colors">
                        {v.type || 'Untitled'}
                      </span>
                      {vendorProgress(v) && !v.chosenId && (
                        <span className="block text-[11px] text-muted">{vendorProgress(v)}</span>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px] text-ink">{v.name || <Dash />}</td>
                  <td className="px-2 py-1.5 text-xs text-ink">{v.contact || <Dash />}</td>
                  <td className="px-2 py-1.5 text-xs text-ink tabular-nums">{v.phone || <Dash />}</td>
                  <td className="px-2 py-1.5 min-w-[140px] text-xs text-ink break-all">
                    {v.email || <Dash />}
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableSelect
                      value={v.stage}
                      options={STAGES}
                      ariaLabel={`stage for ${v.name || v.type}`}
                      onChange={(next) => updateVendor(v.id, { stage: next as VendorStage })}
                      className="text-xs"
                      displayClassName={cn('font-semibold', stageColor(v.stage))}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs text-ink tabular-nums">
                    {v.cost || <Dash />}
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px]">
                    <EditableText
                      value={v.notes}
                      onChange={(val) => updateVendor(v.id, { notes: val })}
                      placeholder="—"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setOpenId(v.id)}
                      className="text-xs font-semibold text-primary hover:text-accent mr-1"
                    >
                      Open
                    </button>
                    <IconButton
                      tone="danger"
                      onClick={async () => {
                        if (
                          await confirmAction({
                            title: 'Remove vendor?',
                            message: `Remove ${v.type}${v.name ? ' — ' + v.name : ''}?`,
                            confirmLabel: 'Remove',
                            variant: 'danger',
                          })
                        ) {
                          removeVendor(v.id);
                        }
                      }}
                      aria-label="Remove vendor"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
