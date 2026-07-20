import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Link2,
  Download,
  Check,
  AlertTriangle,
  X,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Users,
  CircleDot,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useShallowStore } from '../../store';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { cn } from '../../utils';
import { downloadGuestTemplate } from '../../guests/csv';
import { parseFile, parseGoogleSheet, type Sheet } from '../../guests/importParse';
import {
  autoMapColumns,
  stageImport,
  type ColumnMap,
  type StagedHousehold,
} from '../../guests/importCategorize';
import { aiStageImport, aiConfigured } from '../../guests/aiCategorize';
import { GUEST_FIELDS, GROUPS, LISTS, SIDES } from '../../guests/schema';
import type { GuestGroup, GuestList, GuestSide } from '../../types';

type Step = 'upload' | 'map' | 'review';
type Row = StagedHousehold & { include: boolean };

export function ImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { households, importHouseholds } = useShallowStore((s) => ({
    households: s.households,
    importHouseholds: s.importHouseholds,
  }));

  const [step, setStep] = useState<Step>('upload');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<ColumnMap>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setSheet(null);
    setMap({});
    setRows([]);
    setBusy(null);
    setError(null);
    setAiUsed(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  // ---- step transitions ----
  const onSheetLoaded = (s: Sheet) => {
    if (!s.headers.length || !s.rows.length) {
      setError('That file looks empty — we couldn’t find a header row and any guests.');
      return;
    }
    setError(null);
    setSheet(s);
    setMap(autoMapColumns(s.headers));
    setStep('map');
  };

  const runCategorize = async () => {
    if (!sheet) return;
    if (map.name == null && map.household == null) {
      setError('Please map at least a Name (or Household) column so we know who’s who.');
      return;
    }
    setError(null);
    setBusy('Reading & organizing your guests…');
    let staged: StagedHousehold[] | null = null;
    let usedAi = false;
    try {
      if (await aiConfigured()) {
        staged = await aiStageImport(sheet, map, households);
        usedAi = !!staged;
      }
    } catch {
      /* fall through to heuristics */
    }
    if (!staged) staged = stageImport(sheet, map, households);
    setAiUsed(usedAi);
    setRows(staged.map((s) => ({ ...s, include: s.status !== 'duplicate' })));
    setBusy(null);
    setStep('review');
  };

  const publish = () => {
    const chosen = rows.filter((r) => r.include);
    if (!chosen.length) {
      setError('Nothing selected to import.');
      return;
    }
    importHouseholds(
      chosen.map((r) => ({
        label: r.label,
        side: r.side,
        group: r.group,
        list: r.list,
        email: r.email,
        address: r.address,
        inviteSent: r.inviteSent,
        notes: r.notes,
        table: r.table,
        members: r.members.map((m) => ({
          name: m.name,
          kind: m.kind,
          rsvp: m.rsvp,
          meal: m.meal,
          dietary: m.dietary,
        })),
      }))
    );
    const people = chosen.reduce((n, r) => n + r.members.length, 0);
    toast.success(`Imported ${chosen.length} ${chosen.length === 1 ? 'household' : 'households'} · ${people} guests. Undo from the top bar if needed.`);
    close();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl2 bg-accent/12 text-accent">
            <Upload size={18} />
          </span>
          <div>
            <h2 className="font-display text-xl text-primary leading-tight">Import guests</h2>
            <Steps step={step} />
          </div>
        </div>
        <button onClick={close} className="text-muted hover:text-ink p-2 rounded-lg transition-colors" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="mx-5 md:mx-8 mt-4 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/8 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 md:px-8 py-6">
        <div className="mx-auto max-w-4xl">
          {step === 'upload' && <UploadStep onSheet={onSheetLoaded} setBusy={setBusy} setError={setError} busy={busy} />}
          {step === 'map' && sheet && (
            <MapStep sheet={sheet} map={map} onChange={setMap} busy={busy} />
          )}
          {step === 'review' && (
            <ReviewStep rows={rows} setRows={setRows} aiUsed={aiUsed} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 md:px-8 py-3.5 border-t border-border bg-surface shrink-0">
        <div className="text-xs text-muted">
          {step === 'review' && (
            <span>
              {rows.filter((r) => r.include).length} of {rows.length} selected ·{' '}
              {rows.filter((r) => r.include).reduce((n, r) => n + r.members.length, 0)} guests
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step === 'map' && (
            <>
              <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button icon={busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} onClick={runCategorize} disabled={!!busy}>
                {busy ? 'Organizing…' : 'Continue'}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setStep('map')}>
                Back
              </Button>
              <Button icon={<Check size={15} />} onClick={publish} disabled={!rows.some((r) => r.include)}>
                Import {rows.filter((r) => r.include).length || ''} households
              </Button>
            </>
          )}
          {step === 'upload' && (
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Steps bar -------------------------------- */

function Steps({ step }: { step: Step }) {
  const order: Step[] = ['upload', 'map', 'review'];
  const labels: Record<Step, string> = { upload: 'Upload', map: 'Check columns', review: 'Review & confirm' };
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
      {order.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn('font-semibold', i <= idx ? 'text-accent' : 'text-muted')}>
            {i + 1}. {labels[s]}
          </span>
          {i < order.length - 1 && <span className="text-border">→</span>}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------- Upload step ------------------------------- */

function UploadStep({
  onSheet,
  setBusy,
  setError,
  busy,
}: {
  onSheet: (s: Sheet) => void;
  setBusy: (s: string | null) => void;
  setError: (s: string | null) => void;
  busy: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [link, setLink] = useState('');

  const handleFile = async (file: File) => {
    setError(null);
    setBusy('Reading your file…');
    try {
      onSheet(await parseFile(file));
    } catch (e: any) {
      setError(e?.message || 'Could not read that file.');
    } finally {
      setBusy(null);
    }
  };

  const handleLink = async () => {
    if (!link.trim()) return;
    setError(null);
    setBusy('Opening your Google Sheet…');
    try {
      onSheet(await parseGoogleSheet(link.trim()));
    } catch (e: any) {
      setError(e?.message || 'Could not open that sheet.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Upload your guest spreadsheet — however it’s organized. We’ll read it, sort people into households, and guess
        each person’s side and category. You’ll get to check everything before anything is added.
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-xl2 border-2 border-dashed px-6 py-12 text-center transition-colors',
          drag ? 'border-accent bg-accent/8' : 'border-border hover:border-accent/60 hover:bg-bg'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <span className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-accent/12 text-accent mb-3">
          {busy ? <Loader2 size={24} className="animate-spin" /> : <FileSpreadsheet size={24} />}
        </span>
        <div className="font-display text-lg text-ink">{busy || 'Drag your spreadsheet here'}</div>
        <div className="text-sm text-muted mt-1">
          or <span className="text-accent font-semibold">browse your files</span> · Excel (.xlsx) or CSV
        </div>
      </div>

      {/* Google Sheets */}
      <div className="rounded-xl2 border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1.5">
          <Link2 size={15} className="text-accent" /> …or paste a Google Sheets link
        </div>
        <p className="text-xs text-muted mb-3">
          In Google Sheets, choose <b>Share → Anyone with the link → Viewer</b>, then paste the link here.
        </p>
        <div className="flex gap-2">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            onKeyDown={(e) => e.key === 'Enter' && handleLink()}
          />
          <Button variant="outline" onClick={handleLink} disabled={!link.trim() || !!busy}>
            Open
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={downloadGuestTemplate}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition-colors"
        >
          <Download size={13} /> Don’t have one yet? Download a blank template
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Map step -------------------------------- */

function MapStep({
  sheet,
  map,
  onChange,
  busy,
}: {
  sheet: Sheet;
  map: ColumnMap;
  onChange: (m: ColumnMap) => void;
  busy: string | null;
}) {
  const NONE = '__none__';
  const preview = sheet.rows.slice(0, 4);
  const mappedCount = Object.keys(map).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg text-ink">Check the columns</h3>
        <p className="text-sm text-muted mt-1">
          We matched your spreadsheet’s columns to our fields. Fix any that look off — everything else you can leave.{' '}
          <span className="text-ink font-medium">{mappedCount} matched automatically.</span>
        </p>
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-accent">
          <Loader2 size={16} className="animate-spin" /> {busy}
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {GUEST_FIELDS.map((f) => {
          const col = map[f.key];
          return (
            <div key={f.key} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <div className="w-28 shrink-0">
                <div className="text-sm font-semibold text-ink">{f.header}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted">{f.level}</div>
              </div>
              <span className="text-muted">←</span>
              <Select
                className="flex-1 h-8 py-0 text-xs"
                value={col == null ? NONE : String(col)}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = { ...map };
                  if (v === NONE) delete next[f.key];
                  else next[f.key] = Number(v);
                  onChange(next);
                }}
              >
                <option value={NONE}>— not in my sheet —</option>
                {sheet.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>

      {/* Preview */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Preview · first {preview.length} rows</div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg text-left">
                {sheet.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold text-ink whitespace-nowrap border-b border-border">
                    {h || `Column ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, ri) => (
                <tr key={ri} className="border-b border-border/60 last:border-0">
                  {sheet.headers.map((_, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-muted whitespace-nowrap">
                      {row[ci] || <span className="text-border">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Review step ------------------------------- */

function ReviewStep({
  rows,
  setRows,
  aiUsed,
}: {
  rows: Row[];
  setRows: React.Dispatch<React.SetStateAction<Row[]>>;
  aiUsed: boolean;
}) {
  const stats = useMemo(() => {
    const chosen = rows.filter((r) => r.include);
    return {
      households: chosen.length,
      guests: chosen.reduce((n, r) => n + r.members.length, 0),
      duplicates: rows.filter((r) => r.matchId).length,
      needsReview: rows.filter((r) => r.include && r.flags.some((f) => f.includes('review'))).length,
    };
  }, [rows]);

  const patch = (tmpId: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.tmpId === tmpId ? { ...r, ...p } : r)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-accent/10 text-accent">
          {aiUsed ? <Sparkles size={13} /> : <CircleDot size={13} />}
          {aiUsed ? 'Organized with AI' : 'Organized automatically'}
        </span>
        <span className="text-sm text-muted">
          Review below, then import. Nothing is added until you confirm — and you can undo it in one click.
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Households" value={stats.households} icon={<Users size={14} />} />
        <MiniStat label="Guests" value={stats.guests} />
        <MiniStat label="Possible duplicates" value={stats.duplicates} tone={stats.duplicates ? 'warning' : undefined} />
        <MiniStat label="Need a look" value={stats.needsReview} tone={stats.needsReview ? 'warning' : undefined} />
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <ReviewRow key={r.tmpId} row={r} onPatch={(p) => patch(r.tmpId, p)} />
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone?: 'warning' }) {
  return (
    <div className={cn('rounded-xl2 border p-3', tone === 'warning' ? 'border-warning/40 bg-warning/8' : 'border-border bg-surface')}>
      <div className={cn('text-2xl font-display tabular-nums', tone === 'warning' ? 'text-warning' : 'text-ink')}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">
        {icon} {label}
      </div>
    </div>
  );
}

function ReviewRow({ row: r, onPatch }: { row: Row; onPatch: (p: Partial<Row>) => void }) {
  const [openEdit, setOpenEdit] = useState(false);
  const flagged = r.flags.some((f) => f.includes('review'));
  return (
    <div
      className={cn(
        'rounded-xl2 border bg-surface p-3.5 transition-colors',
        !r.include ? 'opacity-55 border-border' : flagged ? 'border-warning/45' : r.matchId ? 'border-warning/45' : 'border-border'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onPatch({ include: !r.include })}
          className={cn(
            'mt-0.5 grid place-items-center w-5 h-5 rounded border shrink-0 transition-colors',
            r.include ? 'bg-accent border-accent text-white' : 'border-border text-transparent hover:border-accent'
          )}
          aria-label={r.include ? 'Exclude' : 'Include'}
        >
          <Check size={13} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base text-ink leading-tight">{r.label || 'Untitled household'}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-bg border border-border text-muted">
              {r.side}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bg border border-border text-muted">{r.group}</span>
            {r.list !== 'Invited' && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">{r.list}</span>
            )}
            {r.flags.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/12 text-warning">
                <AlertTriangle size={10} /> {f}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted mt-1">
            {r.members.map((m) => m.name).join(', ')}
            {r.email && <span> · {r.email}</span>}
          </div>
        </div>

        <button onClick={() => setOpenEdit((v) => !v)} className="text-xs font-semibold text-accent hover:text-primary shrink-0">
          {openEdit ? 'Done' : 'Edit'}
        </button>
      </div>

      {openEdit && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Household name</span>
            <Input className="h-8 py-0 text-xs" value={r.label} onChange={(e) => onPatch({ label: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Side</span>
            <Select className="h-8 py-0 text-xs" value={r.side} onChange={(e) => onPatch({ side: e.target.value as GuestSide })}>
              {SIDES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Relationship</span>
            <Select className="h-8 py-0 text-xs" value={r.group} onChange={(e) => onPatch({ group: e.target.value as GuestGroup })}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">List</span>
            <Select className="h-8 py-0 text-xs" value={r.list} onChange={(e) => onPatch({ list: e.target.value as GuestList })}>
              {LISTS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </label>
        </div>
      )}
    </div>
  );
}
