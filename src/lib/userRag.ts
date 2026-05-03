// Hybrid RAG: scientific corpus + user journal entries
// User context gets embedded and searched alongside scientific sources

import { embedQuery } from "./vectorstore";
import { getEntries, JournalEntry } from "./journal";
import { CORPUS, Source } from "./corpus";

export interface HybridResult {
  type: "scientific" | "personal";
  score: number;
  content: string;
  meta: Source | JournalEntry;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export async function hybridSearch(
  sessionId: string,
  query: string,
  k = 5,
): Promise<HybridResult[]> {
  const qv = await embedQuery(query);

  // Scientific sources
  const sciResults: HybridResult[] = [];
  for (const src of CORPUS) {
    const text = `${src.title}\n${src.summary}\nTopics: ${src.topic.join(", ")}`;
    const sv = await embedQuery(text);
    sciResults.push({
      type: "scientific",
      score: cosine(qv, sv),
      content: text,
      meta: src,
    });
  }
  sciResults.sort((a, b) => b.score - a.score);

  // Personal journal entries
  const entries = getEntries(sessionId);
  const personalResults: HybridResult[] = [];
  for (const e of entries) {
    const ev = await embedQuery(e.text);
    personalResults.push({
      type: "personal",
      score: cosine(qv, ev) * 1.1, // slight boost to personal data
      content: e.text,
      meta: e,
    });
  }
  personalResults.sort((a, b) => b.score - a.score);

  // RRF fusion (Reciprocal Rank Fusion)
  const all = [...sciResults, ...personalResults];
  const ranks = new Map<string, number>();
  sciResults.forEach((r, i) => ranks.set(`sci:${r.meta.id}`, 1 / (i + 1 + 60)));
  personalResults.forEach((r, i) => ranks.set(`per:${r.meta.id}`, 1 / (i + 1 + 60)));

  all.sort((a, b) => {
    const keyA = a.type === "scientific" ? `sci:${(a.meta as Source).id}` : `per:${(a.meta as JournalEntry).id}`;
    const keyB = b.type === "scientific" ? `sci:${(b.meta as Source).id}` : `per:${(a.meta as JournalEntry).id}`;
    return (ranks.get(keyB) ?? 0) - (ranks.get(keyA) ?? 0);
  });

  return all.slice(0, k);
}
