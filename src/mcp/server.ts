/**
 * Jotter MCP server over stdio (newline-delimited JSON-RPC).
 * - Implements MCP: initialize, tools/list, tools/call
 * - Keeps my legacy custom methods (notes.*) for back-compat
 *
 * IMPORTANT: Do not write non-JSON to stdout. Use console.error for logs.
 */

const API = process.env.API_URL || "http://localhost:3000/api";
const PROTOCOL_VERSION = "2025-06-18"; // fine to keep as a constant

process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;

    try {
      const msg = JSON.parse(line);
      if (!msg || typeof msg !== "object" || !msg.method) continue; // ignore noise
      const { id, method, params } = msg;

      try {
        // MCP core
        if (method === "initialize") {
          reply(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "jotter-mcp", version: "0.1.0" },
            instructions:
              "Jotter MCP exposes tools for creating, editing, searching, enriching notes, and listing today's top signals.",
          });
          continue;
        }

        if (method === "tools/list") {
          reply(id, {
            tools: [
              {
                name: "create_note",
                description: "Create a note with free text.",
                inputSchema: {
                  type: "object",
                  properties: { text: { type: "string", minLength: 1 } },
                  required: ["text"],
                },
              },
              {
                name: "edit_note",
                description: "Update note text by id.",
                inputSchema: {
                  type: "object",
                  properties: {
                    id: { type: "string", minLength: 1 },
                    text: { type: "string", minLength: 1 },
                  },
                  required: ["id", "text"],
                },
              },
              {
                name: "delete_note",
                description: "Delete a note by id.",
                inputSchema: {
                  type: "object",
                  properties: { id: { type: "string", minLength: 1 } },
                  required: ["id"],
                },
              },
              {
                name: "search_notes",
                description: "Search notes by free text and/or tag; optional semantic mode.",
                inputSchema: {
                  type: "object",
                  properties: {
                    q: { type: "string", default: "" },
                    tag: { type: "string", default: "" },
                    semantic: { type: "boolean", default: false },
                  },
                },
              },
              {
                name: "enrich_note",
                description: "Summarize, tag, and classify a note as signal/noise.",
                inputSchema: {
                  type: "object",
                  properties: { id: { type: "string", minLength: 1 } },
                  required: ["id"],
                },
              },
              {
                name: "top_signals_today",
                description: "Return today's top signal notes (AI-ranked when configured).",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
                  },
                },
              },
              // utility
              {
                name: "list_notes",
                description: "List all notes (most recent first).",
                inputSchema: { type: "object", properties: {} },
              },
              {
                name: "get_note",
                description: "Get a note by id.",
                inputSchema: {
                  type: "object",
                  properties: { id: { type: "string", minLength: 1 } },
                  required: ["id"],
                },
              },
            ],
          });
          continue;
        }

        if (method === "tools/call") {
          const name = params?.name as string;
          const args = (params?.arguments as any) || {};

          const run = async () => {
            switch (name) {
              case "create_note":
                return post("/notes", { text: mustString(args.text, "text") });
              case "edit_note":
                return patch(`/notes/${mustString(args.id, "id")}`, {
                  text: mustString(args.text, "text"),
                });
              case "delete_note":
                await del(`/notes/${mustString(args.id, "id")}`);
                return { ok: true };
              case "search_notes": {
                const q = encodeURIComponent(String(args.q ?? ""));
                const tag = encodeURIComponent(String(args.tag ?? ""));
                const semantic = args.semantic ? "&semantic=true" : "";
                return get(`/search?q=${q}&tag=${tag}${semantic}`);
              }
              case "enrich_note":
                await post(`/notes/${mustString(args.id, "id")}/enrich`, {});
                return get(`/notes/${args.id}`);
              case "top_signals_today": {
                const limit = clampInt(args.limit ?? 5, 1, 20);
                return get(`/signals/top?limit=${limit}`);
              }
              case "list_notes":
                return get("/notes");
              case "get_note":
                return get(`/notes/${mustString(args.id, "id")}`);
              default:
                throw protoError(-32602, `Unknown tool: ${name}`);
            }
          };

          try {
            const data = await run();
            reply(id, { content: [{ type: "json", json: data }], isError: false });
            continue;
          } catch (err: any) {
            reply(id, {
              content: [{ type: "text", text: "Tool failed: " + (err?.message || String(err)) }],
              isError: true,
            });
            continue;
          }
        }

        // ----- legacy custom methods (unchanged) -----
        if (method.startsWith("notes.")) {
          const result = await legacyHandle(method, params || {});
          reply(id, result);
          continue;
        }

        replyError(id, -32601, `Unknown method: ${method}`);
        continue;
      } catch (e: any) {
        console.error("handler error:", e);
        replyError(id, -32603, e?.message || "Internal error");
        continue;
      }
    } catch {
      // ignore malformed line
      continue;
    }
  }
});

/* ------------ helpers ------------ */

function reply(id: any, result: any) {
  if (id === undefined || id === null) return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyError(id: any, code: number, message: string, data?: any) {
  if (id === undefined || id === null) return;
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } }) + "\n"
  );
}

function mustString(v: any, field: string) {
  if (typeof v !== "string" || !v.length) throw protoError(-32602, `Missing/invalid ${field}`);
  return v;
}
function clampInt(v: any, min: number, max: number) {
  let n = parseInt(String(v), 10);
  if (Number.isNaN(n)) n = min;
  return Math.max(min, Math.min(max, n));
}
function protoError(code: number, message: string) {
  const err = new Error(message) as any;
  err.code = code;
  return err;
}

/* HTTP (global fetch in Node 18+) */
async function get(p: string) {
  const r = await fetch(API + p);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function post(p: string, b: any) {
  const r = await fetch(API + p, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function patch(p: string, b: any) {
  const r = await fetch(API + p, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function del(p: string) {
  const r = await fetch(API + p, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* Legacy dispatcher */
async function legacyHandle(method: string, params: any) {
  switch (method) {
    case "notes.list": return get("/notes");
    case "notes.get": return get(`/notes/${params.id}`);
    case "notes.create": return post("/notes", { text: params.text });
    case "notes.update": return patch(`/notes/${params.id}`, { text: params.text });
    case "notes.delete": return del(`/notes/${params.id}`);
    case "notes.enrich":
      await post(`/notes/${params.id}/enrich`, {});
      return get(`/notes/${params.id}`);
    case "notes.search": {
      const q = encodeURIComponent(params.q || "");
      const tag = encodeURIComponent(params.tag || "");
      return get(`/search?q=${q}&tag=${tag}`);
    }
    default: return { error: `unknown method: ${method}` };
  }
}

