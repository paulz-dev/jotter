export type Note = {
  id: string;       // uuid
  text: string;     // raw user text
  summary?: string; // ≤ 25 words
  tags?: string[];  // 1–5 short keywords
  createdAt: string;
  updatedAt: string;
};
