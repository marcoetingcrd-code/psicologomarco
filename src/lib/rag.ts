import { search } from "./vectorstore";
import { generate, hasGemini } from "./gemini";
import type { Source } from "./corpus";

export interface RagResult {
  answer: string;
  sources: { source: Source; score: number }[];
  usedLLM: boolean;
}

const SYSTEM = `Sei Atlas, un assistente di ricerca rigoroso su psicologia delle relazioni, attaccamento, neurobiologia dell'amore, carisma evidence-based, salute mente-corpo.

REGOLE:
1. Rispondi SOLO basandoti sui passaggi del CONTESTO fornito. Se il contesto non contiene l'informazione, dichiaralo.
2. Cita sempre le fonti con il formato [id] dopo ogni affermazione non ovvia.
3. Distingui chiaramente tra: evidenze empiriche forti, ipotesi, consenso, controversie.
4. Smonta attivamente miti pick-up / pseudo-evolutivi quando il contesto lo permette.
5. Tono: diretto, sintetico, ad alta densità informativa. Niente fuffa motivazionale.
6. Lingua: italiano, tranne termini tecnici inglesi standardizzati.`;

export async function answer(query: string): Promise<RagResult> {
  const hits = await search(query, 5);
  const context = hits
    .map(
      (h, i) =>
        `[${h.source.id}] (${h.source.authors}, ${h.source.year}) "${h.source.title}" — ${h.source.venue}\n${h.source.summary}`,
    )
    .join("\n\n");

  if (!hasGemini()) {
    const manual =
      `**⚠️ Modalità senza LLM (GEMINI_API_KEY non impostata).**\n\n` +
      `Ho recuperato i passaggi più rilevanti del corpus per la tua domanda. ` +
      `Per avere sintesi generate con citazioni automatiche, imposta \`GEMINI_API_KEY\` nel file \`.env.local\`.\n\n---\n\n` +
      hits
        .map(
          (h) =>
            `**[${h.source.id}]** ${h.source.authors} (${h.source.year}) — *${h.source.title}*\n${h.source.summary}`,
        )
        .join("\n\n");
    return { answer: manual, sources: hits, usedLLM: false };
  }

  const prompt = `DOMANDA UTENTE:\n${query}\n\nCONTESTO (passaggi recuperati dal corpus scientifico):\n\n${context}\n\nFornisci una risposta rigorosa, con citazioni [id], evidenziando quando il contesto è insufficiente.`;

  const text = await generate(prompt, SYSTEM);
  return { answer: text, sources: hits, usedLLM: true };
}
