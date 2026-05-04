import { NextRequest, NextResponse } from "next/server";
import { generate, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM = `Sei Atlas. Analizzi conversazioni AI importate dall'utente.
Obiettivo: capire pattern, bisogni, punti ciechi e trasformarli in un piano pratico.
Tono: amico competente, diretto, non professore. Niente diagnosi cliniche. Niente markdown pesante.
Formato: sezioni brevi con titoli semplici. Italiano naturale.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const goal = String(body.goal || "").trim();

  if (!text || text.length < 300) {
    return NextResponse.json({ error: "Incolla almeno 300 caratteri di conversazione." }, { status: 400 });
  }

  const clipped = text.slice(0, 45000);

  if (!hasGemini()) {
    return NextResponse.json({
      analysis: fallbackAnalysis(clipped, goal),
      usedLLM: false,
    });
  }

  const prompt = `L'utente ha importato una conversazione già fatta con un'altra AI o con una persona.

OBIETTIVO DICHIARATO:
${goal || "Non specificato"}

CONVERSAZIONE IMPORTATA:
${clipped}

Analizza senza fare il professore. Produci:
1. Cosa sta cercando davvero l'utente sotto la superficie.
2. Pattern ricorrenti (emozioni, blocchi, contraddizioni, bisogni).
3. Cosa l'altra AI/persona non ha capito o ha trattato troppo genericamente.
4. Piano pratico in 5 passi, molto concreto.
5. La prima azione da fare oggi.

Non citare il testo parola per parola se contiene dati sensibili. Non fare diagnosi. Non consigliare terapeuti. Aiuta l'utente a capire e agire.`;

  try {
    const analysis = await generate(prompt, SYSTEM);
    return NextResponse.json({ analysis: sanitize(analysis), usedLLM: true });
  } catch (e: any) {
    return NextResponse.json({ analysis: fallbackAnalysis(clipped, goal), usedLLM: false, error: e.message });
  }
}

function sanitize(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackAnalysis(text: string, goal: string) {
  const lower = text.toLowerCase();
  const themes = [
    lower.includes("relazione") || lower.includes("ragazza") || lower.includes("ex") ? "relazioni" : null,
    lower.includes("ansia") || lower.includes("paura") ? "ansia" : null,
    lower.includes("lavoro") || lower.includes("soldi") ? "lavoro/denaro" : null,
    lower.includes("alcol") || lower.includes("droga") || lower.includes("fumo") ? "dipendenze" : null,
  ].filter(Boolean).join(", ") || "tema personale non ancora chiaro";

  return `Ho letto la conversazione importata. Il tema centrale sembra essere: ${themes}. ${goal ? `Tu vuoi soprattutto: ${goal}.` : "Per rendere l'analisi più precisa, dimmi anche cosa volevi ottenere da quella conversazione."}

Quello che noto è che stai cercando una direzione concreta, non solo spiegazioni. Il rischio, con le AI generiche, è girare intorno al problema: tante idee, pochi passi verificabili.

Piano pratico: scegli un solo obiettivo per i prossimi 7 giorni, scrivilo in una frase misurabile, poi identifica il comportamento che lo blocca più spesso. Ogni sera annota cosa è successo, cosa hai fatto e cosa farai domani. La prima azione oggi: riassumi in 5 righe qual è il problema reale sotto quella conversazione, senza abbellirlo.`;
}
