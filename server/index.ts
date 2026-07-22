import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { streamSSE } from 'hono/streaming';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || '/data';
const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.resolve('dist');
const FILE = path.join(DATA_DIR, 'wedding.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const MAX_BODY = 5_000_000; // 5 MB for the JSON state
const MAX_IMAGE = 10_000_000; // 10 MB per image
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(IMAGES_DIR, { recursive: true });

const app = new Hono();

app.get('/api/wedding', async (c) => {
  try {
    const text = await fs.readFile(FILE, 'utf-8');
    return c.body(text, 200, { 'Content-Type': 'application/json' });
  } catch (e: any) {
    if (e.code === 'ENOENT') return c.body(null, 204);
    console.error('read failed', e);
    return c.text('read failed', 500);
  }
});

app.put('/api/wedding', async (c) => {
  const text = await c.req.text();
  if (text.length > MAX_BODY) return c.text('payload too large', 413);
  try {
    JSON.parse(text); // sanity check
  } catch {
    return c.text('not valid json', 400);
  }
  const tmp = FILE + '.tmp';
  await fs.writeFile(tmp, text);
  await fs.rename(tmp, FILE);
  return c.text('ok');
});

// Mood board image upload/serve/delete
const IMG_ID_RE = /^[a-z0-9]+\.(jpg|png|gif|webp)$/i;
const newImgId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

app.post('/api/images', async (c) => {
  const fd = await c.req.formData();
  const file = fd.get('file');
  if (!(file instanceof File)) return c.text('no file', 400);
  const ext = ALLOWED_EXT[file.type];
  if (!ext) return c.text('unsupported image type', 415);
  if (file.size > MAX_IMAGE) return c.text('image too large (max 10MB)', 413);
  const filename = `${newImgId()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await fs.writeFile(path.join(IMAGES_DIR, filename), bytes);
  return c.json({ id: filename, url: `/api/images/${filename}` });
});

app.get('/api/images/:id', async (c) => {
  const id = c.req.param('id');
  if (!IMG_ID_RE.test(id)) return c.text('bad id', 400);
  try {
    const buf = await fs.readFile(path.join(IMAGES_DIR, id));
    const ext = id.split('.').pop()!.toLowerCase();
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return c.body(new Uint8Array(buf), 200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  } catch (e: any) {
    if (e.code === 'ENOENT') return c.text('not found', 404);
    console.error('image read failed', e);
    return c.text('read failed', 500);
  }
});

app.delete('/api/images/:id', async (c) => {
  const id = c.req.param('id');
  if (!IMG_ID_RE.test(id)) return c.text('bad id', 400);
  try {
    await fs.unlink(path.join(IMAGES_DIR, id));
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.error('image delete failed', e);
      return c.text('delete failed', 500);
    }
  }
  return c.text('ok');
});

// --- AI wedding-planning assistant proxy ---------------------------------
// The browser runs the tool-use loop (its tools mutate the local store); this
// endpoint only injects the API key and streams Anthropic's response back, so
// the key never reaches the client. One request per assistant turn.
const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-4-8';

app.get('/api/assistant/status', (c) =>
  c.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), model: ASSISTANT_MODEL })
);

app.post('/api/assistant', async (c) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: 'The assistant is not configured. Set ANTHROPIC_API_KEY on the server.' },
      503
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.text('invalid json', 400);
  }

  const client = new Anthropic({ apiKey });

  return streamSSE(c, async (stream) => {
    const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) });
    try {
      const s = client.messages.stream({
        model: body.model || ASSISTANT_MODEL,
        max_tokens: body.max_tokens ?? 16000,
        system: body.system,
        messages: body.messages,
        tools: body.tools,
        tool_choice: body.tool_choice,
        thinking: body.thinking,
        output_config: body.output_config,
        // Web search/fetch run in a server-side code-execution container;
        // its id must be echoed back on later turns of the same conversation.
        ...(body.container ? { container: body.container } : {}),
      } as any);

      s.on('text', (t: string) => send({ type: 'delta', text: t }));

      const final = await s.finalMessage();
      await send({ type: 'final', message: final });
    } catch (e: any) {
      const status = e?.status;
      const message =
        status === 401
          ? 'Invalid API key. Check ANTHROPIC_API_KEY on the server.'
          : status === 429
          ? 'Rate limited by the Claude API. Try again in a moment.'
          : e?.message || 'The assistant request failed.';
      await send({ type: 'error', error: message });
    }
  });
});

// --- Guest import: Google Sheets CSV proxy -------------------------------
// The browser can't fetch docs.google.com directly (CORS), so we fetch the
// published CSV server-side. The sheet must be link-shared as viewable.
const SHEET_ID_RE = /^[a-zA-Z0-9-_]+$/;

app.get('/api/import/gsheet', async (c) => {
  const id = c.req.query('id') ?? '';
  const gid = c.req.query('gid') ?? '0';
  if (!SHEET_ID_RE.test(id) || !/^[0-9]+$/.test(gid)) {
    return c.text('bad sheet id', 400);
  }
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    // Google returns 200 with an HTML sign-in page for private sheets.
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) return c.text('fetch failed', res.status === 401 || res.status === 403 ? 403 : 502);
    if (ct.includes('text/html')) return c.text('sheet is private', 403);
    const text = await res.text();
    return c.body(text, 200, { 'Content-Type': 'text/csv; charset=utf-8' });
  } catch (e) {
    console.error('gsheet fetch failed', e);
    return c.text('fetch failed', 502);
  }
});

// --- Guest import: AI categorization -------------------------------------
// Given the raw rows of an uploaded guest sheet, ask Claude to normalise and
// categorise each person (side, relationship, list, adult/child, RSVP) and to
// propose which people share a household. Returns strict JSON; the browser
// groups + dedupes from there. Falls back to heuristics client-side if this is
// unavailable.
const IMPORT_MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-4-8';

app.post('/api/import/categorize', async (c) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return c.json({ error: 'not configured' }, 503);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.text('invalid json', 400);
  }
  const records: Record<string, string>[] = Array.isArray(body?.records) ? body.records.slice(0, 400) : [];
  if (!records.length) return c.json({ guests: [] });

  const client = new Anthropic({ apiKey });
  const tool = {
    name: 'categorize_guests',
    description: 'Return the normalised, categorised guest list.',
    input_schema: {
      type: 'object',
      properties: {
        guests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'integer', description: 'The 0-based index of the source record.' },
              name: { type: 'string', description: 'The cleaned full name of one person.' },
              household: {
                type: 'string',
                description:
                  'A label shared by everyone on the same invitation (e.g. "The Smith Family"). People with the same household value are grouped together.',
              },
              side: { type: 'string', enum: ['Bride', 'Groom', 'Both'] },
              group: {
                type: 'string',
                enum: ['Couple Friends', 'Bride Family', 'Groom Family', 'Bride Friends', 'Groom Friends', 'Work', 'Other'],
              },
              list: { type: 'string', enum: ['Invited', 'B-list'] },
              kind: { type: 'string', enum: ['adult', 'child'] },
              rsvp: { type: 'string', enum: ['Yes', 'No', 'Waiting'] },
            },
            required: ['index', 'name', 'household', 'side', 'group', 'list', 'kind', 'rsvp'],
          },
        },
      },
      required: ['guests'],
    },
  };

  const system =
    'You are cleaning up a wedding guest spreadsheet. The columns are inconsistent and may use ' +
    'shorthand. For every PERSON (a row may contain a couple like "John & Jane" — split them into two ' +
    'people that share one household), infer: the household they belong to (same invitation = same ' +
    'household label), which side of the couple they belong to, the relationship category, the guest ' +
    'list tier, whether they are an adult or child, and their RSVP status. Use every column as context, ' +
    'including ones with unusual names. If a value is genuinely unknown, choose the most reasonable ' +
    'default (side "Both", group "Other", list "Invited", kind "adult", rsvp "Waiting"). Return one ' +
    'entry per person via the categorize_guests tool. The index field is the 0-based source row index.';

  try {
    const msg = await client.messages.create({
      model: IMPORT_MODEL,
      max_tokens: 8000,
      system,
      tools: [tool as any],
      tool_choice: { type: 'tool', name: 'categorize_guests' },
      messages: [{ role: 'user', content: JSON.stringify(records) }],
    });
    const block: any = msg.content.find((b: any) => b.type === 'tool_use');
    if (!block) return c.json({ error: 'no result' }, 502);
    return c.json(block.input);
  } catch (e: any) {
    const status = e?.status;
    const message = status === 401 ? 'invalid api key' : e?.message || 'categorization failed';
    return c.json({ error: message }, status === 401 ? 401 : 502);
  }
});

app.get('/health', (c) => c.text('ok'));

// Serve built static assets
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }));

// Everything else serves the SPA
app.get('*', async (c) => {
  try {
    const html = await fs.readFile(path.join(STATIC_DIR, 'index.html'), 'utf-8');
    return c.html(html);
  } catch {
    return c.text('app not built — run `npm run build` first', 503);
  }
});

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`wedding-dashboard listening on :${info.port}`);
  console.log(`data file: ${FILE}`);
});
