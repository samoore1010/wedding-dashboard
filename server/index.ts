import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
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
