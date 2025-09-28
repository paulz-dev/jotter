# AGENTS.md — Jotter (MCP-enabled)

> This file gives **coding agents** everything they need to work on the Jotter project: how to set up, build, run checks, follow style, and use the MCP server. It is standard Markdown and lives at the repo root.

---

## Setup commands

- Install deps (root, server only):  
  ```bash
  npm install
  ```

- Start API + UI in **dev** (single process):  
  ```bash
  npm run dev:api    # serves API+UI at http://localhost:3000
  ```

- Start MCP server in **dev** (requires API running):  
  ```bash
  API_URL=http://localhost:3000/api npm run dev:mcp
  ```

- Build everything (TypeScript → dist, plus UI is built in Docker stage):  
  ```bash
  npm run build
  ```

- Start compiled API (production-like, no watcher):  
  ```bash
  npm start          # node dist/server/index.js
  ```

### Docker

- Build & run both API and static UI:  
  ```bash
  docker compose up -d --build
  ```

- One-shot MCP call **inside** the running container:  
  ```bash
  # Initialize
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'   | docker exec -i jotter node /app/dist/mcp/server.js
  ```

- Default in-container API base for MCP: `API_URL=http://localhost:3000/api`.  
  If MCP runs in a **different** container, use `API_URL=http://jotter:3000/api` and the same compose network.

---

## Project overview

Jotter is a tiny notes app with AI enrichment:
- **Summary** (≤ 25 words)
- **Tags** (1–5, lowercase)
- **Signal/Noise** classification
- **Top 5 signals (today)** endpoint/tool
- REST API with SQLite persistence (file DB), React UI bundled into the same server image
- Exposed as **MCP tools** over newline‑delimited JSON‑RPC (stdio)

**High-level goals** for agents:
- Keep the app **simple to run** (single command locally or via Docker).
- Keep API stable; update UI and docs if changing endpoints.
- Treat AGENTS.md + README.md as living docs; prefer updating them over comments scattered in code.

---

## Repository layout

```
src/
  server/
    index.ts      # Express bootstrap (serves API + static UI)
    routes.ts     # HTTP endpoints
    search.ts     # search handlers
    enrich.ts     # AI enrichment logic
    store.ts      # SQLite data access
    types.ts
  mcp/
    server.ts     # newline-delimited JSON-RPC over stdio, exposes MCP tools
ui/               # React (Vite) frontend; built in Dockerfile (ui stage)
Dockerfile
docker-compose.yml
README.md
AGENTS.md         # this file
```

---

## Build, run, and checks

- **Type checks** (no tests yet):  
  ```bash
  npm run build    # runs tsc -p .
  ```

- **Local dev**:  
  ```bash
  npm run dev:api
  # (separate terminal, optional) run MCP server for local testing
  API_URL=http://localhost:3000/api npm run dev:mcp
  ```

- **Docker dev/prod**:  
  ```bash
  docker compose up -d --build
  ```

- **Logs & shell**:  
  ```bash
  docker compose logs -f
  docker exec -it jotter sh
  ```

> If adding tests, prefer **Vitest** for TypeScript server tests and React component tests. Agents should create a `vitest.config.ts` and wire a `npm test` script. Until then, rely on compiler/type checks to block broken builds.

---

## Code style

- TypeScript **strict** mode
- Modules: ESM (`"type": "module"` in package.json)
- Prefer small, pure functions; avoid global state except for singletons (DB, app)
- Keep **stdout** of the MCP server **JSON only** (use `console.error` for logs)
- Inline styles in UI are OK; keep styles minimal and stable with the TRATON palette already in use
- Avoid complex abstractions; readability over cleverness

Formatting / lint:
- No linter configured yet. If you introduce one, add:  
  ```bash
  npm run lint     # and ensure CI uses it
  ```

Commit / PR guidance:
- Keep commits focused; include “why” in the message body if the diff is non-obvious.
- If you change an endpoint or tool signature, update **README.md** and **AGENTS.md** in the same PR.
- Ensure `npm run build` passes before merging.

---

## Security & environment

- **Secrets**: do **not** commit keys. Use `.env`/Compose env; rotate keys if exposed.
- **OPENAI_API_KEY** (optional) enables AI summaries/tags and ranking. Without it, logic falls back to deterministic defaults.
- **DB_PATH**: SQLite file path (default in container: `/app/data/notes.db`). Mount a volume in Docker for persistence.
- Avoid logging PII or secrets. No PII should be stored in notes.
- The MCP server should never print non-JSON to **stdout** (stdio is the protocol).

Environment summary:
```
OPENAI_API_KEY   # optional
DB_PATH          # path to SQLite DB (default used in Docker)
API_URL          # base URL for MCP to reach the API; defaults to http://localhost:3000/api
PORT             # express port, defaults to 3000
```

---

## MCP tools

The MCP server implements JSON‑RPC over stdio with three standard methods (`initialize`, `tools/list`, `tools/call`) and keeps legacy methods for back‑compat under `notes.*`.

### Primary tools (via `tools/list` / `tools/call`)
- `create_note` — `{ text }` → creates a note  
- `edit_note` — `{ id, text }` → updates a note  
- `delete_note` — `{ id }` → deletes a note  
- `search_notes` — `{ q?, tag?, semantic? }` → searches notes  
- `enrich_note` — `{ id }` → summary + tags + signal/noise  
- `top_signals_today` — `{ limit? = 5 }` → today’s top signal notes (AI-ranked if key set)

### Utility tools
- `list_notes` — `{}` → all notes (most recent first)  
- `get_note` — `{ id }` → single note

### Legacy (back‑compat)
- `notes.list`, `notes.get { id }`, `notes.create { text }`, `notes.update { id, text }`,  
  `notes.delete { id }`, `notes.enrich { id }`, `notes.search { q?, tag? }`

---

## Quick JSON‑RPC scripts

### Handshake + list tools + top signals (in Docker)

```bash
docker exec -i jotter node /app/dist/mcp/server.js <<'JSONL'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"top_signals_today","arguments":{"limit":5}}}
JSONL
```

### 4‑step scenario: create → enrich → edit+enrich → top signals

1) **Create a note** (copy the returned `id`):
```bash
printf '%s\n' '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"create_note","arguments":{"text":"[signal] MCP test: ship hotfix before EOD; adding details soon."}}}' | docker exec -i jotter node /app/dist/mcp/server.js
```

2) **Run the sequence** (replace `<NOTE_ID>`):
```bash
docker exec -i jotter node /app/dist/mcp/server.js <<'JSONL'
{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"enrich_note","arguments":{"id":"<NOTE_ID>"}}}
{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"edit_note","arguments":{"id":"<NOTE_ID>","text":"[signal] MCP test: ship hotfix before EOD. Impact: data products blocked; ETA 18:00. Owner: Paul."}}}
{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"enrich_note","arguments":{"id":"<NOTE_ID>"}}}
{"jsonrpc":"2.0","id":14,"method":"tools/call","params":{"name":"top_signals_today","arguments":{"limit":5}}}
JSONL
```

### Automated id capture (requires `jq`)
```bash
NOTE_ID=$(
  printf '%s\n'   '{"jsonrpc":"2.0","id":20,"method":"tools/call","params":{"name":"create_note","arguments":{"text":"[signal] MCP test: add rollback plan for hotfix."}}}'   | docker exec -i jotter node /app/dist/mcp/server.js   | jq -r '.result.content[0].json.id'
)
echo "NOTE_ID=$NOTE_ID"
```

---

## Testing (future work)

- Add **Vitest** for server and UI; wire `npm test` to run in CI.
- Provide a small integration test that spawns `node dist/mcp/server.js` and exchanges JSON‑RPC lines (initialize → tools/list → tools/call).
- For DB, add a test SQLite path (e.g., `DB_PATH=:memory:` or a temp file).

---

## Troubleshooting tips

- **Only one response when sending multiple JSON lines**: ensure the MCP loop uses `continue` after every `reply(...)` so multiple messages in a heredoc are processed.
- **Cannot find module `/app/dist/mcp/server.js`**: rebuild the image or run `npm run build` locally.
- **No AI enrichment**: check `OPENAI_API_KEY` is set inside the container or host environment.
- **“Tool failed:” errors**: inspect server logs (`docker compose logs -f`) and verify endpoints exist.

---

## Agent expectations / conventions

- Keep edits minimal and focused; prefer simple, readable code.
- Update **AGENTS.md** whenever setup, commands, or tool signatures change.
- If you change the HTTP API, update both UI calls and MCP tool wrappers.
- Maintain the TRATON-inspired UI palette and typography choices.
