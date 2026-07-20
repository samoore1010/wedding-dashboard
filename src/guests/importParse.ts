import { parseCsv } from './csv';

/** A parsed spreadsheet: a header row plus data rows, all as strings. */
export interface Sheet {
  headers: string[];
  rows: string[][];
  /** Where the data came from, for the review summary. */
  source: string;
}

/** Turn a raw matrix (first non-empty row = header) into a {@link Sheet}. */
const matrixToSheet = (matrix: string[][], source: string): Sheet => {
  // Skip any fully-blank leading rows (common when sheets have a title banner).
  const firstIdx = matrix.findIndex((r) => r.some((c) => (c ?? '').trim() !== ''));
  if (firstIdx < 0) return { headers: [], rows: [], source };
  const headers = (matrix[firstIdx] ?? []).map((h) => (h ?? '').trim());
  const width = headers.length;
  const rows = matrix
    .slice(firstIdx + 1)
    .map((r) => {
      const padded = [...r];
      while (padded.length < width) padded.push('');
      return padded.slice(0, width).map((c) => (c ?? '').toString().trim());
    })
    .filter((r) => r.some((c) => c !== ''));
  return { headers, rows, source };
};

/** Parse a dropped/selected .csv, .xlsx or .xls file. */
export const parseFile = async (file: File): Promise<Sheet> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = await file.text();
    return matrixToSheet(parseCsv(text), file.name);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || file.type.includes('sheet') || file.type.includes('excel')) {
    // Lazy-load SheetJS so the (sizable) parser stays out of the initial bundle.
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames[0];
    if (!first) throw new Error('That workbook has no sheets.');
    const ws = wb.Sheets[first];
    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
    return matrixToSheet(matrix, file.name);
  }
  throw new Error('Unsupported file. Please upload a .csv, .xlsx or .xls file.');
};

/** Extract the spreadsheet id + gid from a Google Sheets URL, if valid. */
export const parseGoogleSheetUrl = (url: string): { id: string; gid: string } | null => {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const gid = url.match(/[#&?]gid=([0-9]+)/)?.[1] ?? '0';
  return { id: m[1], gid };
};

/**
 * Fetch a Google Sheet as CSV via the server proxy. Direct browser fetches to
 * docs.google.com are blocked by CORS, so the server does the fetch and streams
 * the CSV back. The sheet must be shared as "anyone with the link can view".
 */
export const parseGoogleSheet = async (url: string): Promise<Sheet> => {
  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) throw new Error("That doesn't look like a Google Sheets link.");
  const res = await fetch(`/api/import/gsheet?id=${encodeURIComponent(parsed.id)}&gid=${encodeURIComponent(parsed.gid)}`);
  if (!res.ok) {
    const msg =
      res.status === 403 || res.status === 401
        ? 'That sheet is private. In Google Sheets, choose Share → "Anyone with the link" → Viewer, then paste the link again.'
        : `Could not open that sheet (${res.status}).`;
    throw new Error(msg);
  }
  const text = await res.text();
  return matrixToSheet(parseCsv(text), 'Google Sheet');
};
