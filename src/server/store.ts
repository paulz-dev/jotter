import Database from "better-sqlite3";
import { Note } from "./types.js";
import fs from "node:fs";
import path from "node:path";

// Resolve DB path
const DB_PATH = process.env.DB_PATH || "notes.db";

// Ensure containing dir exists if a path like data/notes.db is used
const dir = path.dirname(DB_PATH);
if (dir && dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Open DB
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    summary TEXT,
    tags TEXT,              -- JSON string (array of strings) or NULL
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

// Helpers to convert between DB row and Note
function rowToNote(row: any): Note {
  return {
    id: row.id,
    text: row.text,
    summary: row.summary ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const insertStmt = db.prepare(`
  INSERT INTO notes (id, text, summary, tags, createdAt, updatedAt)
  VALUES (@id, @text, @summary, @tags, @createdAt, @updatedAt)
`);

const selectOneStmt = db.prepare(`SELECT * FROM notes WHERE id = ?`);
const selectAllStmt = db.prepare(`SELECT * FROM notes ORDER BY createdAt ASC`);
const updateStmt = db.prepare(`
  UPDATE notes
     SET text = COALESCE(@text, text),
         summary = COALESCE(@summary, summary),
         tags = COALESCE(@tags, tags),
         updatedAt = @updatedAt
   WHERE id = @id
`);
const deleteStmt = db.prepare(`DELETE FROM notes WHERE id = ?`);

export const store = {
  create(n: Note): Note {
    insertStmt.run({
      id: n.id,
      text: n.text,
      summary: n.summary ?? null,
      tags: n.tags ? JSON.stringify(n.tags) : null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    });
    return n;
  },

  get(id: string): Note | null {
    const row = selectOneStmt.get(id);
    return row ? rowToNote(row) : null;
  },

  list(): Note[] {
    const rows = selectAllStmt.all();
    return rows.map(rowToNote);
  },

  update(id: string, patch: Partial<Note>): Note {
    // Load existing to compute merged fields
    const existing = this.get(id);
    if (!existing) throw new Error("Not found");

    const updated: Note = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    updateStmt.run({
      id: updated.id,
      text: patch.text ?? null,
      summary: patch.summary ?? null,
      tags: patch.tags ? JSON.stringify(patch.tags) : null,
      updatedAt: updated.updatedAt,
    });

    return updated;
  },

  remove(id: string): boolean {
    const info = deleteStmt.run(id);
    return info.changes > 0;
  },
};

