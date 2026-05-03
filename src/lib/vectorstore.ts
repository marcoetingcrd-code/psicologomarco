import { CORPUS, Source } from "./corpus";
import { embed, hasGemini } from "./gemini";

type Vec = { id: string; vector: number[]; source: Source };

let INDEX: Vec[] | null = null;
let buildPromise: Promise<Vec[]> | null = null;

// Fallback semantic-ish: hashed word bag cosine. Works offline without Gemini.
function pseudoEmbed(text: string): number[] {
  const dim = 256;
  const v = new Array(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    v[idx] += 1;
  }
  // L2 normalize
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot; // vectors are normalized
}

async function embedOne(text: string): Promise<number[]> {
  if (hasGemini()) {
    try {
      const [v] = await embed([text]);
      // normalize
      const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / n);
    } catch {
      return pseudoEmbed(text);
    }
  }
  return pseudoEmbed(text);
}

export async function buildIndex(): Promise<Vec[]> {
  if (INDEX) return INDEX;
  if (buildPromise) return buildPromise;
  buildPromise = (async () => {
    const out: Vec[] = [];
    for (const s of CORPUS) {
      const text = `${s.title}\n${s.summary}\nTopics: ${s.topic.join(", ")}`;
      const vector = await embedOne(text);
      out.push({ id: s.id, vector, source: s });
    }
    INDEX = out;
    return out;
  })();
  return buildPromise;
}

export async function search(query: string, k = 4) {
  const index = await buildIndex();
  const qv = await embedOne(query);
  const scored = index.map((e) => ({ source: e.source, score: cosine(qv, e.vector) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export async function embedQuery(text: string) {
  return embedOne(text);
}
