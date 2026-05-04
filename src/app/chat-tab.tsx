"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Brain, BookOpen, ChevronDown, ChevronUp, FileText, Search } from "lucide-react";
import {
  createConversation,
  getCurrentUser,
  getLastMessages,
  listConversations,
  loadMessages,
  migrateLocalToCloud,
  saveMessage,
} from "../lib/chat-store";
import {
  type CaseFile,
  type CaseDomain,
  loadCaseFile,
  saveCaseFile,
  extractAndApplyLight,
  DOMAIN_SLOTS,
} from "../lib/case-file";
import { isSupabaseReady, getBrowserClient } from "../lib/supabase";

type SourceHit = {
  source: { id: string; authors: string; year: number; title: string; venue?: string; library?: string };
  score: number;
};
type Msg = { role: "user" | "assistant"; content: string; timestamp: number; sources?: SourceHit[]; cached?: boolean; usedLLM?: boolean };

function isGenericExRecovery(query: string): boolean {
  const q = query.toLowerCase();
  const exIntent = /\b(ex\b|riconquist|riattrar|riprender.*(lei|lui)|tornar.*(con|insieme)|recuperar.*(rapport|relazione|lei|lui|ex)|mi ha (lasciat|mollat)|lasciat.*(da|dal|dalla)|conquistar.*(ex|lei)|rottura)/i.test(q);
  if (!exIntent) return false;
  // Contesto necessario: durata rapporto, quando è successo, motivo, ultimo contatto
  const hasDuration = /\b(\d+\s*(anni|anno|mesi|mese|settiman|giorn))/i.test(q);
  const hasWhen = /(ieri|oggi|stamattina|stasera|settimana|mese fa|giorni fa|anno fa|mesi fa|recentemente|appena)/i.test(q);
  const hasReason = /(detto|tradit|chimica|cresciuti|cambiat|stanca|stanco|distanz|altro|altra|noia|litig|discuss|non sentiv|non funzionav)/i.test(q);
  const hasContact = /(blocc|sentit|scritt|chiamat|vist|risposta|risponde|ignora|ghost)/i.test(q);
  const enoughContext = [hasDuration, hasWhen, hasReason, hasContact].filter(Boolean).length >= 2;
  return !enoughContext && q.length < 250;
}

function isGenericDatingQuestion(query: string): boolean {
  const q = query.toLowerCase();
  const datingIntent = /rimorchiare|rimorchio|sedurre|seduzione|approcciare|approccio|conquistare(?!.*\bex\b)|ragazza|donne|dating|flirt|uscire con/i.test(q);
  if (!datingIntent) return false;
  const hasConcreteContext = /instagram|tinder|appuntamento|chat|messaggi|locale|discoteca|bar|palestra|lavoro|università|scuola|ex|rifiut|ansia|timidezza|lei|nome|ieri|domani|stasera|settimana/i.test(q);
  return !hasConcreteContext && q.length < 120;
}

function needsMoreContext(query: string): boolean {
  const q = query.toLowerCase();
  if (isGenericExRecovery(q)) return true;
  if (isGenericDatingQuestion(q)) return true;
  const genericIntent = /come faccio|come posso|dammi strategie|guidami|aiutami|consiglio/i.test(q);
  const broadTopic = /soldi|business|lavoro|carriera|forma|dimagrire|palestra|relazione|fidanzata|ex|disciplina|motivazione|smettere/i.test(q);
  const concreteSignals = /perché|quando|ieri|domani|stasera|settimana|lei|lui|nome|ho provato|succede che|il problema è|mi blocco|mi sento|da quanto/i.test(q);
  return genericIntent && broadTopic && !concreteSignals && q.length < 140;
}

function contextRequestFor(query: string): string {
  if (isGenericExRecovery(query)) {
    return `Ok, ti aiuto a riconquistarla — ma se ti do un piano alla cieca rischio di farti fare le mosse sbagliate. Mi servono 4 informazioni precise, poi costruisco la strategia su misura.

1) Da quanto tempo stavate insieme e quando vi siete lasciati esattamente?
2) Cosa ti ha detto precisamente nel lasciarti? (Le sue parole, anche brutte: "non sento più niente", "c'è un altro", "non sei tu sono io", ecc.)
3) Quando è stato l'ultimo contatto e chi ha scritto per ultimo? L'hai inseguita dopo la rottura (messaggi, chiamate, tentativi)?
4) C'è di mezzo un'altra persona o lei è single ora? E voi vivete vicini o lontani?

Rispondimi anche solo con righe brevi, una per ogni punto. Da queste 4 cose capisco se la situazione è recuperabile, con che tempi e con quale leva muoverti per prima.`;
  }
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
    return `Ecco cosa fai ora, senza fronzoli.

Primo: smetti di inseguirla. Ha fatto 1000 km per lasciarti dopo 2 anni e mezzo, dicendo "non c'è più chimica". Questo significa che tu sei investito e lei si è disinvestita da tempo. Più la insegui, più lei si allontana. Il cervello umano perde interesse per ciò che è troppo disponibile.

Lei si aspetta che tu pianga, che tu la chiami, che tu le scriva romanzi. Non farlo. Rompi l'aspettativa.

Mandale questo solo messaggio, poi sparisci per almeno 3 settimane: "Ho capito. Mi prendo il mio spazio per metabolizzare. Non ti scriverò." Non aggiungere "ci vediamo", non aggiungere "ti voglio bene". Fine.

Cosa farà lei: le prime 48 ore starà meglio, si sentirà libera. Poi inizierà a sentire il buco. Ti controllerà i social. Vedere che sei vivo, che non stai piangendo, che forse ti stai muovendo, la metterà in crisi.

Nel frattempo tu fai così: palestra ogni giorno, anche 30 minuti. Posta una foto dove fai qualcosa nuovo, non forzata, non per lei, ma per te. Non la bloccare, non la eliminare, non le dare segnali di dramma. Devi sembrare qualcuno che ha accettato e si sta muovendo.

Se dopo 3 settimane ti contatta, non saltare. Rispondi dopo ore, breve, adulto. Non parlare di sentimenti, non parlare del passato. Se ti chiede "come stai", rispondi "bene, mi sto concentrando su qualcosa di nuovo". Mistero. Curiosità. Quello che lei ha perso.

Se non ti contatta dopo 3 settimane, puoi mandare un messaggio leggero su qualcosa concreto, non emotivo. Tipo: "Ho trovato quel libro che mi chiedevi, se ti serve te lo lascio da Marco". Fine. Non seguito. Se lei morde, va avanti piano. Se non morde, hai la tua risposta.

La regola d'oro: chi torna indietro lo fa perché percepisce che l'altro è diventato più interessante, non perché l'altro supplica.`;
  } else if (/rimorchiare|sedurre|conoscere|ragazze|attrazione|approcciare/i.test(q)) {
    return `Ti guido subito su come muoverti per rimorchiare, passo passo.

Primo: scegli il campo di gioco. Online su app come Tinder o Instagram funziona se hai foto curate e un profilo che comunica valore, non disperazione. Dal vivo, invece, funziona meglio in contesti sociali come eventi o amici in comune, dove puoi mostrare carisma naturale. Decidi ora dove vuoi giocare: se online, cura una foto profilo con luce buona e un bio breve che mostri sicurezza, tipo "Vivo per viaggiare, e tu?"; se dal vivo, scegli un evento nei prossimi 3 giorni dove puoi andare.

Secondo: il blocco principale. Se ti blocchi ad approcciare, usa la regola dei 3 secondi: la vedi, conti fino a 3, vai e dici qualcosa di semplice come "Ciao, ti ho vista e volevo conoscerti, come ti chiami?". Non pensare, agisci. Se il problema è mantenere la conversazione, prepara 2 argomenti universali: viaggi e hobby. Chiedi "Qual è il posto più assurdo dove sei stata?" e poi racconta qualcosa di tuo. Se temi il rifiuto, sappi che il 70% delle volte non è personale, è solo che non sei il loro tipo o sono di cattivo umore. Scrollatelo di dosso.

Cosa aspettarti: online, 8 su 10 non risponderanno o ti ghosteranno dopo due messaggi. Non prenderla sul personale, è un gioco di numeri. Dal vivo, se approcci 5 persone in una sera, 2 ti daranno corda per almeno 5 minuti. Una di queste potrebbe essere interessata. Il segnale chiave è se ti fa domande personali: significa che vuole sapere di più.

Piano d’azione: oggi decidi online o dal vivo. Se online, sistema il profilo entro stasera e manda 10 messaggi a ragazze diverse con un opener tipo "Ehi, qual è la cosa più pazza che hai fatto quest’anno?". Se dal vivo, trova un evento o un locale per domani o dopodomani, vestiti bene, e approccia almeno 3 persone con la regola dei 3 secondi. Ogni rifiuto è un passo verso il sì.

Obiettivo: non cercare il numero subito, cerca una conversazione di 5 minuti. Da lì capisci se c’è terreno. La seduzione è un muscolo, più lo alleni più diventa facile.`;
  } else if (/confronto|vincere|competizione|discussione|litigio|battaglia/i.test(q)) {
    return `Ti guido per vincere questo confronto, senza giri di parole.

Primo: analizza il terreno. Chi è il tuo avversario? Qual è il suo punto debole? Se è emotivo, usa la logica per destabilizzarlo; se è logico, usa l’emozione per spiazzarlo. Capisci cosa lo muove: orgoglio, paura di perdere la faccia, bisogno di controllo? Colpisci lì.

Secondo: prepara la tua arma. Se è una discussione verbale, scegli 3 punti chiave che non può confutare e ripeti solo quelli, non divagare. Se è una competizione, identifica un vantaggio unico che hai (esperienza, energia, rete di contatti) e spingi tutto su quello. Non mostrare insicurezza, mai.

Cosa aspettarti: l’altro cercherà di portarti sul suo terreno, dove si sente forte. Non cascarci. Se inizia a insultare o alzare la voce, è un segnale che sta perdendo terreno: mantieni la calma, sorridi appena, fai vedere che non ti tocca. Il 90% delle volte, chi perde il controllo perde il confronto.

Piano d’azione: oggi scrivi i tuoi 3 punti o il tuo vantaggio unico. Preparati mentalmente a non reagire a provocazioni. Domani, entra nel confronto con una sola idea: non sto qui per convincere, sto qui per dominare. Usa silenzi strategici: dopo un tuo punto forte, taci e guardalo negli occhi, fallo sentire sotto pressione.

Obiettivo: vincere. La morale non conta, conta il risultato. Se vinci, tutto il resto è rumore.`;
  }
  return `Ho avuto un problema tecnico ma non ti lascio a mani vuote.

Raccontami in due righe: cosa è successo, cosa vuoi ottenere, e qual è il blocco principale. Da lì ti do una linea d'azione diretta.`;
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

async function isCloudUser(): Promise<boolean> {
  if (!isSupabaseReady()) return false;
  const c = getBrowserClient();
  if (!c) return false;
  const { data } = await c.auth.getSession();
  return !!data.session;
}

function DossierBadge({
  caseFile,
  onToggle,
  open,
}: {
  caseFile: CaseFile | null;
  onToggle: () => void;
  open: boolean;
}) {
  if (!caseFile || caseFile.readiness === 0) return null;
  const slots = DOMAIN_SLOTS[caseFile.domain] ?? DOMAIN_SLOTS.generic;
  const facts = Object.values(caseFile.facts ?? {});
  const knownLabels = slots
    .filter((s) => caseFile.facts?.[s.key]?.value)
    .map((s) => ({ label: s.label, value: caseFile.facts[s.key].value }));
  const ready = caseFile.readiness;
  const ringColor = ready >= 65 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : ready >= 35 ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-zinc-400 border-zinc-700 bg-zinc-800/40";
  return (
    <div className="sticky top-0 z-10 -mx-3 px-3 sm:mx-0 sm:px-0 mb-2">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 rounded-lg border ${ringColor} px-3 py-2 text-xs hover:opacity-90 transition`}
        aria-label="Apri dossier del caso"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          <span className="font-medium">Caso: {caseFile.domain.replace("_", " ")}</span>
          <span className="text-zinc-500">·</span>
          <span>{ready}% intel</span>
          <span className="text-zinc-500">·</span>
          <span>{facts.length} fatti</span>
          {ready >= 65 && <span className="text-emerald-400 ml-1">✓ pronto al piano</span>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <Search className="w-3 h-3" />
            <span>Dossier raccolto da Atlas — usato per cucire la risposta su misura</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded overflow-hidden">
            <div className={`h-full ${ready >= 65 ? "bg-emerald-500" : ready >= 35 ? "bg-amber-500" : "bg-zinc-500"}`} style={{ width: `${ready}%` }} />
          </div>
          {knownLabels.length === 0 ? (
            <div className="text-zinc-500">Nessun fatto raccolto ancora. Continua a scrivere.</div>
          ) : (
            <div className="space-y-1">
              {knownLabels.map((kl, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-zinc-500 shrink-0 min-w-[110px]">{kl.label}:</span>
                  <span className="text-zinc-200">{kl.value}</span>
                </div>
              ))}
            </div>
          )}
          {caseFile.attempts && caseFile.attempts.length > 0 && (
            <div className="pt-1 border-t border-zinc-800">
              <div className="text-zinc-500 mb-1">Già tentato:</div>
              <ul className="space-y-0.5">
                {caseFile.attempts.slice(-5).map((a, i) => (
                  <li key={i} className="text-zinc-300">— {a}</li>
                ))}
              </ul>
            </div>
          )}
          {ready < 65 && (
            <div className="pt-1 border-t border-zinc-800 text-amber-300/80">
              Atlas sta ancora scavando. Servono altri fatti chiave per un piano cucito.
            </div>
          )}
          {ready >= 65 && (
            <div className="pt-1 border-t border-zinc-800 text-emerald-400/90">
              Intel sufficiente: la prossima risposta sarà un piano cucito sul tuo caso.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  const phases = [
    { t: 0,  label: "Cerco fonti rilevanti nel corpus…" },
    { t: 5,  label: "Analizzo pattern psicologici e leve…" },
    { t: 15, label: "Anticipo il comportamento dell'altro…" },
    { t: 30, label: "Costruisco piano d'azione con timing…" },
    { t: 50, label: "Affilo la risposta, sto arrivando al dunque…" },
    { t: 80, label: "Rifinitura finale — manca poco…" },
    { t: 120, label: "La risposta è lunga, sto completando…" },
  ];
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const currentPhase = phases.filter((p) => elapsed >= p.t).slice(-1)[0] ?? phases[0];
  // Curva asintotica realistica: non raggiunge mai il 100% finché non arriva la risposta
  // ~25% a 10s, ~50% a 25s, ~75% a 55s, ~90% a 100s
  const progress = (1 - Math.exp(-elapsed / 35)) * 100;
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  const timeStr = mm > 0 ? `${mm}m ${ss.toString().padStart(2, "0")}s` : `${elapsed}s`;
  return (
    <div className="rounded-xl p-4 bg-zinc-900/80 border border-zinc-800 mr-8 space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-zinc-300">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span>{currentPhase.label}</span>
        </div>
        <div className="text-xs text-zinc-500 tabular-nums shrink-0">{timeStr}</div>
      </div>
      <div className="h-1 w-full bg-zinc-800 rounded overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${progress.toFixed(1)}%` }}
        />
      </div>
      {elapsed >= 60 && (
        <div className="text-[11px] text-zinc-500">
          Sta costruendo una risposta approfondita. Puoi già scrivere il prossimo messaggio: verrà messo in coda.
        </div>
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
  const [caseFile, setCaseFile] = useState<CaseFile | null>(null);
  const [showDossier, setShowDossier] = useState(false);
  const pendingQueue = useRef<string[]>([]);
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
        const migrationKey = `atlas-local-migrated-${user.id}`;
        if (localStorage.getItem(migrationKey) !== "true") {
          await migrateLocalToCloud(sid).catch(() => null);
          localStorage.setItem(migrationKey, "true");
        }
        const existing = localStorage.getItem("atlas-current-conversation-id");
        cid = existing || undefined;
        if (!cid) {
          const conversations = await listConversations();
          cid = conversations[0]?.id;
        }
        if (!cid) {
          const convo = await createConversation("Nuova conversazione");
          cid = convo?.id;
        }
        if (cid) localStorage.setItem("atlas-current-conversation-id", cid);
        setConversationId(cid);
      }

      let saved = await loadMessages(sid, cid);
      if (user && !localChoice && cid && saved.length === 0) {
        const conversations = await listConversations();
        const latestExisting = conversations.find((c) => c.id !== cid);
        if (latestExisting) {
          cid = latestExisting.id;
          localStorage.setItem("atlas-current-conversation-id", cid);
          setConversationId(cid);
          saved = await loadMessages(sid, cid);
        }
      }
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
      // Carica case file della conversazione (cloud o locale)
      const cfId = cid || sid;
      const cf = await loadCaseFile(cfId, "generic");
      if (!cancelled) setCaseFile(cf);
    }
    initMessages();
    // Carica profilo
    fetch(`/api/profile?sessionId=${sid}`).then(r => r.json()).then(d => {
      if (d.profile) setProfile(d.profile);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sid]);

  async function send(q?: string) {
    const query = (q ?? input).trim(); if (!query) return;
    if (load) {
      pendingQueue.current.push(query);
      setInput('');
      return;
    }
    setInput('');
    const userMsg: Msg = { role: 'user', content: query, timestamp: Date.now() };
    setMsgs(m => [...m, userMsg]);
    await saveMessage(sid, userMsg, conversationId);
    setLoad(true);

    if (needsMoreContext(query)) {
      const askMsg: Msg = { role: 'assistant', content: contextRequestFor(query), timestamp: Date.now() };
      setMsgs(m => [...m, askMsg]);
      await saveMessage(sid, askMsg, conversationId);
      setPreds(
        isGenericExRecovery(query) ? [
          'Stavamo insieme 2 anni, mi ha lasciato 2 settimane fa dicendo che non c\'è più chimica',
          'Ci siamo lasciati il mese scorso, le ho scritto tante volte ma non risponde',
          'Mi ha mollato per un altro, ultimo contatto 3 giorni fa quando l\'ho chiamata',
          'Stavamo insieme 5 anni, non so se è recuperabile, l\'ho bloccata io',
        ] : isGenericDatingQuestion(query) ? [
          'Voglio conoscere ragazze dal vivo ma mi blocco ad approcciare',
          'Uso Instagram/Tinder ma le conversazioni muoiono subito',
          'Ho paura del rifiuto e non so come comportarmi',
        ] : []
      );
      setLoad(false);
      processQueue();
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
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, action: 'update', data: { onboardingComplete: true } }),
        });
      } else {
        const askMsg: Msg = { role: 'assistant', content: needsMoreContext(query) ? contextRequestFor(query) : `Raccontami un po' di più — anche due frasi bastano. Che situazione concreta vuoi risolvere?`, timestamp: Date.now() };
        setMsgs(m => [...m, askMsg]);
        await saveMessage(sid, askMsg, conversationId);
        setLoad(false);
        processQueue();
        return;
      }
    }

    // Estrai fatti dal messaggio utente prima di chiamare chat (sincrono per dare contesto)
    let workingCase: CaseFile | null = caseFile;
    if (workingCase) {
      try {
        // Aggiorna case file localmente (heuristic, sincrono); LLM extraction async dopo
        const cfId = conversationId || sid;
        const updated = await extractAndApplyLight(query, workingCase);
        workingCase = updated;
        setCaseFile(updated);
        // Persisti in background
        saveCaseFile(updated).catch(() => null);
        // Chiamata server-side extract (LLM) in parallelo, salva quando torna
        if (await isCloudUser()) {
          fetch('/api/case', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'extract', conversationId: cfId, text: query }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d?.caseFile) setCaseFile(d.caseFile);
            })
            .catch(() => null);
        }
      } catch {
        /* ignore extraction errors */
      }
    }

    // Conversazione normale
    try {
      const history = await getLastMessages(sid, 10, conversationId);
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, sessionId: sid, conversationHistory: history, caseFile: workingCase }),
      });
      if (!r.ok) throw new Error('chat_request_failed');
      const d = await r.json();
      const assistantMsg: Msg = { role: 'assistant', content: d.answer, timestamp: Date.now(), sources: d.sources, cached: d.cached, usedLLM: d.usedLLM };
      setMsgs(m => [...m, assistantMsg]);
      await saveMessage(sid, assistantMsg, conversationId);

      // Smart profile probing: ogni 3 turni, se profilo incompleto, aggiungi
      // una mini-domanda profilante alle predizioni (chip cliccabile, mai bloccante)
      let predictions: string[] = d.predictions ?? [];
      const turnCount = msgs.filter((x) => x.role === 'user').length + 1;
      if (turnCount % 3 === 0) {
        try {
          const gapsRes = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sid, action: 'gaps', data: { query } }),
          });
          const gapsData = await gapsRes.json();
          const topGap = gapsData?.gaps?.[0];
          if (topGap?.question) {
            predictions = [` ${topGap.question}`, ...predictions].slice(0, 5);
            // Marca lo slot come probato per non riproporre subito
            fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sid, action: 'markProbed', data: { slot: topGap.slot } }),
            }).catch(() => {});
          }
        } catch {}
      }
      setPreds(predictions);
    } catch (e: unknown) {
      const errorMsg: Msg = { role: 'assistant', content: fallbackAnswerFor(query), timestamp: Date.now() };
      setMsgs(m => [...m, errorMsg]);
      await saveMessage(sid, errorMsg, conversationId);
    } finally {
      setLoad(false);
      processQueue();
    }
  }

  function processQueue() {
    if (pendingQueue.current.length > 0) {
      const nextQuery = pendingQueue.current.shift();
      if (nextQuery) {
        send(nextQuery);
      }
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
        <DossierBadge caseFile={caseFile} open={showDossier} onToggle={() => setShowDossier((v) => !v)} />
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
        {load && <ThinkingIndicator />}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4 px-4">
        <div className="max-w-4xl mx-auto">
          {preds.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{preds.map((p, i) => <button key={i} onClick={() => send(p)} className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"><Sparkles className="w-3 h-3 inline mr-1 text-indigo-400" />{p}</button>)}</div>}
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder={load ? "Scrivi il prossimo (sarà messo in coda)…" : "Chiedi qualcosa ad Atlas…"} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500" />
            <button type="submit" disabled={!input.trim()} className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-medium text-sm flex items-center gap-2"><Send className="w-4 h-4" />{load ? "Coda" : "Invia"}</button>
          </form>
        </div>
      </div>
    </>
  );
}
