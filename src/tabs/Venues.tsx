import { useState } from 'react';
import { Plus, Trash2, Printer, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EditableText } from '../components/ui/EditableText';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import { cn, formatDate } from '../utils';
import type { Audience, VenueField, VenueHotel, VenueSection, WeekendEvent, WeddingSettings } from '../types';

const fmtTime = (t: string) => {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
};

export function Venues() {
  const s = useShallowStore((st) => ({
    plan: st.venuePlan,
    settings: st.settings,
    weekend: st.weekend,
    addVenueSection: st.addVenueSection,
    updateVenueSection: st.updateVenueSection,
    removeVenueSection: st.removeVenueSection,
    moveVenueSection: st.moveVenueSection,
    addVenueField: st.addVenueField,
    updateVenueField: st.updateVenueField,
    removeVenueField: st.removeVenueField,
    addVenueHotel: st.addVenueHotel,
    updateVenueHotel: st.updateVenueHotel,
    removeVenueHotel: st.removeVenueHotel,
  }));

  const [view, setView] = useState<'planner' | 'guide'>('planner');
  const [hideInternal, setHideInternal] = useState(false);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-2xl text-primary leading-tight">
              {s.plan.venueName || s.settings.venueName || 'Your Venue'}
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Plan everything about your venue. Tag each detail for you or your guests, then export a guest guide.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-bg p-1 rounded-full">
              {(['planner', 'guide'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                    view === v ? 'bg-primary text-white' : 'text-muted hover:text-ink'
                  )}
                >
                  {v === 'planner' ? 'Planner' : 'Guest Guide'}
                </button>
              ))}
            </div>
            {view === 'guide' && (
              <Button size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
                Save as PDF
              </Button>
            )}
          </div>
        </div>
      </Card>

      {view === 'planner' ? (
        <Planner store={s} hideInternal={hideInternal} setHideInternal={setHideInternal} />
      ) : (
        <GuestGuide plan={s.plan} settings={s.settings} weekend={s.weekend} />
      )}
    </div>
  );
}

/* ------------------------------- Planner --------------------------------- */

function Planner({
  store,
  hideInternal,
  setHideInternal,
}: {
  store: any;
  hideInternal: boolean;
  setHideInternal: (v: boolean) => void;
}) {
  const { plan } = store;
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted flex-wrap px-1">
        <button
          onClick={() => setHideInternal(!hideInternal)}
          aria-pressed={hideInternal}
          className={cn(
            'relative w-9 h-[22px] rounded-full transition-colors',
            hideInternal ? 'bg-sage' : 'bg-border'
          )}
        >
          <span
            className={cn(
              'absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform',
              hideInternal && 'translate-x-4'
            )}
          />
        </button>
        <span>Hide internal-only (preview what guests see)</span>
        <span className="ml-auto flex gap-2">
          <AudienceTag audience="guest" />
          <AudienceTag audience="internal" />
        </span>
      </div>

      {plan.sections.map((sec: VenueSection, i: number) => (
        <SectionCard
          key={sec.id}
          section={sec}
          store={store}
          hideInternal={hideInternal}
          isFirst={i === 0}
          isLast={i === plan.sections.length - 1}
          weekend={store.weekend}
        />
      ))}

      <button
        onClick={() => store.addVenueSection()}
        className="w-full border border-dashed border-border rounded-xl2 py-3 text-sm font-semibold text-primary hover:border-accent hover:bg-accent/5 transition-colors inline-flex items-center justify-center gap-2"
      >
        <Plus size={15} /> Add section / category
      </button>
    </>
  );
}

function AudienceTag({ audience, onClick }: { audience: Audience; onClick?: () => void }) {
  const guest = audience === 'guest';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded inline-flex items-center gap-1',
        guest ? 'text-sage bg-sage/15' : 'text-primary bg-primary/12',
        onClick && 'cursor-pointer hover:brightness-95'
      )}
      title={onClick ? 'Click to change who sees this' : undefined}
    >
      {guest ? '🌐 Guest' : '🔒 Just us'}
    </button>
  );
}

function SectionCard({
  section: sec,
  store,
  hideInternal,
  isFirst,
  isLast,
  weekend,
}: {
  section: VenueSection;
  store: any;
  hideInternal: boolean;
  isFirst: boolean;
  isLast: boolean;
  weekend: WeekendEvent[];
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => {
            const ico = window.prompt('Section icon (emoji):', sec.icon);
            if (ico) store.updateVenueSection(sec.id, { icon: ico.trim().slice(0, 2) });
          }}
          className="w-9 h-9 rounded-[10px] bg-accent-soft/50 text-accent flex items-center justify-center text-lg shrink-0 hover:brightness-95"
          title="Change icon"
        >
          {sec.icon}
        </button>
        <EditableText
          value={sec.title}
          onChange={(v) => store.updateVenueSection(sec.id, { title: v })}
          placeholder="Section title"
          className="font-display text-xl text-primary leading-tight flex-1"
        />
        <div className="flex items-center gap-0.5">
          <IconButton onClick={() => store.moveVenueSection(sec.id, -1)} disabled={isFirst} aria-label="Move up">
            <ChevronUp size={15} />
          </IconButton>
          <IconButton onClick={() => store.moveVenueSection(sec.id, 1)} disabled={isLast} aria-label="Move down">
            <ChevronDown size={15} />
          </IconButton>
          <IconButton
            tone="danger"
            aria-label="Delete section"
            onClick={async () => {
              if (
                await confirmAction({
                  title: 'Delete section?',
                  message: `Remove "${sec.title || 'this section'}" and all its fields?`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                })
              )
                store.removeVenueSection(sec.id);
            }}
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      {/* Weekend synced list */}
      {sec.kind === 'weekend' && (
        <div className="mb-3">
          {weekend.length === 0 ? (
            <p className="text-xs text-muted italic">
              No weekend events yet — add them in the Day-Of tab and they'll appear here and in the guest guide.
            </p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {weekend.map((w) => (
                <div key={w.id} className="grid grid-cols-[92px_1fr_auto] gap-3 items-center px-3 py-2 text-sm">
                  <span className="text-[11px] font-bold uppercase text-accent">{w.day}</span>
                  <span>{w.event || '—'}</span>
                  <span className="text-xs text-muted">{w.time}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted italic mt-1.5">↳ Synced from Day-Of.</p>
        </div>
      )}

      {/* Fields */}
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
        {sec.fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            hidden={hideInternal && f.audience === 'internal'}
            onLabel={(v) => store.updateVenueField(sec.id, f.id, { label: v })}
            onValue={(v) => store.updateVenueField(sec.id, f.id, { value: v })}
            onAudience={() =>
              store.updateVenueField(sec.id, f.id, {
                audience: f.audience === 'guest' ? 'internal' : 'guest',
              })
            }
            onDelete={() => store.removeVenueField(sec.id, f.id)}
          />
        ))}
      </div>

      {/* Hotels */}
      {sec.kind === 'hotels' && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1.5">
            NEARBY HOTELS <AudienceTag audience="guest" />
          </div>
          <div className="space-y-2">
            {(sec.hotels ?? []).map((h) => (
              <HotelRow
                key={h.id}
                hotel={h}
                onChange={(patch) => store.updateVenueHotel(sec.id, h.id, patch)}
                onDelete={() => store.removeVenueHotel(sec.id, h.id)}
              />
            ))}
          </div>
          <button
            onClick={() => store.addVenueHotel(sec.id)}
            className="mt-2 border border-dashed border-border rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:border-accent hover:bg-accent/5 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus size={13} /> Add hotel
          </button>
        </div>
      )}

      <button
        onClick={() => store.addVenueField(sec.id)}
        className="mt-3 border border-dashed border-border rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:border-accent hover:bg-accent/5 transition-colors inline-flex items-center gap-1.5"
      >
        <Plus size={13} /> Add field
      </button>
    </Card>
  );
}

function FieldRow({
  field: f,
  hidden,
  onLabel,
  onValue,
  onAudience,
  onDelete,
}: {
  field: VenueField;
  hidden: boolean;
  onLabel: (v: string) => void;
  onValue: (v: string) => void;
  onAudience: () => void;
  onDelete: () => void;
}) {
  if (hidden) return null;
  return (
    <div className={cn('group py-1.5', f.span && 'sm:col-span-2')}>
      <div className="flex items-center gap-1.5">
        <EditableText
          value={f.label}
          onChange={onLabel}
          placeholder="Label"
          className="text-[11px] font-semibold text-muted"
        />
        <AudienceTag audience={f.audience} onClick={onAudience} />
        <button
          onClick={onDelete}
          className="ml-auto text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
          aria-label="Remove field"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <EditableText value={f.value} onChange={onValue} placeholder="Add detail…" className="text-sm" />
    </div>
  );
}

function HotelRow({
  hotel: h,
  onChange,
  onDelete,
}: {
  hotel: VenueHotel;
  onChange: (patch: Partial<VenueHotel>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group border border-border rounded-xl2 p-3">
      <div className="flex items-center gap-2">
        <EditableText
          value={h.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="Hotel name"
          className="font-medium text-sm flex-1"
        />
        <button
          onClick={onDelete}
          className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
          aria-label="Remove hotel"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 mt-1">
        <MiniField label="Distance" value={h.distance} onChange={(v) => onChange({ distance: v })} />
        <MiniField label="Price / night" value={h.price} onChange={(v) => onChange({ price: v })} />
        <MiniField label="Phone" value={h.phone} onChange={(v) => onChange({ phone: v })} />
        <MiniField label="Block code" value={h.blockCode} onChange={(v) => onChange({ blockCode: v })} />
        <div className="col-span-2 sm:col-span-4">
          <MiniField label="Booking link" value={h.link} onChange={(v) => onChange({ link: v })} />
        </div>
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted uppercase tracking-wide mt-1">{label}</div>
      <EditableText value={value} onChange={onChange} placeholder="—" className="text-xs" />
    </div>
  );
}

/* ------------------------------ Guest Guide ------------------------------ */

function GuestGuide({
  plan,
  settings,
  weekend,
}: {
  plan: { venueName: string; sections: VenueSection[] };
  settings: WeddingSettings;
  weekend: WeekendEvent[];
}) {
  const couple =
    [settings.brideName, settings.groomName].filter(Boolean).join(' & ') || 'Our Wedding';
  const dateLine = settings.weddingDate ? formatDate(settings.weddingDate) : '';
  const venueName = plan.venueName || settings.venueName || '';

  // Does the guide have any guest-facing content at all?
  const hasContent = plan.sections.some(
    (s) =>
      s.fields.some((f) => f.audience === 'guest' && f.value.trim()) ||
      (s.kind === 'hotels' && (s.hotels ?? []).length) ||
      (s.kind === 'weekend' && weekend.length)
  );

  return (
    <>
      <p className="text-xs text-muted px-1 mb-2 no-print">
        This is exactly what exports — only <b>🌐 guest-facing</b> content, in order. Use{' '}
        <b>Save as PDF</b> and choose “Save as PDF” as the destination.
      </p>
      <div
        className="venue-guide mx-auto max-w-[760px] rounded-lg overflow-hidden border border-border"
        style={{ background: '#fdfcf9', color: '#3a3530', boxShadow: '0 8px 40px rgba(40,33,28,0.14)' }}
      >
        {/* Band */}
        <div
          className="text-center px-8 sm:px-12 pt-10 pb-7"
          style={{ background: 'linear-gradient(180deg,#f6f1e6,#fdfcf9)', borderBottom: '1px solid #ece5d8' }}
        >
          <div className="font-display" style={{ fontSize: 13, letterSpacing: '0.4em', textTransform: 'uppercase', color: '#a8926a' }}>
            You're invited to the wedding of
          </div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 46, lineHeight: 1.05, margin: '6px 0 4px', color: '#5a4f42' }}>
            {couple}
          </h1>
          {dateLine && (
            <div style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#8a8177' }}>
              {dateLine}
              {venueName ? ` · ${venueName}` : ''}
            </div>
          )}
          <div className="flex items-center justify-center gap-2.5 mt-3.5" style={{ color: '#c9a96e' }} aria-hidden>
            <span style={{ height: 1, width: 64, background: '#dfd3b8' }} />✦
            <span style={{ height: 1, width: 64, background: '#dfd3b8' }} />
          </div>
        </div>

        {/* Body */}
        <div className="px-8 sm:px-12 pt-8 pb-10">
          {!hasContent && (
            <p style={{ color: '#8a8177', textAlign: 'center', fontSize: 14 }}>
              Nothing to show yet. In the Planner, add details and tag them 🌐 Guest — they'll appear here.
            </p>
          )}
          {plan.sections.map((sec) => (
            <GuideSection key={sec.id} section={sec} weekend={weekend} />
          ))}
        </div>

        {/* Foot */}
        <div className="text-center px-8 sm:px-12 pt-6 pb-10" style={{ borderTop: '1px solid #ece5d8' }}>
          <div className="font-display" style={{ fontSize: 22, color: '#5a4f42' }}>
            We can't wait to celebrate with you
          </div>
        </div>
      </div>
    </>
  );
}

function GuideSection({ section: sec, weekend }: { section: VenueSection; weekend: WeekendEvent[] }) {
  const guestFields = sec.fields.filter((f) => f.audience === 'guest' && f.value.trim());
  const hotels = sec.kind === 'hotels' ? sec.hotels ?? [] : [];
  const showWeekend = sec.kind === 'weekend' && weekend.length > 0;
  if (guestFields.length === 0 && hotels.length === 0 && !showWeekend) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <h2 className="font-display" style={{ fontSize: 23, fontWeight: 600, color: '#5a4f42', marginBottom: 8 }}>
        {sec.title}
      </h2>
      {guestFields.map((f) => (
        <p key={f.id} style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 5px' }}>
          <span style={{ color: '#8a8177' }}>{f.label}:</span> {f.value}
        </p>
      ))}
      {hotels.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2.5 mt-2">
          {hotels.map((h) => (
            <div key={h.id} style={{ border: '1px solid #ece5d8', borderRadius: 8, padding: '10px 12px', background: '#fffdf9' }}>
              <div style={{ fontWeight: 600, color: '#5a4f42' }}>
                {h.name || 'Hotel'}
                {h.link && (
                  <a
                    href={h.link.startsWith('http') ? h.link : `https://${h.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#a8926a', marginLeft: 6, fontSize: 12, fontWeight: 600 }}
                  >
                    Book <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#8a8177', marginTop: 2 }}>
                {[h.distance, h.price, h.phone].filter(Boolean).join(' · ')}
              </div>
              {h.blockCode && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a8926a', marginTop: 4 }}>Block: {h.blockCode}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {showWeekend && (
        <div style={{ borderLeft: '2px solid #e4d7b8', paddingLeft: 14, marginTop: 4 }}>
          {weekend.map((w) => (
            <div key={w.id} style={{ marginBottom: 8 }}>
              <span className="font-display" style={{ fontSize: 16, color: '#7b6d5e' }}>
                {w.day}
              </span>{' '}
              · {w.event} <span style={{ fontSize: 12, color: '#8a8177' }}>— {fmtTime(w.time) || w.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
