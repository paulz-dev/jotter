import { Note } from "./types.js";

export function searchNotes(all: Note[], q?: string, tag?: string) {
  const qq = (q ?? "").toLowerCase();
  const tt = (tag ?? "").toLowerCase();

  return all.filter(n => {
    const byTag = tt ? (n.tags ?? []).map(x=>x.toLowerCase()).includes(tt) : true;
    const blob = [n.text, n.summary ?? "", (n.tags ?? []).join(" ")].join(" ").toLowerCase();
    const byText = qq ? blob.includes(qq) : true;
    return byTag && byText;
  });
}
