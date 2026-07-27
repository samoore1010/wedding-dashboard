import { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
  Star,
  Check,
  ImagePlus,
  Link2,
  ChevronDown,
  Sparkles,
  Columns3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useShallowStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, LabeledField } from '../../components/ui/Field';
import { EditControls } from '../../components/ui/EditControls';
import { EditableText } from '../../components/ui/EditableText';
import { EditableSelect } from '../../components/ui/EditableSelect';
import { useEditSession } from '../../components/ui/useEditSession';
import { confirmAction } from '../../components/ui/ConfirmDialog';
import { IconButton } from '../../components/ui/IconButton';
import { uploadImage } from '../../images';
import { cn, fmtMoney, uid } from '../../utils';
import { toContacts } from '../../guests/contacts';
import { LOG_KINDS, STARTER_QUESTIONS, makeVendorLogEntry, makeVendorQuestion } from '../../vendors';
import type { Vendor, VendorCandidate, VendorStage } from '../../types';

const STAGES: VendorStage[] = [
  'Not Started',
  'Researching',
  'Inquiry Sent',
  'Meeting Scheduled',
  'Proposal Received',
  'Booked',
  'Paid in Full',
];

const AVAILABILITY = ['Unknown', 'Yes', 'No'];

/** Add https:// so a pasted bare domain still opens. */
const href = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);
const money = (v: string) => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;

/**
 * One vendor category, from first idea to booked.
 *
 * The page grows with the decision: an ideas board while you're still
 * exploring, candidate cards to compare once you have names, and the full
 * detail of whichever one you book.
 */
export function VendorDetail({ vendorId, onBack }: { vendorId: string; onBack: () => void }) {
  const s = useShallowStore((st) => ({
    vendor: st.vendors.find((v) => v.id === vendorId),
    budgetCats: st.budgetCats,
    budgetTotal: st.budgetTotal,
    budgetSpent: st.budgetSpent,
    currency: st.settings.currency,
    updateVendor: st.updateVendor,
    addVendorPin: st.addVendorPin,
    updateVendorPin: st.updateVendorPin,
    removeVendorPin: st.removeVendorPin,
    promoteVendorPin: st.promoteVendorPin,
    addVendorCandidate: st.addVendorCandidate,
    updateVendorCandidate: st.updateVendorCandidate,
    removeVendorCandidate: st.removeVendorCandidate,
    chooseVendorCandidate: st.chooseVendorCandidate,
  }));
  const v = s.vendor;

  const [compare, setCompare] = useState(false);
  const [openCandidate, setOpenCandidate] = useState<string | null>(null);

  if (!v) return null;

  const chosen = v.candidates.find((c) => c.id === v.chosenId);
  const cat = s.budgetCats.find((c) => c.id === v.budgetCatId);
  const allowance = cat ? Math.round((s.budgetTotal * cat.pct) / 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-accent"
        >
          <ArrowLeft size={15} /> Back to vendors
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted">Stage</span>
          <div className="w-44">
            <EditableSelect
              value={v.stage}
              options={STAGES}
              ariaLabel="stage"
              onChange={(next) => s.updateVendor(v.id, { stage: next as VendorStage })}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      <CategoryPanel
        vendor={v}
        budgetCats={s.budgetCats}
        allowance={allowance}
        currency={s.currency}
        chosenCost={chosen ? money(chosen.finalPrice || chosen.quote) : 0}
        onSave={(next) => s.updateVendor(v.id, next)}
      />

      <IdeaBoard
        vendor={v}
        onAdd={(pin) => s.addVendorPin(v.id, pin)}
        onUpdate={(pinId, patch) => s.updateVendorPin(v.id, pinId, patch)}
        onRemove={(pinId) => s.removeVendorPin(v.id, pinId)}
        onPromote={(pinId) => {
          s.promoteVendorPin(v.id, pinId);
          toast.success('Added to your shortlist');
        }}
      />

      <Card
        title={`Shortlist${v.candidates.length ? ` · ${v.candidates.length}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {v.candidates.length > 1 && (
              <Button
                variant={compare ? 'primary' : 'outline'}
                size="sm"
                icon={<Columns3 size={13} />}
                onClick={() => setCompare((c) => !c)}
              >
                Compare
              </Button>
            )}
            <Button
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setOpenCandidate(s.addVendorCandidate(v.id))}
            >
              Add candidate
            </Button>
          </div>
        }
      >
        {v.candidates.length === 0 ? (
          <p className="text-sm text-muted/80">
            No candidates yet. Add one when you have a name, or promote an idea from the board
            above.
          </p>
        ) : compare ? (
          <CompareTable candidates={v.candidates} chosenId={v.chosenId} currency={s.currency} />
        ) : (
          <div className="space-y-3">
            {v.candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                chosen={c.id === v.chosenId}
                expanded={openCandidate === c.id}
                onToggle={() => setOpenCandidate((o) => (o === c.id ? null : c.id))}
                onSave={(next) => s.updateVendorCandidate(v.id, c.id, next)}
                onChoose={() => s.chooseVendorCandidate(v.id, c.id)}
                onRemove={async () => {
                  if (
                    await confirmAction({
                      title: 'Remove candidate?',
                      message: `Remove "${c.name || 'this candidate'}" and everything recorded about them?`,
                      confirmLabel: 'Remove',
                      variant: 'danger',
                    })
                  ) {
                    s.removeVendorCandidate(v.id, c.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Category panel ----------------------------- */

function CategoryPanel({
  vendor: v,
  budgetCats,
  allowance,
  currency,
  chosenCost,
  onSave,
}: {
  vendor: Vendor;
  budgetCats: { id: string; name: string; pct: number }[];
  allowance: number;
  currency: string;
  chosenCost: number;
  onSave: (next: Vendor) => void;
}) {
  const session = useEditSession(v, onSave);
  const d = session.shown;
  const { editing } = session;
  const over = chosenCost > 0 && allowance > 0 && chosenCost > allowance;

  return (
    <Card
      title={
        editing ? (
          <Input
            value={d.type}
            onChange={(e) => session.set({ type: e.target.value })}
            placeholder="Category, e.g. Photographer"
            className="text-xl"
          />
        ) : (
          v.type || 'Untitled category'
        )
      }
      action={<EditControls session={session} size="sm" what="this category" />}
    >
      <div className="space-y-4">
        <LabeledField label="What we're going for">
          {editing ? (
            <textarea
              value={d.notes}
              onChange={(e) => session.set({ notes: e.target.value })}
              rows={3}
              placeholder="DJ or band? Must-haves, style, open questions…"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted/70 resize-y"
            />
          ) : v.notes.trim() ? (
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{v.notes}</p>
          ) : (
            <p className="text-sm text-muted/70">
              Nothing written down yet — what are you after in this category?
            </p>
          )}
        </LabeledField>

        <LabeledField label="Paid from">
          {editing ? (
            <Select
              value={d.budgetCatId}
              onChange={(e) => session.set({ budgetCatId: e.target.value })}
              className="max-w-xs"
            >
              <option value="">— no budget category —</option>
              {budgetCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : allowance > 0 ? (
            <p className="text-sm">
              <span className="text-ink">{budgetCats.find((c) => c.id === v.budgetCatId)?.name}</span>
              <span className="text-muted"> · allowance {fmtMoney(allowance, currency)}</span>
              {chosenCost > 0 && (
                <span className={cn('font-semibold', over ? 'text-danger' : 'text-success')}>
                  {' '}
                  · booked {fmtMoney(chosenCost, currency)}
                  {over ? ' (over)' : ''}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted/70">Not linked to a budget category.</p>
          )}
          {!editing && allowance > 0 && (
            <p className="text-[11px] text-muted mt-1">
              Shown for reference — your budget figures only change when you change them.
            </p>
          )}
        </LabeledField>
      </div>
    </Card>
  );
}

/* -------------------------------- Idea board ------------------------------- */

function IdeaBoard({
  vendor: v,
  onAdd,
  onUpdate,
  onRemove,
  onPromote,
}: {
  vendor: Vendor;
  onAdd: (pin: { url?: string; caption?: string; image?: string }) => void;
  onUpdate: (pinId: string, patch: { caption?: string }) => void;
  onRemove: (pinId: string) => void;
  onPromote: (pinId: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const addLink = () => {
    if (!url.trim() && !caption.trim()) return;
    onAdd({ url: url.trim(), caption: caption.trim() });
    setUrl('');
    setCaption('');
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const { src } = await uploadImage(file);
        onAdd({ image: src, caption: '' });
      } catch (e: any) {
        toast.error(e?.message ?? 'Could not add that image');
      }
    }
    setUploading(false);
  };

  return (
    <Card title="Ideas">
      <p className="text-xs text-muted mb-3">
        Anything that inspires you — an Instagram post, a website, a screenshot. No names needed
        yet; promote one to your shortlist when it turns into a real option.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLink()}
          placeholder="Paste a link…"
          className="flex-1"
        />
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLink()}
          placeholder="Note (optional)"
          className="sm:max-w-[220px]"
        />
        <Button variant="outline" icon={<Link2 size={13} />} onClick={addLink}>
          Pin
        </Button>
        <label
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-border px-4 h-9 text-sm font-medium cursor-pointer hover:border-primary hover:bg-bg whitespace-nowrap',
            uploading && 'opacity-60 pointer-events-none'
          )}
        >
          <ImagePlus size={13} />
          {uploading ? 'Adding…' : 'Image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              addImages(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {v.pins.length === 0 ? (
        <p className="text-sm text-muted/70">Nothing pinned yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {v.pins.map((p) => (
            <div
              key={p.id}
              className="group relative border border-border rounded-xl2 overflow-hidden bg-bg/40 flex flex-col"
            >
              {p.image ? (
                <img src={p.image} alt={p.caption} className="w-full h-32 object-cover" />
              ) : (
                <a
                  href={href(p.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="h-32 flex items-center justify-center px-3 text-center text-xs text-primary hover:text-accent break-all"
                >
                  <span className="line-clamp-4">{p.url || 'No link'}</span>
                </a>
              )}
              <div className="p-2 flex-1 flex flex-col gap-1">
                <EditableText
                  value={p.caption}
                  onChange={(next) => onUpdate(p.id, { caption: next })}
                  ariaLabel="pin note"
                  placeholder="Add a note"
                  className="text-xs"
                />
                {p.image && p.url && (
                  <a
                    href={href(p.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:text-accent inline-flex items-center gap-1 break-all"
                  >
                    <ExternalLink size={10} /> link
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border px-1.5 py-1">
                <button
                  onClick={() => onPromote(p.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-accent"
                  title="Move this idea to your shortlist"
                >
                  <Sparkles size={11} /> Shortlist
                </button>
                <IconButton
                  tone="danger"
                  aria-label="Remove pin"
                  onClick={async () => {
                    if (
                      await confirmAction({
                        title: 'Remove idea?',
                        message: 'Remove this pin from the board?',
                        confirmLabel: 'Remove',
                        variant: 'danger',
                      })
                    ) {
                      onRemove(p.id);
                    }
                  }}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Compare table ------------------------------ */

function CompareTable({
  candidates,
  chosenId,
  currency,
}: {
  candidates: VendorCandidate[];
  chosenId: string;
  currency: string;
}) {
  const rows: { label: string; get: (c: VendorCandidate) => string }[] = [
    { label: 'Price', get: (c) => (c.finalPrice || c.quote ? fmtMoney(money(c.finalPrice || c.quote), currency) : '—') },
    { label: 'Available on our date', get: (c) => c.available },
    { label: 'Package', get: (c) => c.packageName || '—' },
    { label: 'Included', get: (c) => c.included || '—' },
    { label: 'Extra cost', get: (c) => c.extras || '—' },
    { label: 'Pros', get: (c) => c.pros || '—' },
    { label: 'Cons', get: (c) => c.cons || '—' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[11px] font-bold uppercase tracking-wider text-muted px-2 py-2 w-40" />
            {candidates.map((c) => (
              <th key={c.id} className="text-left px-2 py-2 min-w-[160px] align-bottom">
                <div className="font-display text-lg text-ink leading-tight">
                  {c.name || 'Unnamed'}
                </div>
                <div className="flex items-center gap-2">
                  <Stars value={c.rating} />
                  {c.id === chosenId && (
                    <span className="text-[10px] font-bold uppercase text-success">Booked</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-muted align-top">
                {r.label}
              </td>
              {candidates.map((c) => (
                <td key={c.id} className="px-2 py-2 align-top whitespace-pre-wrap text-ink">
                  {r.get(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Read-only unless `onChange` is given — the summary row is itself a button,
 * and a button inside a button is invalid and unreachable by keyboard.
 */
function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  if (!onChange) {
    if (!value) return null;
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={13} className={n <= value ? 'text-accent fill-accent' : 'text-border'} />
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="hover:scale-110 transition-transform"
        >
          <Star size={13} className={n <= value ? 'text-accent fill-accent' : 'text-border'} />
        </button>
      ))}
    </span>
  );
}

/* ----------------------------- Candidate card ------------------------------ */

function CandidateCard({
  candidate: c,
  chosen,
  expanded,
  onToggle,
  onSave,
  onChoose,
  onRemove,
}: {
  candidate: VendorCandidate;
  chosen: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (next: VendorCandidate) => void;
  onChoose: () => void;
  onRemove: () => void;
}) {
  const session = useEditSession(c, onSave);
  const d = session.shown;
  const { editing } = session;

  const setQuestion = (id: string, patch: Partial<VendorCandidate['questions'][number]>) =>
    session.set({ questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  const setLog = (id: string, patch: Partial<VendorCandidate['log'][number]>) =>
    session.set({ log: d.log.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  return (
    <div
      className={cn(
        'border rounded-xl2 overflow-hidden',
        chosen ? 'border-success/60 bg-success/5' : 'border-border'
      )}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 p-3">
        {c.image && (
          <img src={c.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        )}
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-lg text-ink leading-tight">
              {c.name || 'Unnamed candidate'}
            </span>
            {chosen && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-success/15 text-success">
                Booked
              </span>
            )}
            {c.available === 'No' && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-danger/12 text-danger">
                Unavailable
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
            <Stars value={c.rating} />
            {(c.finalPrice || c.quote) && <span>{c.finalPrice || c.quote}</span>}
            {c.packageName && <span>· {c.packageName}</span>}
          </div>
        </button>
        <Button
          variant={chosen ? 'soft' : 'outline'}
          size="sm"
          icon={<Check size={13} />}
          onClick={onChoose}
        >
          {chosen ? 'Booked' : 'Mark as booked'}
        </Button>
        <button
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="p-1 text-muted hover:text-ink"
        >
          <ChevronDown size={16} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-5">
          <div className="flex items-center justify-end">
            <EditControls session={session} size="sm" what="this candidate" />
          </div>

          {/* Identity + shortlist fields */}
          <div className="grid sm:grid-cols-2 gap-3">
            <LabeledField label="Name">
              <Input
                value={d.name}
                disabled={!editing}
                onChange={(e) => session.set({ name: e.target.value })}
                placeholder="Business name"
              />
            </LabeledField>
            <LabeledField label="Your rating">
              <div className="h-9 flex items-center">
                {editing ? (
                  <Stars value={d.rating} onChange={(rating) => session.set({ rating })} />
                ) : d.rating ? (
                  <Stars value={d.rating} />
                ) : (
                  <span className="text-sm text-muted/70">Not rated</span>
                )}
              </div>
            </LabeledField>
            <LabeledField label="Quote">
              <Input
                value={d.quote}
                disabled={!editing}
                onChange={(e) => session.set({ quote: e.target.value })}
                placeholder="e.g. 3200"
              />
            </LabeledField>
            <LabeledField label="Available on our date">
              <Select
                value={d.available}
                disabled={!editing}
                onChange={(e) => session.set({ available: e.target.value as VendorCandidate['available'] })}
              >
                {AVAILABILITY.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </LabeledField>
            <LabeledField label="Package">
              <Input
                value={d.packageName}
                disabled={!editing}
                onChange={(e) => session.set({ packageName: e.target.value })}
                placeholder="e.g. 8-hour coverage"
              />
            </LabeledField>
            <LabeledField label="Website">
              <Input
                value={d.website}
                disabled={!editing}
                onChange={(e) => session.set({ website: e.target.value })}
                placeholder="https://…"
              />
            </LabeledField>
            <LabeledField label="Pros">
              <Input
                value={d.pros}
                disabled={!editing}
                onChange={(e) => session.set({ pros: e.target.value })}
                placeholder="What you liked"
              />
            </LabeledField>
            <LabeledField label="Cons">
              <Input
                value={d.cons}
                disabled={!editing}
                onChange={(e) => session.set({ cons: e.target.value })}
                placeholder="What gave you pause"
              />
            </LabeledField>
          </div>

          <Section title="Contact">
            <div className="grid sm:grid-cols-2 gap-3">
              <LabeledField label="Contact person">
                <Input
                  value={d.contact}
                  disabled={!editing}
                  onChange={(e) => session.set({ contact: e.target.value })}
                  placeholder="Who you deal with"
                />
              </LabeledField>
              <LabeledField label="Instagram">
                <Input
                  value={d.instagram}
                  disabled={!editing}
                  onChange={(e) => session.set({ instagram: e.target.value })}
                  placeholder="@handle or link"
                />
              </LabeledField>
              <LabeledField label="Emails">
                <Input
                  value={d.emails.join('; ')}
                  disabled={!editing}
                  onChange={(e) => session.set({ emails: e.target.value.split(';').map((x) => x.trim()) })}
                  onBlur={() => session.set({ emails: toContacts(d.emails) })}
                  placeholder="name@studio.com; office@studio.com"
                />
              </LabeledField>
              <LabeledField label="Phones">
                <Input
                  value={d.phones.join('; ')}
                  disabled={!editing}
                  onChange={(e) => session.set({ phones: e.target.value.split(';').map((x) => x.trim()) })}
                  onBlur={() => session.set({ phones: toContacts(d.phones) })}
                  placeholder="(555) 123-4567; (555) 222-3333"
                />
              </LabeledField>
            </div>
          </Section>

          <Section title="Money">
            <div className="grid sm:grid-cols-2 gap-3">
              <LabeledField label="Final price">
                <Input
                  value={d.finalPrice}
                  disabled={!editing}
                  onChange={(e) => session.set({ finalPrice: e.target.value })}
                  placeholder="Contracted total"
                />
              </LabeledField>
              <LabeledField label="Deposit">
                <Input
                  value={d.deposit}
                  disabled={!editing}
                  onChange={(e) => session.set({ deposit: e.target.value })}
                  placeholder="Amount"
                />
              </LabeledField>
              <LabeledField label="Deposit paid">
                <Input
                  type="date"
                  value={d.depositPaid}
                  disabled={!editing}
                  onChange={(e) => session.set({ depositPaid: e.target.value })}
                />
              </LabeledField>
              <LabeledField label="What's included">
                <Input
                  value={d.included}
                  disabled={!editing}
                  onChange={(e) => session.set({ included: e.target.value })}
                  placeholder="Hours, prints, second shooter…"
                />
              </LabeledField>
              <LabeledField label="Costs extra">
                <Input
                  value={d.extras}
                  disabled={!editing}
                  onChange={(e) => session.set({ extras: e.target.value })}
                  placeholder="Travel, overtime, albums…"
                />
              </LabeledField>
            </div>
          </Section>

          <Section title="Logistics">
            <div className="grid sm:grid-cols-2 gap-3">
              <LabeledField label="Contract signed">
                <Input
                  type="date"
                  value={d.contractSigned}
                  disabled={!editing}
                  onChange={(e) => session.set({ contractSigned: e.target.value })}
                />
              </LabeledField>
              <LabeledField label="Arrival time">
                <Input
                  value={d.arrivalTime}
                  disabled={!editing}
                  onChange={(e) => session.set({ arrivalTime: e.target.value })}
                  placeholder="e.g. 1:00 PM"
                />
              </LabeledField>
              <LabeledField label="Hours of coverage">
                <Input
                  value={d.coverageHours}
                  disabled={!editing}
                  onChange={(e) => session.set({ coverageHours: e.target.value })}
                  placeholder="e.g. 8 hours"
                />
              </LabeledField>
              <LabeledField label="Setup needs">
                <Input
                  value={d.setupNeeds}
                  disabled={!editing}
                  onChange={(e) => session.set({ setupNeeds: e.target.value })}
                  placeholder="Power, space, meal…"
                />
              </LabeledField>
              <LabeledField label="Cancellation policy" className="sm:col-span-2">
                <Input
                  value={d.cancellation}
                  disabled={!editing}
                  onChange={(e) => session.set({ cancellation: e.target.value })}
                  placeholder="What happens if either side cancels"
                />
              </LabeledField>
            </div>
          </Section>

          <Section title="Questions to ask">
            <div className="space-y-2">
              {d.questions.length === 0 && !editing && (
                <p className="text-sm text-muted/70">No questions yet.</p>
              )}
              {d.questions.map((q) => (
                <div key={q.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={q.asked}
                    disabled={!editing}
                    onChange={(e) => setQuestion(q.id, { asked: e.target.checked })}
                    className="h-4 w-4 mt-2 accent-sage shrink-0"
                    aria-label="Asked"
                  />
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <Input
                      value={q.text}
                      disabled={!editing}
                      onChange={(e) => setQuestion(q.id, { text: e.target.value })}
                      placeholder="Question"
                      className={cn('text-sm', q.asked && 'line-through')}
                    />
                    <Input
                      value={q.answer}
                      disabled={!editing}
                      onChange={(e) => setQuestion(q.id, { answer: e.target.value })}
                      placeholder="Their answer"
                      className="text-sm"
                    />
                  </div>
                  {editing && (
                    <IconButton
                      tone="danger"
                      aria-label="Remove question"
                      onClick={() => session.set({ questions: d.questions.filter((x) => x.id !== q.id) })}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  )}
                </div>
              ))}
              {editing && (
                <div className="flex gap-3">
                  <button
                    onClick={() => session.set({ questions: [...d.questions, makeVendorQuestion()] })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent"
                  >
                    <Plus size={12} /> Add question
                  </button>
                  {d.questions.length === 0 && (
                    <button
                      onClick={() =>
                        session.set({
                          questions: STARTER_QUESTIONS.map((text) => makeVendorQuestion({ text })),
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent"
                    >
                      <Sparkles size={12} /> Use the standard five
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section title="Contact log">
            <div className="space-y-2">
              {d.log.length === 0 && !editing && (
                <p className="text-sm text-muted/70">Nothing logged yet.</p>
              )}
              {d.log.map((l) => (
                <div key={l.id} className="flex items-start gap-2">
                  <Input
                    type="date"
                    value={l.date}
                    disabled={!editing}
                    onChange={(e) => setLog(l.id, { date: e.target.value })}
                    className="text-sm w-40 shrink-0"
                  />
                  <Select
                    value={l.kind}
                    disabled={!editing}
                    onChange={(e) => setLog(l.id, { kind: e.target.value })}
                    className="text-sm w-36 shrink-0"
                  >
                    {LOG_KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </Select>
                  <Input
                    value={l.note}
                    disabled={!editing}
                    onChange={(e) => setLog(l.id, { note: e.target.value })}
                    placeholder="What happened"
                    className="text-sm flex-1"
                  />
                  {editing && (
                    <IconButton
                      tone="danger"
                      aria-label="Remove entry"
                      onClick={() => session.set({ log: d.log.filter((x) => x.id !== l.id) })}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  )}
                </div>
              ))}
              {editing && (
                <button
                  onClick={() => session.set({ log: [...d.log, makeVendorLogEntry()] })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent"
                >
                  <Plus size={12} /> Add entry
                </button>
              )}
            </div>
          </Section>

          <Section title="Links">
            <div className="space-y-2">
              {editing ? (
                <>
                  {d.links.map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Input
                        value={l.label}
                        onChange={(e) =>
                          session.set({
                            links: d.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)),
                          })
                        }
                        placeholder="Label"
                        className="sm:max-w-[200px]"
                      />
                      <Input
                        value={l.url}
                        onChange={(e) =>
                          session.set({
                            links: d.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)),
                          })
                        }
                        placeholder="https://…"
                        className="flex-1"
                      />
                      <IconButton
                        tone="danger"
                        aria-label="Remove link"
                        onClick={() => session.set({ links: d.links.filter((x) => x.id !== l.id) })}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      session.set({ links: [...d.links, { id: 'l_' + uid(), label: '', url: '' }] })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent"
                  >
                    <Plus size={12} /> Add link
                  </button>
                </>
              ) : c.links.length ? (
                <ul className="space-y-1">
                  {c.links.map((l) => (
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
            </div>
          </Section>

          <Section title="Notes">
            {editing ? (
              <textarea
                value={d.notes}
                onChange={(e) => session.set({ notes: e.target.value })}
                rows={4}
                placeholder="Anything else worth remembering"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted/70 resize-y"
              />
            ) : c.notes.trim() ? (
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{c.notes}</p>
            ) : (
              <p className="text-sm text-muted/70">No notes yet.</p>
            )}
          </Section>

          <div className="pt-1">
            <Button
              variant="ghost"
              className="text-danger"
              icon={<Trash2 size={14} />}
              disabled={editing}
              onClick={onRemove}
            >
              Remove candidate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">{title}</div>
      {children}
    </div>
  );
}
