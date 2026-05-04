"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Brain, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { saveMessage, loadMessages, getLastMessages } from "../lib/conversation-memory";

type SourceHit = {
  source: { id: string; authors: string; year: number; title: string; venue?: string; library?: string };
  score: number;
};
type Msg = { role: "user" | "assistant"; content: string; timestamp: number; sources?: SourceHit[]; cached?: boolean; usedLLM?: boolean };

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch(`/api/predict?sessionId=${sid}`).then(r => r.json()).then(d => setPreds(d.predictions ?? [])); }, [sid]);
  useEffect(() => { bottomRef.current?.scrollTo({ top: bottomRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  // Carica profilo e messaggi da localStorage all'avvio
  useEffect(() => {
    // Carica messaggi persistiti
    const saved = loadMessages(sid);
    if (saved.length > 0) {
      setMsgs(saved);
      setAwaitingNarrative(false);
    } else {
      // Primo avvio: onboarding aperto
      setAwaitingNarrative(true);
      setMsgs([{
        role: "assistant",
        content: `Ciao, sono Atlas. Sono qui per aiutarti a capire e agire su quello che ti pesa.\n\nRaccontami cosa ti sta succedendo: una situazione, una domanda, un problema concreto. Anche poche parole bastano per partire.`,
        timestamp: Date.now(),
      }]);
    }
    // Carica profilo
    fetch(`/api/profile?sessionId=${sid}`).then(r => r.json()).then(d => {
      if (d.profile) setProfile(d.profile);
    }).catch(() => {});
  }, [sid]);

  async function send(q?: string) {
    const query = (q ?? input).trim(); if (!query || load) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: query, timestamp: Date.now() };
    setMsgs(m => [...m, userMsg]);
    saveMessage(sid, userMsg);
    setLoad(true);

    // Onboarding: accetta qualsiasi input utile
    if (awaitingNarrative) {
      setNarrativeAttempts(prev => prev + 1);
      const isSubstantial = query.length > 15 || /alcol|droga|fumo|dipend|relazione|lavor|sold|fitness|palestra|studio|motivazione/i.test(query);

      if (isSubstantial || narrativeAttempts >= 1) {
        setAwaitingNarrative(false);
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, profile: { onboardingComplete: true } }),
        });
        const confirmMsg: Msg = { role: "assistant", content: `Capito. Ho abbastanza per partire. Di cosa hai bisogno oggi?`, timestamp: Date.now() };
        setMsgs(m => [...m, confirmMsg]);
        saveMessage(sid, confirmMsg);
        setLoad(false);
        return;
      } else {
        const askMsg: Msg = { role: "assistant", content: `Raccontami un po' di più — anche due frasi bastano. Di cosa si tratta?`, timestamp: Date.now() };
        setMsgs(m => [...m, askMsg]);
        saveMessage(sid, askMsg);
        setLoad(false);
        return;
      }
    }

    // Conversazione normale
    try {
      const history = getLastMessages(sid, 6);
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, sessionId: sid, conversationHistory: history }),
      });
      const d = await r.json();
      const assistantMsg: Msg = { role: "assistant", content: d.answer, timestamp: Date.now(), sources: d.sources, cached: d.cached, usedLLM: d.usedLLM };
      setMsgs(m => [...m, assistantMsg]);
      saveMessage(sid, assistantMsg);

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
      const err = e instanceof Error ? e.message : String(e);
      const errorMsg: Msg = { role: "assistant", content: `Errore: ${err}`, timestamp: Date.now() };
      setMsgs(m => [...m, errorMsg]);
      saveMessage(sid, errorMsg);
    } finally {
      setLoad(false);
    }
  }

  return (
    <>
      <div ref={bottomRef} className="flex-1 overflow-y-auto space-y-4 pb-32 min-h-[60vh]">
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
