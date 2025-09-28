import OpenAI from "openai";

const SYS = `You summarize notes in ≤ 25 words and produce 1–5 short tags (lowercase, alphanumeric words).
Output strict JSON: {"summary":"...","tags":["...", "..."]}`;

export async function enrichWithLLM(text: string, apiKey?: string) {
  if (!apiKey) return heuristic(text);

  const openai = new OpenAI({ apiKey });
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });

    const content = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return sanitize(parsed.summary, parsed.tags);
  } catch {
    return heuristic(text);
  }
}

function heuristic(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const summary = clean.split(" ").slice(0, 25).join(" ");
  const terms = (clean.toLowerCase().match(/\b[a-z0-9]{4,}\b/g) ?? []);
  const uniq = Array.from(new Set(terms));
  const tags = uniq.slice(0, 5);
  return sanitize(summary, tags);
}

function sanitize(summary?: string, tags?: string[]) {
  const s = (summary ?? "").trim();
  const t = (tags ?? []).map(x => x.toLowerCase()).filter(Boolean).slice(0,5);
  return { summary: s, tags: t };
}
