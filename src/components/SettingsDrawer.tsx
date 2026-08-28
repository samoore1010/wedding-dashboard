import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, Upload, RotateCcw, Check } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui/Button';
import { Input, LabeledField } from './ui/Field';
import { confirmAction } from './ui/ConfirmDialog';
import { EditControls } from './ui/EditControls';
import { useEditSession } from './ui/useEditSession';
import { ViewerPicker } from './reviews/ViewerPicker';
import { downloadJson, cn } from '../utils';
import { DEFAULT_STATE } from '../defaults';
import type { ThemeId } from '../types';
import toast from 'react-hot-toast';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const THEMES: { id: ThemeId; label: string; swatch: string[] }[] = [
  { id: 'sage', label: 'Sage Garden', swatch: ['#7B6D5E', '#C9A96E', '#8FA68A'] },
  { id: 'rose', label: 'Rose Gold', swatch: ['#A8606E', '#C68664', '#D4A0A0'] },
  { id: 'coastal', label: 'Coastal Blue', swatch: ['#507991', '#C49C66', '#8AADA9'] },
  { id: 'burgundy', label: 'Burgundy', swatch: ['#7B2438', '#BC9856', '#C47A8A'] },
  { id: 'modern', label: 'Modern Black', swatch: ['#202024', '#B89A64', '#C49090'] },
];

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const importState = useStore((s) => s.importState);
  const resetState = useStore((s) => s.resetState);
  const fullState = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  // Names, date and venue are drafted and saved together; picking a theme
  // stays instant since it's a live preview, not data you can mistype.
  const session = useEditSession(settings, (next) => {
    updateSettings(next);
    flash();
  });
  const draft = session.shown;
  const { editing } = session;

  const requestClose = useCallback(async () => {
    if (
      session.dirty &&
      !(await confirmAction({
        title: 'Discard changes?',
        message: "You haven't saved your wedding details. Discard them?",
        confirmLabel: 'Discard',
        variant: 'danger',
      }))
    ) {
      return;
    }
    session.cancel();
    onClose();
  }, [session, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  const onExport = () => {
    const snapshot = useStore.getState();
    const { ...rest } = snapshot as any;
    // strip actions
    const data = JSON.parse(
      JSON.stringify(
        Object.fromEntries(Object.entries(rest).filter(([_, v]) => typeof v !== 'function'))
      )
    );
    downloadJson(data, `wedding-dashboard-${settings.weddingDate || 'backup'}.json`);
    toast.success('Backup downloaded');
  };

  const onImportClick = () => fileRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = await confirmAction({
      title: 'Replace all data?',
      message: 'Importing will overwrite your current dashboard. This cannot be undone.',
      confirmLabel: 'Replace',
      variant: 'danger',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      importState(parsed);
      toast.success('Backup restored');
    } catch {
      toast.error('Could not read that file');
    }
    e.target.value = '';
  };

  const onReset = async () => {
    const ok = await confirmAction({
      title: 'Reset to defaults?',
      message: 'This will erase all your data and restore the starter template. This cannot be undone.',
      confirmLabel: 'Reset everything',
      variant: 'danger',
    });
    if (!ok) return;
    resetState();
    toast.success('Reset complete');
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={requestClose}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md bg-surface border-l border-border shadow-lift transition-transform overflow-y-auto',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-primary">Customize</h2>
            <p className="text-xs text-muted">Make this dashboard yours</p>
          </div>
          <button
            onClick={requestClose}
            className="text-muted hover:text-ink p-1 rounded transition-colors"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-7">
          {/* Couple + wedding details are drafted together and saved in one go. */}
          <div className="flex items-center justify-between gap-2 -mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {editing ? 'Editing details' : 'Wedding details'}
            </span>
            <EditControls session={session} size="sm" what="these details" />
          </div>

          <Section title="The Couple">
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Partner 1">
                <Input
                  value={draft.brideName}
                  disabled={!editing}
                  onChange={(e) => session.set({ brideName: e.target.value })}
                  placeholder="Drew"
                />
              </LabeledField>
              <LabeledField label="Partner 2">
                <Input
                  value={draft.groomName}
                  disabled={!editing}
                  onChange={(e) => session.set({ groomName: e.target.value })}
                  placeholder="Steven"
                />
              </LabeledField>
            </div>
          </Section>

          {/* Date / venue */}
          <Section title="Wedding Details">
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Date">
                <Input
                  type="date"
                  value={draft.weddingDate}
                  disabled={!editing}
                  onChange={(e) => session.set({ weddingDate: e.target.value })}
                />
              </LabeledField>
              <LabeledField label="Ceremony Time">
                <Input
                  type="time"
                  value={draft.weddingTime}
                  disabled={!editing}
                  onChange={(e) => session.set({ weddingTime: e.target.value })}
                />
              </LabeledField>
            </div>
            <LabeledField label="Venue Name (optional)">
              <Input
                value={draft.venueName}
                disabled={!editing}
                onChange={(e) => session.set({ venueName: e.target.value })}
                placeholder="The Estate at Rosewood"
              />
            </LabeledField>
            <LabeledField label="Currency Symbol">
              <Input
                value={draft.currency}
                disabled={!editing}
                onChange={(e) => session.set({ currency: e.target.value })}
                maxLength={3}
                className="w-24"
              />
            </LabeledField>
          </Section>

          <Section
            title="This Device"
            hint="You both share one dashboard — this is just so review call-outs know who's looking."
          >
            <ViewerPicker label="Signed in as" />
          </Section>

          {/* Theme */}
          <Section title="Theme" hint="Pick a palette — it applies everywhere instantly.">
            <div className="grid grid-cols-1 gap-2">
              {THEMES.map((t) => {
                const active = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      updateSettings({ theme: t.id });
                      flash();
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 p-3 rounded-lg border-2 transition-all text-left',
                      active
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-primary-soft'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {t.swatch.map((c, i) => (
                          <span
                            key={i}
                            className="h-6 w-6 rounded-full border border-black/5"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">{t.label}</span>
                    </div>
                    {active && <Check size={16} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Data */}
          <Section title="Your Data" hint="Save a backup or move it to another device.">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={onExport}>
                Export JSON
              </Button>
              <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={onImportClick}>
                Import
              </Button>
              <Button variant="danger" size="sm" icon={<RotateCcw size={14} />} onClick={onReset}>
                Reset
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={onImportFile}
              />
            </div>
            <p className="text-xs text-muted mt-2">
              Stored locally in your browser.{' '}
              {fullState.households.reduce((n, h) => n + h.members.length, 0)} guests •{' '}
              {Object.keys(fullState.checklist).length} checked items.
            </p>
          </Section>
        </div>

        <div
          className={cn(
            'pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 transition-all',
            savedFlash ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          <span className="bg-sage text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lift">
            Saved ✓
          </span>
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary tracking-wide uppercase">
          {title}
        </h3>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

const _DEFAULT_REF = DEFAULT_STATE; // type-safe import preserved
void _DEFAULT_REF;
