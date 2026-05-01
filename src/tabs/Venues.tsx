import { Plus, Star, Trash2, Building2, ExternalLink } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EditableText } from '../components/ui/EditableText';
import { Textarea } from '../components/ui/Field';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn } from '../utils';
import type { Venue } from '../types';

const FIELDS_LEFT: { key: keyof Venue; label: string; placeholder: string }[] = [
  { key: 'type', label: 'Type', placeholder: 'Estate, Hotel, Barn…' },
  { key: 'capacity', label: 'Capacity', placeholder: 'e.g. 250 max' },
  { key: 'fee', label: 'Venue Fee', placeholder: '$0' },
  { key: 'fbMin', label: 'F&B Minimum', placeholder: '$0' },
  { key: 'perPlate', label: 'Per Plate', placeholder: '$0' },
  { key: 'totalCost', label: 'Total Est. Cost', placeholder: '$0' },
];

const FIELDS_RIGHT: { key: keyof Venue; label: string; placeholder: string }[] = [
  { key: 'setting', label: 'Indoor / Outdoor', placeholder: 'Both, Indoor, Outdoor' },
  { key: 'catering', label: 'Catering', placeholder: 'In-house, BYO, Preferred list' },
  { key: 'bar', label: 'Bar Options', placeholder: 'Open bar, BYOB, Cash bar' },
  { key: 'availability', label: 'Availability', placeholder: 'Date availability' },
  { key: 'contact', label: 'Contact', placeholder: 'Name / phone / email' },
  { key: 'website', label: 'Website', placeholder: 'https://…' },
];

const FIELDS_BOTTOM_LEFT: { key: keyof Venue; label: string; placeholder: string }[] = [
  { key: 'parking', label: 'Parking', placeholder: 'Lot, valet, street…' },
  { key: 'lodging', label: 'Lodging Nearby', placeholder: 'Hotels, blocks' },
  { key: 'distance', label: 'Travel Distance', placeholder: 'Distance for guests' },
];
const FIELDS_BOTTOM_RIGHT: { key: keyof Venue; label: string; placeholder: string }[] = [
  { key: 'ceremonyOnSite', label: 'Ceremony On-Site', placeholder: 'Yes / No' },
  { key: 'rainPlan', label: 'Rain Plan', placeholder: 'Tent, indoor backup…' },
  { key: 'restrictions', label: 'Restrictions', placeholder: 'Noise curfew, no flame…' },
];

export function Venues() {
  const { venues, addVenue, updateVenue, removeVenue, setFavoriteVenue } = useShallowStore((s) => ({
    venues: s.venues,
    addVenue: s.addVenue,
    updateVenue: s.updateVenue,
    removeVenue: s.removeVenue,
    setFavoriteVenue: s.setFavoriteVenue,
  }));

  return (
    <div className="space-y-5">
      <Card
        title="Venue Comparison"
        action={
          <Button icon={<Plus size={14} />} onClick={addVenue}>
            Add Venue
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Add and compare venues side-by-side. Star your favorite to highlight it.
        </p>
      </Card>

      {venues.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 size={22} />}
            title="No venues yet"
            description='Click "Add Venue" to start tracking options, costs, and pros/cons.'
            action={
              <Button icon={<Plus size={14} />} onClick={addVenue}>
                Add Venue
              </Button>
            }
          />
        </Card>
      ) : (
        venues.map((v) => (
          <VenueCard
            key={v.id}
            venue={v}
            onUpdate={(patch) => updateVenue(v.id, patch)}
            onStar={() => setFavoriteVenue(v.id)}
            onDelete={async () => {
              if (
                await confirmAction({
                  title: 'Delete venue?',
                  message: `Remove ${v.name || 'this venue'} from your comparison?`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                })
              ) {
                removeVenue(v.id);
              }
            }}
          />
        ))
      )}
    </div>
  );
}

function VenueCard({
  venue,
  onUpdate,
  onStar,
  onDelete,
}: {
  venue: Venue;
  onUpdate: (patch: Partial<Venue>) => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'bg-surface border rounded-xl2 overflow-hidden shadow-soft hover:shadow-lift transition-shadow',
        venue.favorite ? 'border-accent ring-2 ring-accent/30' : 'border-border'
      )}
    >
      <div className="px-5 py-4 bg-gradient-to-br from-bg to-surface border-b border-border flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <EditableText
            value={venue.name}
            onChange={(v) => onUpdate({ name: v })}
            placeholder="Venue Name"
            className="font-display text-2xl text-primary leading-tight"
          />
          <EditableText
            value={venue.location}
            onChange={(v) => onUpdate({ location: v })}
            placeholder="City, State"
            className="text-sm text-muted mt-1"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onStar}
            aria-label="Toggle favorite"
            className={cn(
              'p-2 rounded transition-colors',
              venue.favorite ? 'text-accent' : 'text-muted hover:text-accent'
            )}
          >
            <Star size={20} className={venue.favorite ? 'fill-accent' : ''} />
          </button>
          {venue.website && (
            <a
              href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded text-muted hover:text-ink transition-colors"
              aria-label="Open website"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <IconButton tone="danger" onClick={onDelete} aria-label="Delete venue">
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      <div className="px-5 py-4 grid md:grid-cols-2 gap-x-6 gap-y-1">
        <div>
          {FIELDS_LEFT.map((f) => (
            <FieldRow
              key={f.key}
              label={f.label}
              value={(venue[f.key] || '') as string}
              placeholder={f.placeholder}
              bold={f.key === 'totalCost'}
              onChange={(v) => onUpdate({ [f.key]: v } as Partial<Venue>)}
            />
          ))}
        </div>
        <div>
          {FIELDS_RIGHT.map((f) => (
            <FieldRow
              key={f.key}
              label={f.label}
              value={(venue[f.key] || '') as string}
              placeholder={f.placeholder}
              onChange={(v) => onUpdate({ [f.key]: v } as Partial<Venue>)}
            />
          ))}
        </div>
        <div>
          {FIELDS_BOTTOM_LEFT.map((f) => (
            <FieldRow
              key={f.key}
              label={f.label}
              value={(venue[f.key] || '') as string}
              placeholder={f.placeholder}
              onChange={(v) => onUpdate({ [f.key]: v } as Partial<Venue>)}
            />
          ))}
        </div>
        <div>
          {FIELDS_BOTTOM_RIGHT.map((f) => (
            <FieldRow
              key={f.key}
              label={f.label}
              value={(venue[f.key] || '') as string}
              placeholder={f.placeholder}
              onChange={(v) => onUpdate({ [f.key]: v } as Partial<Venue>)}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pb-5 grid md:grid-cols-2 gap-3">
        <div className="bg-success/5 rounded-lg p-3 border border-success/15">
          <div className="text-xs font-bold uppercase tracking-wide text-success mb-1">Pros</div>
          <Textarea
            value={venue.pros}
            onChange={(e) => onUpdate({ pros: e.target.value })}
            rows={3}
            placeholder="What you love about this venue…"
            className="bg-transparent border-transparent focus:bg-surface text-xs"
          />
        </div>
        <div className="bg-danger/5 rounded-lg p-3 border border-danger/15">
          <div className="text-xs font-bold uppercase tracking-wide text-danger mb-1">Cons</div>
          <Textarea
            value={venue.cons}
            onChange={(e) => onUpdate({ cons: e.target.value })}
            rows={3}
            placeholder="Concerns or drawbacks…"
            className="bg-transparent border-transparent focus:bg-surface text-xs"
          />
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="text-xs font-bold uppercase tracking-wide text-muted mb-1">
          Additional Notes
        </div>
        <Textarea
          value={venue.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={2}
          placeholder="Visit dates, impressions, questions to ask…"
          className="text-xs"
        />
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  placeholder,
  onChange,
  bold,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5">
      <span className="text-xs font-medium text-muted min-w-[110px]">{label}</span>
      <div className="flex-1">
        <EditableText
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          align="right"
          className={cn('text-sm', bold && 'font-bold')}
        />
      </div>
    </div>
  );
}
