"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Brain, AlertTriangle, Users, Repeat, Zap, Activity, Eye, Trash2, GitMerge, Search } from "lucide-react";
import { getBrowserClient, isSupabaseReady } from "../../lib/supabase";
import {
  CATEGORY_LABELS,
  ENTITY_KIND_LABELS,
  RELATION_LABELS,
  type Entity,
  type Relation,
  type Pattern,
  type Category,
  type EntityKind,
} from "../../lib/kg/types";

async function authHeader(): Promise<Record<string, string>> {
  const c = getBrowserClient();
  if (!c) return {};
  const { data } = await c.auth.getSession();
  if (!data.session) return {};
  return { Authorization: `Bearer ${data.session.access_token}` };
}

function CategoryIcon({ category }: { category: Category }) {
  const map: Partial<Record<Category, JSX.Element>> = {
    relationships: <Users className="w-4 h-4" />,
    family: <Users className="w-4 h-4" />,
    work: <Activity className="w-4 h-4" />,
    trauma: <AlertTriangle className="w-4 h-4" />,
    fear: <AlertTriangle className="w-4 h-4" />,
    body: <Zap className="w-4 h-4" />,
    addiction: <Zap className="w-4 h-4" />,
    identity: <Eye className="w-4 h-4" />,
    money: <Activity className="w-4 h-4" />,
    sex: <Users className="w-4 h-4" />,
    social: <Users className="w-4 h-4" />,
    spiritual: <Eye className="w-4 h-4" />,
    power: <Zap className="w-4 h-4" />,
  };
  return map[category] ?? <Brain className="w-4 h-4" />;
}

const CAT_COLORS: Record<Category, string> = {
  relationships: "border-pink-500/30 bg-pink-500/5",
  family: "border-amber-500/30 bg-amber-500/5",
  work: "border-blue-500/30 bg-blue-500/5",
  money: "border-emerald-500/30 bg-emerald-500/5",
  body: "border-orange-500/30 bg-orange-500/5",
  trauma: "border-rose-500/30 bg-rose-500/5",
  identity: "border-indigo-500/30 bg-indigo-500/5",
  fear: "border-red-500/30 bg-red-500/5",
  power: "border-purple-500/30 bg-purple-500/5",
  addiction: "border-orange-600/30 bg-orange-600/5",
  sex: "border-fuchsia-500/30 bg-fuchsia-500/5",
  social: "border-cyan-500/30 bg-cyan-500/5",
  spiritual: "border-violet-500/30 bg-violet-500/5",
  generic: "border-zinc-700 bg-zinc-900/50",
};

export default function MindPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [eRes, rRes, pRes] = await Promise.all([
        fetch("/api/kg?action=list-entities", { headers: await authHeader() }),
        fetch("/api/kg?action=list-relations", { headers: await authHeader() }),
        fetch("/api/kg?action=list-patterns", { headers: await authHeader() }),
      ]);
      const e = await eRes.json();
      const r = await rRes.json();
      const p = await pRes.json();
      setEntities(e.entities ?? []);
      setRelations(r.relations ?? []);
      setPatterns(p.patterns ?? []);
    } catch {
      /* offline */
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let arr = entities;
    if (filter !== "all") arr = arr.filter((e) => e.category === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter((e) =>
        e.label.toLowerCase().includes(s) ||
        e.aliases.some((a) => a.toLowerCase().includes(s)) ||
        (e.attributes.role ?? "").toLowerCase().includes(s),
      );
    }
    return arr;
  }, [entities, filter, search]);

  const grouped = useMemo(() => {
    const m = new Map<Category, Entity[]>();
    for (const e of filtered) {
      const arr = m.get(e.category) ?? [];
      arr.push(e);
      m.set(e.category, arr);
    }
    return [...m.entries()]
      .map(([cat, arr]) => ({ cat, arr: arr.sort((a, b) => b.importance - a.importance) }))
      .sort((a, b) => Math.max(...b.arr.map((e) => e.importance)) - Math.max(...a.arr.map((e) => e.importance)));
  }, [filtered]);

  const selected = useMemo(() => entities.find((e) => e.id === selectedId) ?? null, [entities, selectedId]);

  const selectedRelations = useMemo(() => {
    if (!selectedId) return [];
    return relations.filter((r) => r.sourceId === selectedId || r.targetId === selectedId);
  }, [relations, selectedId]);

  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  async function onDelete(id: string) {
    if (!confirm("Cancellare questa entità dal grafo? Verranno rimosse anche le sue relazioni.")) return;
    await fetch("/api/kg", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ action: "delete", id }),
    });
    setSelectedId(null);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      <header className="space-y-2">
        <Link href="/" className="text-xs text-indigo-400 hover:underline">← Atlas</Link>
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-indigo-400" />
          <h1 className="text-2xl font-bold">La mente di Atlas</h1>
        </div>
        <p className="text-sm text-zinc-400">
          Tutto quello che mi hai raccontato finisce qui, organizzato in entità (persone, eventi, atteggiamenti, traumi, pattern)
          e relazioni (causa, blocca, ripete, boicotta…). Quando parli, riconosco se "lei" è Marta o un'altra,
          se questo nervosismo è lo stesso che hai descritto altre volte, e cosa boicotta cosa.
        </p>
      </header>

      {/* PATTERNS */}
      {patterns.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-amber-300">
            <Repeat className="w-4 h-4" /> Pattern rilevati ({patterns.length})
          </h2>
          <div className="space-y-2">
            {patterns.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-lg border border-amber-500/20 bg-zinc-950/40 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-amber-200">{p.title}</div>
                    <div className="text-xs text-zinc-400 mt-1">{p.summary}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide rounded px-2 py-0.5 shrink-0 ${
                    p.kind === "boycott" ? "bg-rose-500/20 text-rose-300" :
                    p.kind === "repetition" ? "bg-amber-500/20 text-amber-300" :
                    "bg-zinc-700/40 text-zinc-300"
                  }`}>{p.kind}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-2">
                  <span>Forza {p.strength}/100</span>
                  <span>·</span>
                  <span>{p.evidenceCount} evidenze</span>
                  <span>·</span>
                  <span>{CATEGORY_LABELS[p.category]}</span>
                  <span>·</span>
                  <span>{p.involvedEntityIds.length} entità coinvolte</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-2 sticky top-0 bg-zinc-950/95 backdrop-blur z-10 py-2 -mx-4 px-4 border-b border-zinc-900">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, alias, ruolo…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm"
        >
          <option value="all">Tutte le categorie ({entities.length})</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => {
            const count = entities.filter((e) => e.category === c).length;
            if (count === 0) return null;
            return <option key={c} value={c}>{CATEGORY_LABELS[c]} ({count})</option>;
          })}
        </select>
      </div>

      {/* MAIN: grid entità + dettaglio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {loading && <div className="text-zinc-500 text-sm">Carico la mente…</div>}
          {!loading && entities.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-zinc-500 text-sm">
              <Brain className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
              Atlas non ha ancora costruito niente. Continua a parlargli: ogni messaggio che scrivi
              alimenta entità e categorie qui dentro automaticamente.
            </div>
          )}
          {grouped.map(({ cat, arr }) => (
            <section key={cat} className={`rounded-xl border p-3 ${CAT_COLORS[cat]}`}>
              <header className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CategoryIcon category={cat} />
                  {CATEGORY_LABELS[cat]}
                </div>
                <span className="text-[11px] text-zinc-500">{arr.length}</span>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {arr.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`text-left rounded-lg border bg-zinc-950/50 p-2.5 hover:border-indigo-500/40 transition ${
                      selectedId === e.id ? "border-indigo-500" : "border-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{e.label}</div>
                      <span className="text-[10px] text-zinc-500 shrink-0">{ENTITY_KIND_LABELS[e.kind]}</span>
                    </div>
                    {e.attributes.role && (
                      <div className="text-xs text-zinc-400 mt-0.5">{e.attributes.role}</div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1.5">
                      <span>imp {e.importance}</span>
                      <span>·</span>
                      <span>{e.mentionCount} menzioni</span>
                      {e.aliases.length > 0 && <><span>·</span><span>{e.aliases.length} alias</span></>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Detail */}
        <aside className="lg:col-span-1 lg:sticky lg:top-24 lg:self-start space-y-3">
          {selected ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-zinc-500">{ENTITY_KIND_LABELS[selected.kind]} · {CATEGORY_LABELS[selected.category]}</div>
                  <div className="font-bold text-lg">{selected.label}</div>
                </div>
                <button onClick={() => onDelete(selected.id)} className="text-zinc-500 hover:text-rose-400 p-1" title="Elimina entità">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {selected.attributes.role && (
                <div className="text-sm text-zinc-300">Ruolo: {selected.attributes.role}</div>
              )}
              {selected.attributes.traits && selected.attributes.traits.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.attributes.traits.map((t, i) => (
                    <span key={i} className="text-[11px] rounded-full bg-zinc-800 px-2 py-0.5">{t}</span>
                  ))}
                </div>
              )}
              {selected.aliases.length > 0 && (
                <div className="text-xs text-zinc-400">
                  <span className="text-zinc-500">Alias:</span> {selected.aliases.join(", ")}
                </div>
              )}
              {selected.attributes.notes && (
                <div className="text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-2">{selected.attributes.notes}</div>
              )}
              <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
                <div><div className="text-zinc-300 text-sm">{selected.importance}</div><div>importanza</div></div>
                <div><div className="text-zinc-300 text-sm">{selected.mentionCount}</div><div>menzioni</div></div>
                <div><div className="text-zinc-300 text-sm">{Math.round((selected.attributes.intensity ?? 0) * 100)}</div><div>intensità</div></div>
              </div>
              {selectedRelations.length > 0 && (
                <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                  <div className="text-xs font-medium text-zinc-400">Connessioni ({selectedRelations.length})</div>
                  {selectedRelations.slice(0, 12).map((r) => {
                    const isSource = r.sourceId === selected.id;
                    const otherId = isSource ? r.targetId : r.sourceId;
                    const other = byId.get(otherId);
                    if (!other) return null;
                    return (
                      <div key={r.id} className="text-xs rounded bg-zinc-900/60 p-2">
                        <div>
                          <button onClick={() => setSelectedId(otherId)} className="font-medium text-indigo-300 hover:underline">
                            {isSource ? selected.label : other.label}
                          </button>{" "}
                          <span className="text-zinc-500">{RELATION_LABELS[r.kind]}</span>{" "}
                          <button onClick={() => setSelectedId(otherId)} className="font-medium text-indigo-300 hover:underline">
                            {isSource ? other.label : selected.label}
                          </button>
                        </div>
                        {r.detail && <div className="text-zinc-500 mt-0.5 italic">"{r.detail}"</div>}
                        <div className="text-[10px] text-zinc-600 mt-1">peso {r.weight} · {r.evidenceCount} evidenze</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-500">
              Clicca un'entità per vedere il dettaglio: ruolo, tratti, alias e tutte le connessioni nel grafo.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
