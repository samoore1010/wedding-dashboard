import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || '/data';
const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.resolve('dist');

await fs.mkdir(DATA_DIR, { recursive: true });

const app = new Hono();

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const isValidId = (id: string) => ID_RE.test(id);
const filePath = (id: string) => path.join(DATA_DIR, `${id}.json`);
const MAX_BODY = 5_000_000; // 5 MB

app.get('/api/wedding/:id', async (c) => {
  const id = c.req.param('id');
  if (!isValidId(id)) return c.text('bad id', 400);
  try {
    const text = await fs.readFile(filePath(id), 'utf-8');
    return c.body(text, 200, { 'Content-Type': 'application/json' });
  } catch (e: any) {
    if (e.code === 'ENOENT') return c.body(null, 204);
    console.error('read failed', e);
    return c.text('read failed', 500);
  }
});

app.put('/api/wedding/:id', async (c) => {
  const id = c.req.param('id');
  if (!isValidId(id)) return c.text('bad id', 400);
  const text = await c.req.text();
  if (text.length > MAX_BODY) return c.text('payload too large', 413);
  try {
    JSON.parse(text); // sanity check
  } catch {
    return c.text('not valid json', 400);
  }
  const dest = filePath(id);
  const tmp = dest + '.tmp';
  await fs.writeFile(tmp, text);
  await fs.rename(tmp, dest);
  return c.text('ok');
});

app.get('/health', (c) => c.text('ok'));

// Serve built static assets (JS/CSS/etc.)
app.use(
  '/assets/*',
  serveStatic({ root: './dist' })
);
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }));

// SPA fallback — every other GET serves the React app
app.get('*', async (c) => {
  try {
    const html = await fs.readFile(path.join(STATIC_DIR, 'index.html'), 'utf-8');
    return c.html(html);
  } catch {
    return c.text(
      'app not built — run `npm run build` first',
      503
    );
  }
});

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`wedding-dashboard listening on :${info.port}`);
  console.log(`data dir: ${DATA_DIR}`);
});
