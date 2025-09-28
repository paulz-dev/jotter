import React, { useEffect, useState, forwardRef } from "react";

/** TRATON-inspired palette */
const palette = {
  bg: "#ffffff",
  text: "#0B0F14",         // deep charcoal
  subtext: "#4B5563",      // muted grey (labels)
  border: "#E5E7EB",       // light grey
  cardBg: "#FFFFFF",
  cardBorder: "#E5E7EB",
  accent: "#1F2A44",       // deep navy accent
  accentHover: "#162033",
  inputBg: "#FFFFFF",

  // NEW: greenish tint for the Focus section (inspired by the TRATON site)
  focusBg: "#E4F1EF",
  focusBorder: "#B9DAD4",
};

type Note = {
  id: string;
  text: string;
  summary?: string;
  tags?: string[];
  updatedAt: string;
};

/* -------------------------
   Shared UI pieces (moved OUTSIDE App to avoid remounts)
   ------------------------- */

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12, color: palette.subtext, marginBottom: 6 }}>{children}</div>
);

const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
> = ({ children, style, onMouseDown, ...props }) => (
  <button
    {...props}
    onMouseDown={(e) => {
      // keep caret in textarea when clicking buttons nearby
      e.preventDefault();
      onMouseDown?.(e);
    }}
    style={{
      padding: "8px 14px",
      borderRadius: 8,
      border: `1px solid ${palette.accent}`,
      background: palette.accent,
      color: "#fff",
      cursor: "pointer",
      transition: "background 120ms ease",
      fontWeight: 500,
      ...style,
    }}
    onMouseEnter={(e) =>
      ((e.currentTarget as HTMLButtonElement).style.background = palette.accentHover)
    }
    onMouseLeave={(e) =>
      ((e.currentTarget as HTMLButtonElement).style.background = palette.accent)
    }
  >
    {children}
  </button>
);

const SecondaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
> = ({ children, style, onMouseDown, ...props }) => (
  <button
    {...props}
    onMouseDown={(e) => {
      e.preventDefault();
      onMouseDown?.(e);
    }}
    style={{
      padding: "8px 14px",
      borderRadius: 8,
      border: `1px solid ${palette.border}`,
      background: "#F9FAFB",
      color: palette.text,
      cursor: "pointer",
      transition: "background 120ms ease",
      fontWeight: 500,
      ...style,
    }}
    onMouseEnter={(e) =>
      ((e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6")
    }
    onMouseLeave={(e) =>
      ((e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB")
    }
  >
    {children}
  </button>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border: `1px solid ${palette.border}`,
      background: palette.inputBg,
      color: palette.text,
      outline: "none",
      minWidth: 220,
    }}
  />
);

/** ForwardRef fix + extension hardening (attributes don't affect styling) */
const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaBase(props, ref) {
    return (
      <textarea
        {...props}
        ref={ref}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
        data-lt-active="false"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${palette.border}`,
          background: palette.inputBg,
          color: palette.text,
          outline: "none",
          resize: "vertical",
        }}
      />
    );
  }
);

/* -------------------------
   App (unchanged visuals except Focus box color)
   ------------------------- */

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({}); // id -> draft text

  // Top signals state
  const [topSignals, setTopSignals] = useState<Note[] | null>(null);

  useEffect(() => {
    load();
    // Set document background to match palette
    document.documentElement.style.background = palette.bg;
    document.body.style.background = palette.bg;
    document.body.style.color = palette.text;
  }, []);

  async function load() {
    const res = await fetch("/api/notes");
    setNotes(await res.json());
  }

  // ------- CRUD -------
  async function create() {
    if (!text.trim()) return;
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setText("");
    load();
  }

  async function enrich(id: string) {
    await fetch(`/api/notes/${id}/enrich`, { method: "POST" });
    load();
  }

  function startEdit(id: string, current: string) {
    setEditing((e) => ({ ...e, [id]: current }));
  }

  function cancelEdit(id: string) {
    setEditing((e) => {
      const { [id]: _drop, ...rest } = e;
      return rest;
    });
  }

  async function saveEdit(id: string) {
    const draft = editing[id] ?? "";
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft }),
    });
    cancelEdit(id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    load();
  }

  // ------- search -------
  async function search() {
    const url = new URL("/api/search", location.origin);
    if (q) url.searchParams.set("q", q);
    if (tag) url.searchParams.set("tag", tag);
    const res = await fetch(url.toString().replace(location.origin, ""));
    setNotes(await res.json());
  }

  // ------- top signals -------
  async function loadTopSignals() {
    const res = await fetch("/api/signals/top?limit=5");
    const data = await res.json();
    setTopSignals(data);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      {/* Header / Hero */}
      <header
        style={{
          padding: "28px 24px 20px",
          borderBottom: `1px solid ${palette.border}`,
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: "2.8rem",
            lineHeight: 1.15,
            margin: 0,
            color: palette.text,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Jotter
        </h1>

        <div
          style={{
            textAlign: "center",
            fontSize: "1.25rem",
            lineHeight: 1.5,
            marginTop: 6,
            color: palette.subtext,
            fontWeight: 400,
          }}
        >
          Less noise. More signal. With AI.
        </div>
      </header>

      {/* Content container */}
      <main style={{ padding: "0 24px 40px" }}>
        {/* Create */}
        <section
          style={{
            background: palette.cardBg,
            border: `1px solid ${palette.cardBorder}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <FieldLabel>New note</FieldLabel>
          <TextArea
            rows={3}
            placeholder="Write a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <PrimaryButton onClick={create}>Add note</PrimaryButton>
          </div>
        </section>

        {/* Search */}
        <section
          style={{
            background: palette.cardBg,
            border: `1px solid ${palette.cardBorder}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <FieldLabel>Search</FieldLabel>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Input placeholder="Search text" value={q} onChange={(e) => setQ(e.target.value)} />
            <Input placeholder="Search tag" value={tag} onChange={(e) => setTag(e.target.value)} />
            <PrimaryButton onClick={search}>Search</PrimaryButton>
            <SecondaryButton onClick={load}>Reset</SecondaryButton>
          </div>
        </section>

        {/* Top signals today (now in greenish tint) */}
        <section
          style={{
            background: palette.focusBg,             // greenish background
            border: `1px solid ${palette.focusBorder}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <FieldLabel>Focus</FieldLabel>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <PrimaryButton onClick={loadTopSignals}>Top 5 signals today</PrimaryButton>
            <SecondaryButton onClick={() => setTopSignals(null)}>Clear</SecondaryButton>
          </div>

          {topSignals && (
            <>
              {topSignals.length === 0 ? (
                <p style={{ color: palette.subtext, margin: 0 }}>No signals today.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {topSignals.map((n) => (
                    <li
                      key={n.id}
                      style={{
                        background: palette.cardBg,
                        border: `1px solid ${palette.cardBorder}`,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>
                        ID: {n.id}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: palette.text }}>Text: </span>
                        <span>{n.text}</span>
                      </div>
                      {n.summary && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: palette.text }}>Summary: </span>
                          <span>{n.summary}</span>
                        </div>
                      )}
                      {n.tags && n.tags.length > 0 && (
                        <div>
                          <span style={{ fontWeight: 600, color: palette.text }}>Tags: </span>
                          <span>{n.tags.join(", ")}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* List */}
        <section>
          {notes.length === 0 ? (
            <p style={{ color: palette.subtext, margin: "12px 0" }}>No notes yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {notes.map((n) => {
                const isEditing = editing[n.id] !== undefined;
                return (
                  <li
                    key={n.id}
                    style={{
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>
                      ID: {n.id}
                    </div>

                    {!isEditing ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: palette.text }}>
                          Text
                        </div>
                        <div>{n.text}</div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: palette.text }}>
                          Edit text
                        </div>
                        <TextArea
                          rows={3}
                          value={editing[n.id]}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, [n.id]: e.target.value }))
                          }
                        />
                      </div>
                    )}

                    {n.summary && (
                      <div style={{ marginTop: 6 }}>
                        <span style={{ fontWeight: 600, color: palette.text }}>Summary: </span>
                        <span>{n.summary}</span>
                      </div>
                    )}
                    {n.tags && n.tags.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <span style={{ fontWeight: 600, color: palette.text }}>Tags: </span>
                        <span>{n.tags.join(", ")}</span>
                      </div>
                    )}
                    <div style={{ marginTop: 6, color: palette.subtext, fontSize: 12 }}>
                      Updated: {n.updatedAt}
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!isEditing ? (
                        <>
                          <SecondaryButton onClick={() => startEdit(n.id, n.text)}>
                            Edit
                          </SecondaryButton>
                          <PrimaryButton onClick={() => enrich(n.id)}>Enrich</PrimaryButton>
                          <SecondaryButton onClick={() => remove(n.id)}>Delete</SecondaryButton>
                        </>
                      ) : (
                        <>
                          <PrimaryButton onClick={() => saveEdit(n.id)}>Save</PrimaryButton>
                          <SecondaryButton onClick={() => cancelEdit(n.id)}>Cancel</SecondaryButton>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

