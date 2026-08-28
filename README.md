# Wedding Dashboard

A single-wedding planning dashboard — guests, budget, vendors, seating, venues,
registry, gifts, honeymoon, timeline, and an **AI planning assistant** that can
read and edit the whole dashboard by chat.

## Review call-outs

Both partners work on the dashboard independently, so either of them can hand
something over: **Ask … to review** on a checklist task or a vendor category —
or a free-standing call-out from the overview — puts it on the other person's
**Review Call-Outs** widget until they open it and mark it reviewed, with a
reply.

Who you are is stored per browser (Customize → This Device), not in the shared
wedding data, so each of you sees your own inbox on the same dashboard.

## Running

```sh
npm install
npm run build      # builds the SPA + type-checks the server
npm start          # serves the built app + API on PORT (default 3000)
```

For development:

```sh
npm run dev        # Vite dev server on :5173 (SPA only)
npm start          # in another terminal — the API server the dev proxy calls
```

Data is stored on disk at `DATA_DIR` (default `/data`) as `wedding.json`, with
mood-board images under `DATA_DIR/images`.

## AI assistant

The docked **Wedding Assistant** (bottom-right) can add, edit, and remove
entries across every tab, read uploaded images/PDFs, and search the web (e.g.
pull venue details from a link). It runs the tool-use loop in the browser
against your store; the server only proxies model calls so your API key never
reaches the client.

Every change the assistant makes is **shown for approval before it is applied**,
and each applied change can be **undone** from the chat.

To enable it, set your Anthropic API key on the server:

```sh
ANTHROPIC_API_KEY=sk-ant-...        # required
ASSISTANT_MODEL=claude-opus-4-8     # optional, defaults to Claude Opus 4.8
```

On Railway, add `ANTHROPIC_API_KEY` as a service environment variable. Without a
key the dashboard works normally and the assistant panel shows a "not connected"
notice.
