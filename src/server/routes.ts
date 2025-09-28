import { Router } from "express";
import { v4 as uuid } from "uuid";
import { store } from "./store.js";
import { enrichWithLLM } from "./enrich.js";
import { searchNotes } from "./search.js";
import OpenAI from "openai";

export const r = Router();

// Optional OpenAI client (used for ranking top signals if key present)
const openai =
  process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/* ------------------------- helpers ------------------------- */

function heuristicClassifySignalNoise(text: string): "signal" | "noise" {
  const urgent = /(today|asap|urgent|deadline|due|blocker|critical|priority|p0|p1)/i.test(text);
  const actionable = /(todo|fix|ship|implement|decide|review|schedule|follow up|send|create)/i.test(
    text
  );
  return urgent || actionable ? "signal" : "noise";
}

function ensureSignalNoiseTag(tags: string[] | undefined, label: "signal" | "noise") {
  const base = Array.isArray(tags) ? tags : [];
  return Array.from(new Set([...base, label]));
}

function isTodayISO(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* ------------------------- CRUD + list ------------------------- */

r.get("/notes", (_req, res) => res.json(store.list()));

r.get("/notes/:id", (req, res) => {
  const n = store.get(req.params.id);
  if (!n) return res.sendStatus(404);
  res.json(n);
});

r.post("/notes", (req, res) => {
  const text = String(req.body?.text ?? "");
  const now = new Date().toISOString();
  const note = { id: uuid(), text, createdAt: now, updatedAt: now };
  res.status(201).json(store.create(note as any));
});

r.patch("/notes/:id", (req, res) => {
  const n = store.get(req.params.id);
  if (!n) return res.sendStatus(404);
  const text = req.body?.text as string | undefined;
  res.json(store.update(n.id, { text }));
});

r.delete("/notes/:id", (req, res) => {
  res.json({ ok: store.remove(req.params.id) });
});

/* ------------------------- enrich ------------------------- */
/**
 * Enrich a note and ALWAYS add a "signal" or "noise" tag.
 * - Uses your existing enrichWithLLM() for summary+tags (OpenAI if key present; heuristic otherwise).
 * - Adds a classification tag based on a lightweight heuristic.
 *   (We can swap this to an OpenAI classification call if you prefer.)
 */
r.post("/notes/:id/enrich", async (req, res) => {
  const n = store.get(req.params.id);
  if (!n) return res.sendStatus(404);

  try {
    const label = heuristicClassifySignalNoise(n.text); // "signal" | "noise"
    const { summary, tags } = await enrichWithLLM(n.text, process.env.OPENAI_API_KEY);

    const finalTags = ensureSignalNoiseTag(tags, label);
    const updated = store.update(n.id, { summary, tags: finalTags });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "enrich failed" });
  }
});

/* ------------------------- search ------------------------- */

r.get("/search", (req, res) => {
  const q = req.query.q as string | undefined;
  const tag = req.query.tag as string | undefined;
  res.json(searchNotes(store.list(), q, tag));
});

/* ------------------------- top signals (today) ------------------------- */
/**
 * Return the Top N "signal" notes for TODAY.
 * - If OPENAI_API_KEY is present: ask the model to rank by urgency/impact.
 * - Otherwise: return latest N by updatedAt.
 * Query: /signals/top?limit=5  (defaults to 5, max 10)
 */
r.get("/signals/top", async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit ?? 5), 10));

  const all = store.list();
  const candidates = all
    .filter((n) => (n.tags ?? []).includes("signal"))
    .filter((n) => isTodayISO(n.createdAt)) // change to updatedAt if you prefer
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Fallback fast-path (no OpenAI)
  if (!openai) {
    return res.json(candidates.slice(0, limit));
  }

  // Use OpenAI to rank by urgency & impact
  const items = candidates
    .map(
      (n, i) => `#${i + 1} (${n.id})
TEXT: ${n.text}
SUMMARY: ${n.summary ?? "(none)"}
UPDATED_AT: ${n.updatedAt}
`
    )
    .join("\n");

  const prompt = `You are an executive assistant. Given today's "signal" notes, pick the TOP ${limit} to focus on NOW.
Rank by urgency, impact, deadlines, blockers, and dependency risk.
Return a JSON array of note IDs, most important first. Only JSON.

Notes:
${items}

JSON array of IDs only:`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const content = resp.choices[0].message.content ?? "[]";
    let ids: string[] = [];
    try {
      ids = JSON.parse(content);
    } catch {
      ids = [];
    }

    const ranked = ids
      .map((id) => candidates.find((n) => n.id === id))
      .filter(Boolean) as typeof candidates;

    // Fill any gaps, keep recency order for leftovers
    const remainder = candidates.filter((n) => !ranked.some((r) => r.id === n.id));
    const final = [...ranked, ...remainder].slice(0, limit);
    res.json(final);
  } catch (_e) {
    // On model error, fallback to recency
    res.json(candidates.slice(0, limit));
  }
});

