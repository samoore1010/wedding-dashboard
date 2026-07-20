import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  Paperclip,
  X,
  Minus,
  Undo2,
  Check,
  AlertTriangle,
  Search,
  Loader2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { runAgent, type Attachment, type ProposedChange } from '../assistant/agent';
import { getAssistantStatus } from '../assistant/api';
import { useStore } from '../store';
import { cn, uid } from '../utils';

type Msg =
  | { id: string; kind: 'user'; text: string; files: string[] }
  | { id: string; kind: 'assistant'; text: string; streaming: boolean }
  | { id: string; kind: 'note'; text: string }
  | { id: string; kind: 'approval'; changes: ProposedChange[]; status: 'pending' | 'approved' | 'declined' }
  | { id: string; kind: 'applied'; undoId: string; summaries: string[]; undone: boolean }
  | { id: string; kind: 'error'; text: string };

const SUGGESTIONS = [
  'Add the Johnson family (2 adults, 1 kid) on the bride’s side',
  'How many guests have RSVP’d yes?',
  'Add a venue from this link: ',
  'Set the photography budget to 15%',
];

const MAX_FILE = 8_000_000;

function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const data = res.slice(res.indexOf(',') + 1);
      resolve({
        kind: file.type === 'application/pdf' ? 'pdf' : 'image',
        media_type: file.type,
        data,
        name: file.name,
      });
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);

  const apiMessages = useRef<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resolveApproval = useRef<((v: boolean) => void) | null>(null);

  const undo = useStore((s) => s.undo);

  useEffect(() => {
    if (open && configured === null) getAssistantStatus().then((s) => setConfigured(s.configured));
  }, [open, configured]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const push = (m: Msg) => setMessages((prev) => [...prev, m]);
  const patch = (id: string, fn: (m: Msg) => Msg) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) {
        push({ id: uid(), kind: 'error', text: `${f.name} is too large (max 8 MB).` });
        continue;
      }
      if (!/^image\//.test(f.type) && f.type !== 'application/pdf') {
        push({ id: uid(), kind: 'error', text: `${f.name}: only images and PDFs are supported.` });
        continue;
      }
      try {
        next.push(await fileToAttachment(f));
      } catch {
        push({ id: uid(), kind: 'error', text: `Could not read ${f.name}.` });
      }
    }
    if (next.length) setPendingFiles((p) => [...p, ...next]);
  }

  async function send() {
    if (busy || configured === false) return;
    const text = input.trim();
    const files = pendingFiles;
    if (!text && files.length === 0) return;

    push({ id: uid(), kind: 'user', text, files: files.map((f) => f.name) });
    setInput('');
    setPendingFiles([]);
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let curId = '';

    try {
      await runAgent(
        apiMessages.current,
        text,
        files,
        {
          onTurnStart: () => {
            curId = uid();
            push({ id: curId, kind: 'assistant', text: '', streaming: true });
          },
          onDelta: (t) =>
            patch(curId, (m) => (m.kind === 'assistant' ? { ...m, text: m.text + t } : m)),
          onTurnEnd: () =>
            setMessages((prev) =>
              prev.filter((m) => !(m.id === curId && m.kind === 'assistant' && m.text.trim() === '')).map((m) =>
                m.id === curId && m.kind === 'assistant' ? { ...m, streaming: false } : m
              )
            ),
          onToolNote: (t) => push({ id: uid(), kind: 'note', text: t }),
          requestApproval: (changes) => {
            const id = uid();
            push({ id, kind: 'approval', changes, status: 'pending' });
            setAwaitingApproval(true);
            return new Promise<boolean>((resolve) => {
              resolveApproval.current = (v: boolean) => {
                patch(id, (m) =>
                  m.kind === 'approval' ? { ...m, status: v ? 'approved' : 'declined' } : m
                );
                setAwaitingApproval(false);
                resolveApproval.current = null;
                resolve(v);
              };
            });
          },
          onApplied: (undoId, summaries) => push({ id: uid(), kind: 'applied', undoId, summaries, undone: false }),
          onError: (msg) => push({ id: uid(), kind: 'error', text: msg }),
        },
        ctrl.signal
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    resolveApproval.current?.(false);
  }

  function onUndo(undoId: string, msgId: string) {
    undo(undoId);
    patch(msgId, (m) => (m.kind === 'applied' ? { ...m, undone: true } : m));
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[min(400px,calc(100vw-2rem))] h-[min(600px,calc(100vh-6rem))] bg-surface border border-border rounded-2xl shadow-lift flex flex-col overflow-hidden animate-in fade-in">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-accent-soft/40 to-surface">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
              <Sparkles size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg text-primary leading-none">Wedding Assistant</div>
              <div className="text-[11px] text-muted">Plan and edit by chatting</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted hover:text-ink p-1 rounded"
              aria-label="Minimize"
            >
              <Minus size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {configured === false && (
              <div className="flex gap-2 items-start text-xs bg-warning/10 border border-warning/30 rounded-lg p-3 text-ink">
                <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                <span>
                  The assistant isn’t connected yet. Set <code className="font-mono">ANTHROPIC_API_KEY</code>{' '}
                  on the server, then reopen this panel.
                </span>
              </div>
            )}

            {messages.length === 0 && configured !== false && (
              <div className="text-center py-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent mb-2">
                  <Sparkles size={20} />
                </div>
                <p className="text-sm text-ink font-medium">How can I help plan the wedding?</p>
                <p className="text-xs text-muted mt-1 mb-3">
                  I can add and edit guests, budget, vendors, seating and more — you approve every change.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-bg hover:border-accent hover:bg-accent/5 transition-colors text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageRow key={m.id} m={m} onApprove={resolveApproval} onUndo={onUndo} awaiting={awaitingApproval} />
            ))}

            {busy && !awaitingApproval && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" /> Thinking…
              </div>
            )}
          </div>

          {/* Pending attachments */}
          {pendingFiles.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] bg-bg border border-border rounded-full pl-2 pr-1 py-0.5"
                >
                  {f.kind === 'pdf' ? <FileText size={11} /> : <ImageIcon size={11} />}
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button
                    onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                    className="text-muted hover:text-danger p-0.5"
                    aria-label="Remove attachment"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2">
              <label className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-muted hover:text-ink hover:border-primary cursor-pointer transition-colors">
                <Paperclip size={16} />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder={configured === false ? 'Assistant not connected' : 'Ask me anything…'}
                disabled={configured === false}
                className="flex-1 resize-none max-h-28 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
              />
              {busy ? (
                <button
                  onClick={stop}
                  className="shrink-0 h-9 px-3 inline-flex items-center gap-1 rounded-lg bg-bg border border-border text-ink text-xs font-semibold hover:border-danger hover:text-danger transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={configured === false || (!input.trim() && pendingFiles.length === 0)}
                  className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-lg bg-accent text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'h-14 w-14 rounded-full shadow-lift inline-flex items-center justify-center transition-transform hover:scale-105',
          open ? 'bg-primary text-white' : 'bg-accent text-white'
        )}
        aria-label={open ? 'Close assistant' : 'Open wedding assistant'}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>
    </div>
  );
}

function MessageRow({
  m,
  onApprove,
  onUndo,
  awaiting,
}: {
  m: Msg;
  onApprove: React.MutableRefObject<((v: boolean) => void) | null>;
  onUndo: (undoId: string, msgId: string) => void;
  awaiting: boolean;
}) {
  if (m.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap">
          {m.text}
          {m.files.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {m.files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-white/20 rounded-full px-2 py-0.5">
                  <Paperclip size={9} /> {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (m.kind === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] bg-bg border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-ink whitespace-pre-wrap">
          {m.text}
          {m.streaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-accent/60 align-middle animate-pulse" />}
        </div>
      </div>
    );
  }

  if (m.kind === 'note') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted pl-1">
        <Search size={11} /> {m.text}
      </div>
    );
  }

  if (m.kind === 'error') {
    return (
      <div className="flex gap-2 items-start text-xs bg-danger/10 border border-danger/25 rounded-lg p-2.5 text-ink">
        <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" /> {m.text}
      </div>
    );
  }

  if (m.kind === 'applied') {
    return (
      <div className="flex items-center gap-2 text-xs bg-success/10 border border-success/25 rounded-lg px-3 py-2">
        <Check size={14} className="text-success shrink-0" />
        <span className="flex-1 text-ink">
          {m.undone ? 'Change undone.' : `Applied ${m.summaries.length} ${m.summaries.length === 1 ? 'change' : 'changes'}.`}
        </span>
        {!m.undone && (
          <button
            onClick={() => onUndo(m.undoId, m.id)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-accent"
          >
            <Undo2 size={12} /> Undo
          </button>
        )}
      </div>
    );
  }

  // approval
  const pending = m.status === 'pending';
  return (
    <div
      className={cn(
        'border rounded-xl p-3 text-xs',
        pending ? 'border-accent/50 bg-accent/5' : 'border-border bg-bg'
      )}
    >
      <div className="font-semibold text-ink mb-2">
        {pending ? 'Approve these changes?' : m.status === 'approved' ? 'Approved' : 'Declined'}
      </div>
      <ul className="space-y-1 mb-2">
        {m.changes.map((c) => (
          <li key={c.toolUseId} className="flex gap-1.5 text-ink">
            <span className="text-accent mt-0.5">•</span>
            <span>{c.summary}</span>
          </li>
        ))}
      </ul>
      {pending && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove.current?.(true)}
            disabled={!awaiting}
            className="flex-1 h-8 rounded-lg bg-accent text-white text-xs font-semibold hover:brightness-95 disabled:opacity-50"
          >
            Approve &amp; apply
          </button>
          <button
            onClick={() => onApprove.current?.(false)}
            disabled={!awaiting}
            className="flex-1 h-8 rounded-lg border border-border text-ink text-xs font-semibold hover:border-danger hover:text-danger disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
