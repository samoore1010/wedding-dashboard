import { useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import type { VendorStage } from '../types';

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
      v.notes.toLowerCase().includes(q)
    );
  });

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
            Add Vendor
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
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Vendor</th>
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
                  <td className="px-2 py-1.5 min-w-[120px]">
                    <EditableText
                      value={v.type}
                      onChange={(val) => updateVendor(v.id, { type: val })}
                      placeholder="Type"
                      className="font-semibold"
                    />
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px]">
                    <EditableText
                      value={v.name}
                      onChange={(val) => updateVendor(v.id, { name: val })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableText
                      value={v.contact}
                      onChange={(val) => updateVendor(v.id, { contact: val })}
                      placeholder="—"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableText
                      value={v.phone}
                      onChange={(val) => updateVendor(v.id, { phone: val })}
                      placeholder="—"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 min-w-[140px]">
                    <EditableText
                      value={v.email}
                      onChange={(val) => updateVendor(v.id, { email: val })}
                      placeholder="—"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select
                      value={v.stage}
                      onChange={(e) =>
                        updateVendor(v.id, { stage: e.target.value as VendorStage })
                      }
                      className={cn('text-xs font-semibold', stageColor(v.stage))}
                    >
                      {STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Input
                      type="number"
                      value={v.cost || ''}
                      placeholder="$0"
                      className="w-24 text-right"
                      onChange={(e) => updateVendor(v.id, { cost: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px]">
                    <EditableText
                      value={v.notes}
                      onChange={(val) => updateVendor(v.id, { notes: val })}
                      placeholder="—"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
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
