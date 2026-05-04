"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Brain, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import {
  createConversation,
  getCurrentUser,
  getLastMessages,
  loadMessages,
  saveMessage,
} from "../lib/chat-store";

type SourceHit = {
  source: { id: string; authors: string; year: number; title: string; venue?: string; library?: string };
  score: number;
};
type Msg = { role: "user" | "assistant"; content: string; timestamp: number; sources?: SourceHit[]; cached?: boolean; usedLLM?: boolean };

function isGenericDatingQuestion(query: string): boolean {
  const q = query.toLowerCase();
  const datingIntent = /rimorchiare|rimorchio|sedurre|seduzione|approcciare|approccio|conquistare|ragazza|donne|dating|flirt|uscire con/i.test(q);
  if (!datingIntent) return false;
  const hasConcreteContext = /instagram|tinder|appuntamento|chat|messaggi|locale|discoteca|bar|palestra|lavoro|università|scuola|ex|rifiut|ansia|timidezza|lei|nome|ieri|domani|stasera|settimana/i.test(q);
  return !hasConcreteContext && q.length < 120;
}

function needsMoreContext(query: string): boolean {
  const q = query.toLowerCase();
  if (isGenericDatingQuestion(q)) return true;
  const genericIntent = /come faccio|come posso|dammi strategie|guidami|aiutami|consiglio/i.test(q);
  const broadTopic = /soldi|business|lavoro|carriera|forma|dimagrire|palestra|relazione|fidanzata|ex|disciplina|motivazione|smettere/i.test(q);
  const concreteSignals = /perché|quando|ieri|domani|stasera|settimana|lei|lui|nome|ho provato|succede che|il problema è|mi blocco|mi sento|da quanto/i.test(q);
  return genericIntent && broadTopic && !concreteSignals && q.length < 140;
}

function contextRequestFor(query: string): string {
  if (isGenericDatingQuestion(query)) {
    return `Prima di darti strategie devo capire meglio la situazione, altrimenti ti darei consigli generici.

Dimmi tre cose: vuoi conoscere ragazze dal vivo o online? Il tuo blocco principale è approcciare, mantenere la conversazione, creare attrazione o gestire il rifiuto? E che tipo di persona vuoi attrarre?`;
  }
  return `Prima di consigliarti ho bisogno di un po' più di contesto, altrimenti rischio di darti una risposta generica.

Raccontami cosa sta succedendo concretamente: chi è coinvolto, cosa hai già provato e qual è il punto che ti blocca di più.`;
}

function fallbackAnswerFor(query: string): string {
  const q = query.toLowerCase();
  if (/riattrar|riconquistar|mollat|lasciat|ex|chimica/i.test(q)) {
    return `Ti rispondo subito in modo pratico: non provare a “riattrarla” inseguendola, spiegandoti troppo o cercando di convincerla. Dopo una rottura così, quello abbassa ancora di più la tua posizione.

La prima cosa da fare è fermare la rincorsa: niente messaggi lunghi, niente suppliche, niente richiesta continua di chiarimenti. Se vuoi avere una possibilità reale, devi tornare centrato.

Mandale al massimo un messaggio breve e adulto, tipo: “Ho capito quello che mi hai detto. Non ti inseguo né ti forzo. Mi prendo spazio anch’io per metabolizzare.” Poi sparisci per un po’.

Nel frattempo lavora su tre cose: lucidità, dignità e attrattività reale. Allenati, dormi, non controllarla, non mendicare segnali. Se lei torna, deve percepire che non sei lì ad aspettare briciole. Se non torna, almeno non ti sei distrutto per qualcuno che ti ha lasciato dopo averti fatto fare 1000 km.`;
  }
  return `Ti rispondo senza tecnicismi: ho avuto un problema a recuperare la risposta completa, ma non voglio lasciarti con un errore vuoto.

Per aiutarti bene mi serve una cosa concreta: dimmi cosa è successo, cosa vuoi ottenere e qual è il punto che ti sta bloccando di più. Da lì ti do una linea d'azione pratica, non generica.`;
}

function cleanMarkdown(text: string): string {
  return text
    // Safety net lato client: strippa source ID tipo [autore-titolo-2020]
    .replace(/\s*\[[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}\]\s*/gi, " ")
    .replace(/\s*\[[a-z]+(?:-[a-z]+){1,4}\]\s*/gi, " ")
    // Markdown residuo
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function SourcesChip({ sources }: { sources: SourceHit[] }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5"
      >
        <BookOpen className="w-3 h-3" />
        {sources.length} {sources.length === 1 ? "fonte" : "fonti"}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-400">
          {sources.map((s, i) => (
            <li key={i} className="leading-snug">
              <span className="text-zinc-300">{s.source.authors}</span>
              <span className="text-zinc-500"> · {s.source.year}</span>
              <span className="text-zinc-400"> · {s.source.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChatTab({ sid }: { sid: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [load, setLoad] = useState(false);
  const [preds, setPreds] = useState<string[]>([]);
  const [awaitingNarrative, setAwaitingNarrative] = useState(false);
  const [narrativeAttempts, setNarrativeAttempts] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch(`/api/predict?sessionId=${sid}`).then(r => r.json()).then(d => setPreds(d.predictions ?? [])); }, [sid]);
  useEffect(() => { bottomRef.current?.scrollTo({ top: bottomRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  // Carica profilo e messaggi da localStorage all'avvio
  useEffect(() => {
    let cancelled = false;
    async function initMessages() {
      const localChoice = typeof window !== "undefined" && localStorage.getItem("atlas-storage-mode") === "local";
      setIsLocalMode(localChoice);
      const user = await getCurrentUser();
      let cid: string | undefined;
      if (user && !localChoice) {
        const existing = localStorage.getItem("atlas-current-conversation-id");
        cid = existing || undefined;
        if (!cid) {
          const convo = await createConversation("Nuova conversazione");
          cid = convo?.id;
          if (cid) localStorage.setItem("atlas-current-conversation-id", cid);
        }
        setConversationId(cid);
      }

      const saved = await loadMessages(sid, cid);
      if (cancelled) return;
      if (saved.length > 0) {
        setMsgs(saved as Msg[]);
        setAwaitingNarrative(false);
      } else {
        setAwaitingNarrative(true);
        setMsgs([{
          role: "assistant",
          content: `Ciao, sono Atlas. Sono qui per aiutarti a capire e agire su quello che ti pesa.\n\nRaccontami cosa ti sta succedendo: una situazione, una domanda, un problema concreto. Anche poche parole bastano per partire.`,
          timestamp: Date.now(),
        }]);
      }
    }
    initMessages();
    // Carica profilo
    fetch(`/api/profile?sessionId=${sid}`).then(r => r.json()).then(d => {
      if (d.profile) setProfile(d.profile);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sid]);

  async function send(q?: string) {
    const query = (q ?? input).trim(); if (!query || load) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: query, timestamp: Date.now() };
    setMsgs(m => [...m, userMsg]);
    await saveMessage(sid, userMsg, conversationId);
    setLoad(true);

    if (needsMoreContext(query)) {
      const askMsg: Msg = { role: "assistant", content: contextRequestFor(query), timestamp: Date.now() };
      setMsgs(m => [...m, askMsg]);
      await saveMessage(sid, askMsg, conversationId);
      setPreds(isGenericDatingQuestion(query) ? [
        "Voglio conoscere ragazze dal vivo ma mi blocco ad approcciare",
        "Uso Instagram/Tinder ma le conversazioni muoiono subito",
        "Ho paura del rifiuto e non so come comportarmi",
      ] : []);
      setLoad(false);
      return;
    }

    // Onboarding: richiede contesto reale, non accetta domande vaghe
    if (awaitingNarrative) {
      setNarrativeAttempts(prev => prev + 1);
      const isSubstantial = !needsMoreContext(query) && (
        query.length > 80 ||
        /perché|quando|ieri|domani|stasera|settimana|lei|lui|partner|ex|lavoro|capo|collega|alcol|droga|fumo|ansia|panico|palestra|peso|studio/i.test(query)
      );

      if (isSubstantial) {
        setAwaitingNarrative(false);
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, action: "update", data: { onboardingComplete: true } }),
        });
      } else {
        const askMsg: Msg = { role: "assistant", content: needsMoreContext(query) ? contextRequestFor(query) : `Raccontami un po' di più — anche due frasi bastano. Che situazione concreta vuoi risolvere?`, timestamp: Date.now() };
        setMsgs(m => [...m, askMsg]);
        await saveMessage(sid, askMsg, conversationId);
        setLoad(false);
        return;
      }
    }

    // Conversazione normale
    try {
      const history = await getLastMessages(sid, 6, conversationId);
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, sessionId: sid, conversationHistory: history }),
      });
      if (!r.ok) throw new Error("chat_request_failed");
      const d = await r.json();
      const assistantMsg: Msg = { role: "assistant", content: d.answer, timestamp: Date.now(), sources: d.sources, cached: d.cached, usedLLM: d.usedLLM };
      setMsgs(m => [...m, assistantMsg]);
      await saveMessage(sid, assistantMsg, conversationId);

      // Smart profile probing: ogni 3 turni, se profilo incompleto, aggiungi
      // una mini-domanda profilante alle predizioni (chip cliccabile, mai bloccante)
      let predictions: string[] = d.predictions ?? [];
      const turnCount = msgs.filter((x) => x.role === "user").length + 1;
      if (turnCount % 3 === 0) {
        try {
          const gapsRes = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sid, action: "gaps", data: { query } }),
          });
          const gapsData = await gapsRes.json();
          const topGap = gapsData?.gaps?.[0];
          if (topGap?.question) {
            predictions = [`💭 ${topGap.question}`, ...predictions].slice(0, 5);
            // Marca lo slot come probato per non riproporre subito
            fetch("/api/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: sid, action: "markProbed", data: { slot: topGap.slot } }),
            }).catch(() => {});
          }
        } catch {}
      }
      setPreds(predictions);
    } catch (e: unknown) {
      const errorMsg: Msg = { role: "assistant", content: fallbackAnswerFor(query), timestamp: Date.now() };
      setMsgs(m => [...m, errorMsg]);
      await saveMessage(sid, errorMsg, conversationId);
    } finally {
      setLoad(false);
    }
  }

  return (
    <>
      <div ref={bottomRef} className="flex-1 overflow-y-auto space-y-4 pb-32 min-h-[60vh]">
        {isLocalMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-3 text-xs text-amber-200">
            Modalità locale attiva: questa chat resta solo su questo dispositivo. Accedi o disattiva “salva in locale” per sincronizzare telefono e PC.
          </div>
        )}
        {msgs.length === 0 && <div className="text-center py-16 text-zinc-500"><Sparkles className="w-10 h-10 mx-auto mb-4 text-indigo-400"/><p className="mb-2 text-zinc-300 font-medium">Fai una domanda per iniziare</p><p className="text-xs">Atlas apprende il tuo focus e predice le prossime domande</p></div>}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 ${
              m.role === "user"
                ? "bg-indigo-600/20 border border-indigo-500/30 ml-8"
                : "bg-zinc-900/80 border border-zinc-800 mr-8"
            }`}
          >
            {m.role === "assistant" && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                <Brain className="w-3.5 h-3.5" />
                <span>Atlas</span>
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {cleanMarkdown(m.content)}
            </div>
            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <SourcesChip sources={m.sources} />
            )}
          </div>
        ))}
        {load && <div className="rounded-xl p-4 bg-zinc-900/80 border border-zinc-800 mr-8"><div className="flex items-center gap-2 text-zinc-400 text-sm"><div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /><span>Atlas sta cercando e ragionando…</span></div></div>}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4 px-4">
        <div className="max-w-4xl mx-auto">
          {preds.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{preds.map((p, i) => <button key={i} onClick={() => send(p)} className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"><Sparkles className="w-3 h-3 inline mr-1 text-indigo-400" />{p}</button>)}</div>}
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Chiedi qualcosa ad Atlas…" className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500" />
            <button type="submit" disabled={load || !input.trim()} className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-medium text-sm flex items-center gap-2"><Send className="w-4 h-4" />Invia</button>
          </form>
        </div>
      </div>
    </>
  );
}
