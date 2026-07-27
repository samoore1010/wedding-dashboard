import { Plus, Trash2 } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LabeledField } from '../components/ui/Field';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';

export function Honeymoon() {
  const {
    honeymoonNotes,
    setHoneymoonNotes,
    honeymoonDays,
    addHDay,
    updateHDay,
    removeHDay,
    packingList,
    setPackingList,
    honeymoonDestination,
    setHoneymoonDestination,
    honeymoonBudget,
    setHoneymoonBudget,
    settings,
  } = useShallowStore((s) => ({
    honeymoonNotes: s.honeymoonNotes,
    setHoneymoonNotes: s.setHoneymoonNotes,
    honeymoonDays: s.honeymoonDays,
    addHDay: s.addHDay,
    updateHDay: s.updateHDay,
    removeHDay: s.removeHDay,
    packingList: s.packingList,
    setPackingList: s.setPackingList,
    honeymoonDestination: s.honeymoonDestination,
    setHoneymoonDestination: s.setHoneymoonDestination,
    honeymoonBudget: s.honeymoonBudget,
    setHoneymoonBudget: s.setHoneymoonBudget,
    settings: s.settings,
  }));

  return (
    <div className="space-y-5">
      <Card title="The Trip">
        <div className="grid md:grid-cols-2 gap-4">
          <LabeledField label="Destination">
            <EditableText
              value={honeymoonDestination || ''}
              onChange={setHoneymoonDestination}
              ariaLabel="destination"
              placeholder="Where are you headed?"
            />
          </LabeledField>
          <LabeledField label={`Budget (${settings.currency})`}>
            <EditableText
              value={String(honeymoonBudget || 0)}
              numeric
              ariaLabel="honeymoon budget"
              onChange={(next) => setHoneymoonBudget(Number(next) || 0)}
            />
          </LabeledField>
        </div>
        <LabeledField label="Brainstorm" className="mt-4">
          <EditableText
            multiline
            rows={4}
            value={honeymoonNotes}
            onChange={setHoneymoonNotes}
            ariaLabel="brainstorm notes"
            placeholder="Destinations to consider, must-dos, restaurants, hotels…"
          />
        </LabeledField>
      </Card>

      <Card
        title="Itinerary"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={addHDay}>
            Add Day
          </Button>
        }
      >
        <div className="divide-y divide-border">
          {honeymoonDays.map((d) => (
            <div key={d.id} className="flex items-start gap-4 py-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent to-accent-soft text-white font-bold flex items-center justify-center flex-shrink-0">
                {d.day}
              </div>
              <div className="flex-1">
                <EditableText
                  value={d.title}
                  onChange={(v) => updateHDay(d.id, { title: v })}
                  placeholder="Day title"
                  className="text-base font-semibold"
                />
                <EditableText
                  value={d.desc}
                  onChange={(v) => updateHDay(d.id, { desc: v })}
                  placeholder="Plan your activities"
                  className="text-sm text-muted"
                />
              </div>
              <IconButton
                tone="danger"
                onClick={async () => {
                  if (
                    await confirmAction({
                      title: 'Remove day?',
                      message: `Remove "${d.title}" from your itinerary?`,
                      confirmLabel: 'Remove',
                      variant: 'danger',
                    })
                  ) {
                    removeHDay(d.id);
                  }
                }}
                aria-label="Remove day"
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Packing List">
        <EditableText
          multiline
          rows={6}
          value={packingList}
          onChange={setPackingList}
          ariaLabel="packing list"
          placeholder="Start your packing list here…"
        />
      </Card>
    </div>
  );
}
