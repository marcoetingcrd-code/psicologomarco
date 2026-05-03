# Atlas — Test MVP

Biblioteca scientifica interrogabile con **RAG**, **profiling utente** e **predizione pre-caching delle prossime domande**.

## Cosa fa

- 🧠 **RAG** su corpus di 16 paper/libri peer-reviewed (attaccamento, neurobiologia dell'amore, carisma evidence-based, sonno, autostima, psicologia evolutiva)
- 📚 **Citazioni verificabili** per ogni risposta — zero allucinazioni
- 🔮 **Predizione delle prossime domande** basata sul centroide semantico della tua sessione
- ⚡ **Pre-caching**: la prima risposta predetta viene pre-generata in background, risposta istantanea se clicchi
- 🎯 **Session-based learning**: Atlas apprende il tuo focus mentre lo usi

## Setup

### 1. Installa dipendenze
```bash
npm install
```

### 2. (Opzionale ma consigliato) Configura Gemini
Senza chiave API funziona comunque in **modalità retrieval-only** (recupera i passaggi rilevanti senza sintesi).

Per le risposte AI complete con citazioni generate:

1. Vai su https://aistudio.google.com/app/apikey
2. Crea una API key gratuita (free tier: 1500 richieste/giorno)
3. Copia `.env.local.example` in `.env.local` e inserisci la chiave:
   ```
   GEMINI_API_KEY=la_tua_chiave
   ```

### 3. Avvia
```bash
npm run dev
```

Apri http://localhost:3000

## Architettura

```
src/
├── app/
│   ├── page.tsx              UI chat con suggerimenti predittivi
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts     POST: query → RAG → risposta + predizioni
│       └── predict/route.ts  GET: predizioni correnti per sessione
└── lib/
    ├── corpus.ts             Seed di 16 fonti scientifiche reali
    ├── vectorstore.ts        Index in-memory, embeddings Gemini + fallback
    ├── gemini.ts             Client Google Generative AI
    ├── rag.ts                Pipeline retrieval + generation con citazioni
    └── profile.ts            Session tracking + prediction + cache
```

## Come testare le feature

1. **RAG base**: chiedi "Cos'è l'attaccamento sicuro?" → vedi citazioni sotto
2. **Learning**: fai 3-4 domande su un tema → i suggerimenti si adattano al focus
3. **Predizione**: clicca un suggerimento → risposta (spesso istantanea perché pre-cached)
4. **Cache hit**: rifai la stessa domanda → tag `cached` verde nella risposta

## Deploy production (Vercel + Supabase)

### 1. Supabase (gratis)
- Vai su [supabase.com](https://supabase.com), crea progetto gratuito
- Esegui lo SQL in `supabase/migrations/001_init.sql` nel SQL Editor
- Copia Project URL e Anon Key in `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- Abilita Email Auth (Settings → Auth → Email)

### 2. Vercel (gratis)
- Vai su [vercel.com](https://vercel.com), importa il repo GitHub
- Aggiungi Environment Variables:
  - `GEMINI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Deploy

## Roadmap production (dopo approvazione)

- [ ] Supabase: auth + Postgres + pgvector (persistenza multi-utente)
- [ ] Scale psicometriche validate (ECR-R, RSES, LSAS, Big Five)
- [ ] Generatore di protocolli personalizzati mente/corpo/relazioni
- [ ] Dashboard progressi nel tempo
- [ ] Journaling strutturato evidence-based (Pennebaker)
- [ ] Deploy Vercel con dominio custom
- [ ] Corpus espanso: upload PDF open access, chunking avanzato, re-ranking

## Stack

- **Next.js 15** (App Router, React 19)
- **Google Gemini 2.0 Flash** (LLM) + `text-embedding-004` (embeddings)
- **Tailwind CSS** + **lucide-react** (UI)
- **In-memory vector store** (cosine similarity, fallback hashed word bag)
- **Zero DB** nel test (tutto in memoria lato server, localStorage lato client per session ID)
