"use client";
import { useState, useEffect } from "react";
import { Brain, BookOpen, PenTool, ClipboardList, ListChecks, UserCircle, ArrowRight } from "lucide-react";
import { CORPUS } from "../lib/corpus";
import ChatTab from "./chat-tab";
import JournalTab from "./journal-tab";
import AssessmentTab from "./assessment-tab";
import ProtocolTab from "./protocol-tab";
import AuthHeader from "./auth-header";
import WelcomeModal from "./welcome-modal";
import ProfileModal from "./profile-modal";
import CloudFirstGate from "./cloud-first-gate";
import ImportTab from "./import-tab";

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function Page() {
  const [sid] = useState(() => { if (typeof window === "undefined") return "ssr"; const k="atlas-sid"; let s=localStorage.getItem(k); if(!s){s=uid(); localStorage.setItem(k,s);} return s; });
  const [tab, setTab] = useState<"chat"|"journal"|"assessment"|"protocol"|"import">("chat");
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (sid === "ssr") return;
    fetch(`/api/profile?sessionId=${sid}`).then(r => r.json()).then(d => {
      const p = d.profile;
      setProfileComplete(!!(p?.goals && p?.lifeThemes?.length > 0));
    }).catch(() => setProfileComplete(false));
  }, [sid]);

  const tabs = [
    { id: "chat" as const, label: "Chat", icon: Brain },
    { id: "journal" as const, label: "Journal", icon: PenTool },
    { id: "assessment" as const, label: "Test", icon: ClipboardList },
    { id: "protocol" as const, label: "Piano", icon: ListChecks },
    { id: "import" as const, label: "Importa", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <WelcomeModal />
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 border-b border-zinc-800 pb-3 sm:pb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold">Atlas</h1>
            <p className="text-[11px] sm:text-xs text-zinc-400 truncate">Chat · Journal · Test · Piano</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500">
            <BookOpen className="w-3.5 h-3.5" />
            {CORPUS.length} fonti
          </div>
          <AuthHeader />
        </div>
      </header>
      {profileComplete === false && (
        <div className="mb-3 sm:mb-4 rounded-xl bg-indigo-900/20 border border-indigo-500/30 p-3 sm:p-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80"
          >
            <UserCircle className="w-5 h-5 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-indigo-200">Completa il tuo profilo</p>
              <p className="text-[11px] text-indigo-300/70">Risposte molto più mirate — bastano 2 minuti</p>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400/70 ml-auto shrink-0" />
          </button>
          <button
            onClick={() => setProfileComplete(true)}
            className="shrink-0 text-[11px] text-zinc-500 hover:text-zinc-300 px-2"
          >
            Salta
          </button>
        </div>
      )}
      {profileOpen && (
        <ProfileModal
          sid={sid}
          onClose={() => setProfileOpen(false)}
          onComplete={() => setProfileComplete(true)}
        />
      )}
      <CloudFirstGate>
        <nav className="flex gap-1 mb-3 sm:mb-4 border-b border-zinc-800 pb-1 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} className={`shrink-0 px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-t-lg flex items-center gap-1.5 sm:gap-2 transition-colors ${tab===t.id?"bg-zinc-800 text-white":"text-zinc-500 hover:text-zinc-300"}`}>
              <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </nav>
        {tab==="chat" && <ChatTab sid={sid}/>}
        {tab==="journal" && <JournalTab sid={sid}/>}
        {tab==="assessment" && <AssessmentTab sid={sid}/>}
        {tab==="protocol" && <ProtocolTab sid={sid}/>}
        {tab==="import" && <ImportTab sid={sid}/>}
      </CloudFirstGate>
    </div>
  );
}
