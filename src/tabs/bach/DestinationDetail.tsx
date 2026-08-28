import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Trash2,
  Plus,
  X,
  ExternalLink,
  Link2,
  Check,
  Users,
  Crown,
  Calculator,
} from 'lucide-react';
import { useShallowStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Textarea } from '../../components/ui/Field';
import { EditControls } from '../../components/ui/EditControls';
import { EditableText } from '../../components/ui/EditableText';
import { EditableSelect } from '../../components/ui/EditableSelect';
import { useEditSession } from '../../components/ui/useEditSession';
import { confirmAction } from '../../components/ui/ConfirmDialog';
import { cn, fmtMoney, uid } from '../../utils';
import {
  BACH_COST_PRESETS,
  countsFor,
  costBreakdown,
  type BachCounts,
} from '../../bachParty';
import type { BachCostLine, BachDestStatus, ChecklistLink } from '../../types';

/** Add https:// when someone types a bare domain, so the link actually opens. */
const href = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

const STATUSES: BachDestStatus[] = ['Idea', 'Shortlist', 'Booked', 'Passed'];

const STATUS_TONE: Record<BachDestStatus, 'done' | 'pending' | 'neutral' | 'no'> = {
  Booked: 'done',
  Shortlist: 'pending',
  Idea: 'neutral',
  Passed: 'no',
};

const SPLIT_OPTIONS = [
  { value: 'total', label: 'Split by group' },
  { value: 'perPerson', label: 'Each pays' },
];

function SectionTitle({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

/**
 * One location idea on its own page: the trip details, and the cost sheet that
 * turns line items into a per-person price. The price is always derived — from
 * the lines plus the headcount — so it moves when the roster does.
 */
export function DestinationDetail({
  destId,
  roster,
  onBack,
}: {
  destId: string;
  /** Live counts from the roster, so this page prices against real people. */
  roster: BachCounts;
  onBack: () => void;
}) {
  const s = useShallowStore((st) => ({
    dest: st.bachParty.destinations.find((d) => d.id === destId),
    chosenId: st.bachParty.chosenId,
    countMaybes: st.bachParty.countMaybes,
    currency: st.settings.currency,
    updateBachDestination: st.updateBachDestination,
    removeBachDestination: st.removeBachDestination,
    chooseBachDestination: st.chooseBachDestination,
    addBachCostLine: st.addBachCostLine,
    updateBachCostLine: st.updateBachCostLine,
    removeBachCostLine: st.removeBachCostLine,
  }));

  const d = s.dest;
  const [newLine, setNewLine] = useState('');

  if (!d) {
    return (
      <div className="space-y-4">
        <BackLink onBack={onBack} />
        <Card>
          <p className="text-sm text-muted">This location idea no longer exists.</p>
        </Card>
      </div>
    );
  }

  const counts = countsFor(d, roster);
  const b = costBreakdown(d, counts);
  const booked = d.id === s.chosenId;
  const money = (n: number) => fmtMoney(n, s.currency);

  const addLine = (label: string, split: BachCostLine['split'] = 'total') => {
    const preset = BACH_COST_PRESETS.find((p) => p.label.toLowerCase() === label.toLowerCase());
    s.addBachCostLine(d.id, { label, split: preset?.split ?? split });
    setNewLine('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BackLink onBack={onBack} />
        <div className="flex items-center gap-2">
          {booked ? (
            <Badge tone="done">Booked</Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              icon={<Check size={13} />}
              onClick={() => s.chooseBachDestination(d.id)}
            >
              Book this one
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            icon={<Trash2 size={13} />}
            onClick={async () => {
              if (
                await confirmAction({
                  title: 'Delete this idea?',
                  message: `Remove "${d.name || 'this location'}" and its costs? This can't be undone from here.`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                })
              ) {
                s.removeBachDestination(d.id);
                onBack();
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Headline */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="font-display text-3xl text-primary leading-tight">
              <EditableText
                value={d.name}
                onChange={(v) => s.updateBachDestination(d.id, { name: v })}
                placeholder="Where to?"
                ariaLabel="location name"
              />
            </div>
            <div className="text-sm text-muted max-w-sm">
              <EditableText
                value={d.location}
                onChange={(v) => s.updateBachDestination(d.id, { location: v })}
                placeholder="City, state — or the neighborhood"
                ariaLabel="location"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-36">
              <SectionTitle title="Status" />
              <EditableSelect
                value={d.status}
                options={STATUSES}
                onChange={(v) => s.updateBachDestination(d.id, { status: v as BachDestStatus })}
                ariaLabel="status"
                displayClassName="text-sm font-semibold"
              />
            </div>
            <div className="text-right border-l border-border pl-4">
              <div className="text-3xl font-bold text-accent leading-none">
                {money(b.perPerson)}
              </div>
              <div className="text-[11px] text-muted mt-1">per person</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-5 items-start">
        {/* Left: the trip itself */}
        <div className="space-y-5">
          <TripDetails
            dest={d}
            onSave={(patch) => s.updateBachDestination(d.id, patch)}
          />

          <Card>
            <SectionTitle icon={<Link2 size={13} />} title="Links" hint="Listings, itineraries, anything worth reopening." />
            <LinksEditor
              links={d.links}
              onChange={(links) => s.updateBachDestination(d.id, { links })}
            />
          </Card>
        </div>

        {/* Right: the money */}
        <Card className="lg:sticky lg:top-6">
          <SectionTitle
            icon={<Calculator size={13} />}
            title="Cost sheet"
            hint='"Split by group" divides one bill across everyone. "Each pays" is already a per-head price.'
          />

          {/* What headcount the math runs on */}
          <div className="rounded-lg border border-border bg-bg p-3 mb-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Users size={13} />
                Pricing for
              </span>
              <span className="font-semibold tabular-nums">
                {counts.headcount} {counts.headcount === 1 ? 'person' : 'people'}
                {counts.estimated ? ' (estimate)' : ' (from the roster)'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <Input
                type="number"
                min={0}
                className="h-8 py-0 text-xs"
                placeholder={`Estimate a headcount (roster says ${roster.headcount})`}
                value={d.headcountEstimate || ''}
                onChange={(e) =>
                  s.updateBachDestination(d.id, {
                    headcountEstimate: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                aria-label="Headcount estimate"
              />
              {d.headcountEstimate > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => s.updateBachDestination(d.id, { headcountEstimate: 0 })}
                >
                  Use roster
                </Button>
              )}
            </div>
            {counts.honoreeCount > 0 && (
              <div className="text-[11px] text-muted mt-2 inline-flex items-center gap-1">
                <Crown size={11} className="text-accent" />
                {counts.payingCount} paying, {counts.honoreeCount} covered
              </div>
            )}
          </div>

          {/* Lines */}
          {b.lines.length === 0 ? (
            <p className="text-xs text-muted italic py-3 text-center border border-dashed border-border rounded-lg">
              No costs yet. Add lodging, travel, activities…
            </p>
          ) : (
            <div className="space-y-2">
              {b.lines.map(({ line, total, perPayer }) => (
                <div key={line.id} className="rounded-lg border border-border bg-bg p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium">
                      <EditableText
                        value={line.label}
                        onChange={(v) => s.updateBachCostLine(d.id, line.id, { label: v })}
                        placeholder="What is it?"
                        ariaLabel="cost label"
                      />
                    </div>
                    <div className="w-20 text-sm tabular-nums">
                      <EditableText
                        value={line.amount ? String(line.amount) : ''}
                        numeric
                        align="right"
                        blank={money(0)}
                        format={(v) => money(Number(v) || 0)}
                        onChange={(v) =>
                          s.updateBachCostLine(d.id, line.id, { amount: Number(v) || 0 })
                        }
                        ariaLabel="amount"
                      />
                    </div>
                    <button
                      onClick={() => s.removeBachCostLine(d.id, line.id)}
                      className="shrink-0 p-1 text-muted hover:text-danger rounded"
                      aria-label={`Remove ${line.label || 'cost line'}`}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="w-32 text-[11px]">
                      <EditableSelect
                        value={line.split}
                        options={SPLIT_OPTIONS}
                        onChange={(v) =>
                          s.updateBachCostLine(d.id, line.id, {
                            split: v as BachCostLine['split'],
                          })
                        }
                        ariaLabel="how this cost splits"
                        displayClassName="text-[11px] text-muted"
                      />
                    </div>
                    <div className="text-[11px] text-muted tabular-nums shrink-0">
                      {money(total)} total · {money(perPayer)} each
                    </div>
                  </div>

                  {/* Only meaningful once somebody is marked as the honoree. */}
                  {counts.honoreeCount > 0 && (
                    <label className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={line.coversHonoree}
                        onChange={(e) =>
                          s.updateBachCostLine(d.id, line.id, { coversHonoree: e.target.checked })
                        }
                        className="h-3.5 w-3.5 accent-[rgb(var(--c-accent))]"
                      />
                      Group covers his share
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add a line */}
          <div className="flex gap-2 mt-3">
            <Input
              list="bach-cost-presets"
              className="h-8 py-0 text-xs"
              placeholder="Add a cost — lodging, flights, golf…"
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLine.trim()) addLine(newLine.trim());
              }}
            />
            <datalist id="bach-cost-presets">
              {BACH_COST_PRESETS.map((p) => (
                <option key={p.label} value={p.label} />
              ))}
            </datalist>
            <Button
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => addLine(newLine.trim() || 'New cost')}
            >
              Add
            </Button>
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
            <Row label="Trip total" value={money(b.tripTotal)} />
            <Row
              label={`Even split (${counts.headcount || 0} ${counts.headcount === 1 ? 'person' : 'people'})`}
              value={money(counts.headcount ? b.tripTotal / counts.headcount : 0)}
              muted
            />
            {b.honoreeSubsidy > 0.5 && (
              <Row
                label={`Covering ${counts.honoreeCount > 1 ? 'them' : 'him'}`}
                value={`+${money(b.honoreeSubsidy)}`}
                muted
              />
            )}
            <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-border">
              <span className="text-sm font-semibold">Each person pays</span>
              <span className="text-xl font-bold text-accent tabular-nums">
                {money(b.perPerson)}
              </span>
            </div>
            {counts.payingCount === 0 && b.tripTotal > 0 && (
              <p className="text-[11px] text-warning pt-1">
                Nobody is marked <strong>In</strong> yet — set a headcount estimate above to price
                this.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-accent"
    >
      <ArrowLeft size={15} /> Back to the bach party
    </button>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn('text-xs', muted ? 'text-muted' : 'text-ink')}>{label}</span>
      <span className={cn('tabular-nums', muted ? 'text-xs text-muted' : 'font-semibold')}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------ Trip details ----------------------------- */

type DetailsDraft = {
  dates: string;
  nights: string;
  travel: string;
  lodging: string;
  pros: string;
  cons: string;
  notes: string;
};

function TripDetails({
  dest,
  onSave,
}: {
  dest: DetailsDraft & { id: string };
  onSave: (patch: DetailsDraft) => void;
}) {
  const session = useEditSession<DetailsDraft>(
    {
      dates: dest.dates,
      nights: dest.nights,
      travel: dest.travel,
      lodging: dest.lodging,
      pros: dest.pros,
      cons: dest.cons,
      notes: dest.notes,
    },
    onSave
  );
  const v = session.shown;
  const { editing } = session;

  const field = (label: string, key: keyof DetailsDraft, placeholder: string) => (
    <div>
      <SectionTitle title={label} />
      {editing ? (
        <Input
          value={v[key]}
          onChange={(e) => session.set({ [key]: e.target.value } as Partial<DetailsDraft>)}
          placeholder={placeholder}
        />
      ) : (
        <p className={cn('text-sm', v[key] ? 'text-ink' : 'text-muted/70')}>
          {v[key] || placeholder}
        </p>
      )}
    </div>
  );

  const block = (label: string, key: keyof DetailsDraft, placeholder: string, rows = 3) => (
    <div>
      <SectionTitle title={label} />
      {editing ? (
        <Textarea
          value={v[key]}
          onChange={(e) => session.set({ [key]: e.target.value } as Partial<DetailsDraft>)}
          rows={rows}
          placeholder={placeholder}
        />
      ) : v[key].trim() ? (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{v[key]}</p>
      ) : (
        <p className="text-sm text-muted/70">{placeholder}</p>
      )}
    </div>
  );

  return (
    <Card
      title="The trip"
      action={<EditControls session={session} size="sm" what="these details" />}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {field('Dates', 'dates', 'e.g. Apr 17–19')}
        {field('Nights', 'nights', 'e.g. 2')}
        {field('Getting there', 'travel', 'e.g. 3.5 hr drive')}
        {field('Where you’d stay', 'lodging', 'Airbnb, hotel, a buddy’s place…')}
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
        {block('Pros', 'pros', 'What makes this the one?')}
        {block('Cons', 'cons', 'What gives you pause?')}
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        {block('Notes', 'notes', 'Who suggested it, what to book first…', 4)}
      </div>
    </Card>
  );
}

/* -------------------------------- Links ---------------------------------- */

function LinksEditor({
  links,
  onChange,
}: {
  links: ChecklistLink[];
  onChange: (links: ChecklistLink[]) => void;
}) {
  const session = useEditSession<{ links: ChecklistLink[] }>({ links }, (next) =>
    onChange(next.links.filter((l) => l.url.trim()))
  );
  const draft = session.shown.links;

  const setLink = (id: string, patch: Partial<ChecklistLink>) =>
    session.set({ links: draft.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  if (!session.editing) {
    return (
      <div className="space-y-2">
        {links.length ? (
          <ul className="space-y-1.5">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={href(l.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-accent break-all"
                >
                  <ExternalLink size={13} className="shrink-0" />
                  {l.label.trim() || l.url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted/70">No links yet.</p>
        )}
        <EditControls session={session} size="sm" label="Edit links" what="these links" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {draft.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <Input
            value={l.label}
            onChange={(e) => setLink(l.id, { label: e.target.value })}
            placeholder="Label (optional)"
            className="sm:max-w-[180px]"
          />
          <Input
            value={l.url}
            onChange={(e) => setLink(l.id, { url: e.target.value })}
            placeholder="https://…"
            className="flex-1"
          />
          <button
            onClick={() => session.set({ links: draft.filter((x) => x.id !== l.id) })}
            className="shrink-0 p-1.5 text-muted hover:text-danger rounded"
            aria-label="Remove link"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => session.set({ links: [...draft, { id: 'l_' + uid(), label: '', url: '' }] })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent"
        >
          <Plus size={12} /> Add link
        </button>
        <EditControls session={session} size="sm" what="these links" />
      </div>
    </div>
  );
}
