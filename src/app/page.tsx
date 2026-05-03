"use client";
import { useState } from "react";
import { Brain, BookOpen, PenTool, ClipboardList } from "lucide-react";
import ChatTab from "./chat-tab";
import JournalTab from "./journal-tab";
import AssessmentTab from "./assessment-tab";

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function Page() {
  const [sid] = useState(() => { if (typeof window === "undefined") return "ssr"; const k="atlas-sid"; let s=localStorage.getItem(k); if(!s){s=uid(); localStorage.setItem(k,s);} return s; });
  const [tab, setTab] = useState<"chat"|"journal"|"assessment">("chat");

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Atlas</h1>
            <p className="text-xs text-zinc-400">Chat · Journaling · Assessment</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400"><BookOpen className="w-4 h-4" />16 fonti</div>
      </header>
      <nav className="flex gap-1 mb-4 border-b border-zinc-800 pb-1">
        {(["chat","journal","assessment"] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-sm rounded-t-lg flex items-center gap-2 ${tab===t?"bg-zinc-800 text-white":"text-zinc-500 hover:text-zinc-300"}`}>
            {t==="chat"&&<Brain className="w-4 h-4"/>}{t==="journal"&&<PenTool className="w-4 h-4"/>}{t==="assessment"&&<ClipboardList className="w-4 h-4"/>}
            {t==="chat"?"Chat":t==="journal"?"Journaling":"Assessment"}
          </button>
        ))}
      </nav>
      {tab==="chat" && <ChatTab sid={sid}/>}
      {tab==="journal" && <JournalTab sid={sid}/>}
      {tab==="assessment" && <AssessmentTab sid={sid}/>}
    </div>
  );
}
