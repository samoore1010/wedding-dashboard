import type { GuestList, GuestSide, GuestStatus, Household, WeddingSettings } from '../types';
import { householdSize, repliedCount, suggestLabel } from '../utils';

/**
 * PDF export for the guest list.
 *
 * Rather than pull in a PDF library, we render a print-optimised HTML document
 * that mirrors the dashboard — the same grouping, ordering and filtering the
 * user is looking at — and hand it to the browser's "Save as PDF". The couple
 * gets a paper-ready guest list that matches exactly what's on screen.
 */

/** A rendered group as the Guests tab computes it: an optional heading + rows. */
export interface PdfGroup {
  key: string | null;
  items: Household[];
}

/** Everything about the current view the PDF needs to reproduce it faithfully. */
export interface PdfExportContext {
  groups: PdfGroup[];
  groupBy: string;
  filters: { rsvp: string; side: string; list: string; search: string };
  stats: {
    households: number;
    guests: number;
    bList: number;
    family: number;
    friends: number;
  };
  settings: WeddingSettings;
}

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const glist = (h: Household): GuestList => h.list ?? 'Invited';

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Pull the live theme palette so the PDF matches whatever theme is active. */
const readPalette = () => {
  const css = getComputedStyle(document.documentElement);
  const c = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim();
    return v ? `rgb(${v})` : fallback;
  };
  return {
    bg: c('--c-bg', 'rgb(250 249 246)'),
    surface: c('--c-surface', 'rgb(255 255 255)'),
    ink: c('--c-ink', 'rgb(58 53 48)'),
    muted: c('--c-muted', 'rgb(122 117 110)'),
    border: c('--c-border', 'rgb(232 228 223)'),
    primary: c('--c-primary', 'rgb(123 109 94)'),
    accent: c('--c-accent', 'rgb(201 169 110)'),
    rose: c('--c-rose', 'rgb(212 160 160)'),
    sage: c('--c-sage', 'rgb(143 166 138)'),
    danger: c('--c-danger', 'rgb(192 57 43)'),
    warning: c('--c-warning', 'rgb(230 126 34)'),
    success: c('--c-success', 'rgb(39 174 96)'),
  };
};

const sideColor = (p: ReturnType<typeof readPalette>, side: GuestSide) =>
  side === 'Bride' ? p.rose : side === 'Groom' ? p.sage : p.primary;

const rsvpColor = (p: ReturnType<typeof readPalette>, rsvp: GuestStatus) =>
  rsvp === 'Yes' ? p.success : rsvp === 'No' ? p.danger : p.warning;

/** Human summary of the active filters, e.g. "RSVP: Yes · Side: Bride". */
const describeFilters = (f: PdfExportContext['filters']): string => {
  const parts: string[] = [];
  if (f.search.trim()) parts.push(`Search: “${f.search.trim()}”`);
  if (f.rsvp !== 'All') parts.push(`RSVP: ${f.rsvp}`);
  if (f.side !== 'All') parts.push(`Side: ${f.side}`);
  if (f.list !== 'All') parts.push(`List: ${f.list}`);
  return parts.join('  ·  ');
};

const memberChip = (
  p: ReturnType<typeof readPalette>,
  m: Household['members'][number]
): string => {
  const kid =
    m.kind === 'child'
      ? `<span class="kid">kid</span>`
      : '';
  const meal = m.meal ? `<span class="meal">· ${esc(m.meal)}</span>` : '';
  return `<span class="chip">
    <span class="dot" style="background:${rsvpColor(p, m.rsvp)}"></span>
    <span class="chip-name">${esc(m.name || 'Unnamed')}</span>${kid}${meal}
  </span>`;
};

const householdCard = (p: ReturnType<typeof readPalette>, h: Household): string => {
  const size = householdSize(h);
  const replied = repliedCount(h);
  const allReplied = replied === size;
  const label = h.label.trim() || suggestLabel(h.members) || 'Untitled household';
  const l = glist(h);
  const notInvited = l !== 'Invited';
  const side = sideColor(p, h.side);

  const listBadge = notInvited
    ? `<span class="badge" style="border-color:${p.border};color:${p.muted}">${esc(l)}</span>`
    : '';

  const right = notInvited
    ? `<div class="hh-status" style="color:${p.accent}">${esc(l)}</div>`
    : `<div class="hh-status" style="color:${allReplied ? p.success : p.warning}">${replied} of ${size} replied</div>`;

  const table = h.table
    ? `<div class="hh-table" style="border-color:${p.border};color:${p.muted}">${esc(h.table)}</div>`
    : '';

  return `<div class="card">
    <span class="rail" style="background:${side}"></span>
    <div class="card-main">
      <div class="card-head">
        <span class="hh-label">${esc(label)}</span>
        <span class="badge side" style="background:${side}">${esc(h.side)}</span>
        <span class="badge" style="border-color:${p.border};color:${p.muted}">${esc(h.group)}</span>
        ${listBadge}
      </div>
      <div class="chips">${h.members.map((m) => memberChip(p, m)).join('')}</div>
    </div>
    <div class="card-right">
      ${right}
      <div class="hh-seats">${size} ${size === 1 ? 'seat' : 'seats'}</div>
      ${table}
    </div>
  </div>`;
};

const groupBlock = (p: ReturnType<typeof readPalette>, g: PdfGroup): string => {
  const guests = g.items.reduce((s, h) => s + householdSize(h), 0);
  const heading =
    g.key !== null
      ? `<div class="group-head">
          <span class="group-key">${esc(g.key)}</span>
          <span class="group-count">${g.items.length} ${
          g.items.length === 1 ? 'household' : 'households'
        } · ${guests} guests</span>
          <span class="group-rule"></span>
        </div>`
      : '';
  return `<section class="group">
    ${heading}
    ${g.items.map((h) => householdCard(p, h)).join('')}
  </section>`;
};

const buildHtml = (ctx: PdfExportContext): string => {
  const p = readPalette();
  const { settings, stats, groupBy } = ctx;

  const couple = [settings.brideName, settings.groomName].filter(Boolean).join(' & ');
  const title = couple ? `${couple} — Guest List` : 'Guest List';
  const filterText = describeFilters(ctx.filters);
  const totalHouseholds = ctx.groups.reduce((s, g) => s + g.items.length, 0);

  const contextLine = [
    `Grouped by ${groupBy}`,
    filterText || 'All households',
    `${totalHouseholds} ${totalHouseholds === 1 ? 'household' : 'households'} shown`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const statChip = (label: string, value: number | string, color: string, sub = '') =>
    `<div class="stat">
      <div class="stat-val" style="color:${color}">${value}</div>
      <div class="stat-label">${esc(label)}</div>
      ${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ''}
    </div>`;

  const body = ctx.groups.length
    ? ctx.groups.map((g) => groupBlock(p, g)).join('')
    : `<div class="empty">No households match the current filters.</div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: ${p.ink};
    background: #fff;
    font-size: 12px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { padding: 28px 32px; }
  .doc-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 14px; margin-bottom: 16px;
    border-bottom: 2px solid ${p.border};
  }
  .doc-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 30px; font-weight: 600; line-height: 1.1; color: ${p.ink};
  }
  .doc-sub { font-size: 11px; color: ${p.muted}; margin-top: 4px; }
  .doc-meta { text-align: right; font-size: 10px; color: ${p.muted}; white-space: nowrap; }
  .context {
    font-size: 10.5px; color: ${p.muted}; margin-bottom: 14px; font-weight: 500;
  }
  .stats {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px;
  }
  .stat {
    border: 1px solid ${p.border}; border-radius: 10px; padding: 8px 10px; background: ${p.bg};
  }
  .stat-val { font-size: 18px; font-weight: 700; line-height: 1; }
  .stat-label {
    font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.08em;
    color: ${p.muted}; font-weight: 700; margin-top: 4px;
  }
  .stat-sub { font-size: 8px; color: ${p.muted}; margin-top: 2px; }
  .group { margin-bottom: 16px; break-inside: avoid; }
  .group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .group-key {
    font-size: 10px; font-weight: 700; padding: 2px 9px; border-radius: 999px;
    background: ${p.bg}; border: 1px solid ${p.border}; color: ${p.ink};
    text-transform: capitalize;
  }
  .group-count { font-size: 10px; color: ${p.muted}; }
  .group-rule { flex: 1; height: 1px; background: ${p.border}; }
  .card {
    display: flex; gap: 10px; border: 1px solid ${p.border}; border-radius: 12px;
    padding: 10px 12px; margin-bottom: 7px; background: ${p.surface};
    break-inside: avoid;
  }
  .rail { width: 3px; border-radius: 999px; flex-shrink: 0; }
  .card-main { flex: 1; min-width: 0; }
  .card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .hh-label {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 16px; font-weight: 600; color: ${p.ink}; line-height: 1.1;
  }
  .badge {
    font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 2px 7px; border-radius: 999px; border: 1px solid transparent;
  }
  .badge.side { color: #fff; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 5px;
    border: 1px solid ${p.border}; border-radius: 999px; padding: 2px 8px;
    font-size: 10px; background: ${p.bg};
  }
  .dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
  .chip-name { font-weight: 500; color: ${p.ink}; }
  .kid {
    font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: ${p.accent};
    background: ${p.bg}; border: 1px solid ${p.accent}; border-radius: 3px; padding: 0 3px;
  }
  .meal { color: ${p.muted}; }
  .card-right {
    text-align: right; flex-shrink: 0; display: flex; flex-direction: column;
    align-items: flex-end; justify-content: center; gap: 3px; min-width: 84px;
  }
  .hh-status { font-size: 10px; font-weight: 600; }
  .hh-seats { font-size: 9.5px; color: ${p.muted}; }
  .hh-table {
    font-size: 8.5px; border: 1px solid; border-radius: 4px; padding: 1px 5px;
  }
  .empty {
    text-align: center; color: ${p.muted}; padding: 40px; font-size: 13px;
  }
  @page { margin: 14mm; }
</style>
</head>
<body>
  <div class="page">
    <div class="doc-head">
      <div>
        <div class="doc-title">${esc(title)}</div>
        <div class="doc-sub">${couple ? 'Wedding guest list' : 'Guest list'}${
    settings.weddingDate ? ` · ${esc(formatWeddingDate(settings.weddingDate))}` : ''
  }</div>
      </div>
      <div class="doc-meta">Generated ${esc(stamp())}</div>
    </div>

    <div class="context">${esc(contextLine)}</div>

    <div class="stats">
      ${statChip('Households', stats.households, p.ink, 'invitations')}
      ${statChip('Guests', stats.guests, p.primary, 'people total')}
      ${statChip('Family', stats.family, p.sage, 'people')}
      ${statChip('Friends', stats.friends, p.rose, 'people')}
      ${statChip('B-list', stats.bList, p.warning, 'people')}
    </div>

    ${body}
  </div>
  <script>
    window.addEventListener('load', function () {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;
};

/** Format the ISO wedding date the same way the dashboard does, safely. */
const formatWeddingDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Open a print-ready window that mirrors the current guest-list view and
 * trigger the browser's print dialog (where the user picks "Save as PDF").
 */
export const exportGuestsPdf = (ctx: PdfExportContext): boolean => {
  const win = window.open('', '_blank');
  if (!win) return false; // popup blocked — caller surfaces a message
  win.document.open();
  win.document.write(buildHtml(ctx));
  win.document.close();
  return true;
};
