# Atlas — Research Roadmap

Questo documento elenca le ricerche, dataset, decisioni architetturali e considerazioni etico/legali necessarie per scalare Atlas a un sistema che batta ChatGPT/Claude sulla **comprensione del comportamento umano e della psiche**.

Aggiornato: 2026-05-04. Owner: Marco. Da rivedere ogni 4 settimane.

---

## ⚖️ Premessa etica e legale (NON OPZIONALE)

Atlas parla con persone che spesso sono in stato di vulnerabilità (dipendenze, ansia, trauma, crisi relazionali). Su queste persone si applica:

- **EU AI Act 2024** (entrato in vigore 2025): Articolo 5 vieta sistemi AI che "sfruttano vulnerabilità di un gruppo specifico in modo da causare danno fisico o psicologico". Questo include dark pattern di engagement che spingono uso compulsivo in chi ha già pattern compulsivi.
- **GDPR Art. 9**: dati su salute mentale, orientamento sessuale, appartenenza religiosa, vita sessuale = "categorie particolari" → richiedono consenso esplicito separato e finalità precisa.
- **Direttiva Pratiche Commerciali Sleali (UE 2005/29)**: vieta pratiche che riducono "in modo sensibile la capacità del consumatore di prendere una decisione consapevole".

### Principio operativo

> **Engagement etico = ricordo + insight + continuità.**
> **Engagement tossico = FOMO + streak punitive + sfruttamento del reward system.**

Il vantaggio competitivo di Atlas su ChatGPT NON è "creare dipendenza", è essere l'unico sistema che:
1. Ricorda davvero chi sei (memoria persistente cifrata)
2. Si adatta al tuo profilo psicologico (attaccamento, regolazione emotiva, trauma)
3. Riprende il filo da dove avevi lasciato
4. Costruisce un percorso coerente nel tempo

Questo è già più potente di qualunque dark pattern, e legale.

---

## 🧠 Engagement etico — pattern da implementare

| Pattern | Cosa fa | Etico? | Status |
|---|---|---|---|
| **Memoria persistente cifrata** | Atlas ricorda nome, situazione, conversazioni | ✅ | ✅ Fatto (Fase 3) |
| **Continuity prompt** | "L'ultima volta mi avevi detto X. Com'è andata?" | ✅ | ⏳ Da fare |
| **Insight tracker** | Atlas tiene traccia delle "scoperte" dell'utente, le richiama | ✅ | ⏳ Da fare |
| **Personalized predictions** | Le 3 domande next sono modellate sul tuo profilo | ✅ | ✅ Esiste, da raffinare |
| **Open loops onesti** | "La prossima volta possiamo approfondire X se ti va" | ✅ | ⏳ Da fare |
| **Progress visualization** | Grafico onesto delle aree su cui hai lavorato | ✅ | ⏳ Da fare |
| **Streak gentile opt-out** | "5 giorni di fila, complimenti" — MAI guilt-trip se rompi | ⚠️ Borderline | 🚫 Solo se opt-in esplicito |
| Notifiche push che simulano urgenza | "Sei a rischio se non torni!" | ❌ Vietato | 🚫 Mai |
| Streak che fa sentire in colpa | "Hai perso 3 giorni" con cuore rotto | ❌ Vietato | 🚫 Mai |
| Variable reward unpredictable | Slot machine logic | ❌ Vietato | 🚫 Mai |

---

## 📚 Ricerche da approfondire

### 1. Modelli psicologici da integrare nel profilo

- [ ] **Big Five (OCEAN)** — già robusto, mancano dataset italiani validati. Cerca: IPIP-NEO-120 in italiano.
- [ ] **ECR-R Italian validated** — lo abbiamo nei test, verifica fonte e norme.
- [ ] **ACE** — validato, ok.
- [ ] **DERS-18 (Difficulties in Emotion Regulation Scale)** — italiano, validato. Da aggiungere come opzione assessment.
- [ ] **Schema therapy 18 EMS (Young)** — pattern profondi (abbandono, abuso, deficit, defettosità, isolamento, dipendenza, vulnerabilità, fallimento, sottomissione, sacrificio, ricerca approvazione, negatività, inibizione emotiva, standard severi, pretesa, autocontrollo insufficiente, punizione, fusione). Test breve YSQ-S3R, italiano disponibile.
- [ ] **Internal Family Systems (Schwartz)** — modello "parti interiori". Manca strumento auto-somministrato validato. Da costruire mini-protocollo conversazionale.
- [ ] **Polyvagal Theory (Porges)** — autoregolazione. Strumento: Body Perception Questionnaire (BPQ).

### 2. Dataset training per fine-tuning futuro

Per superare ChatGPT su psiche servono dataset specializzati. Da raccogliere/licenziare:

- [ ] **Empathic dialog dataset** — Empathetic Dialogues (Facebook, ~25k), EmpatheticIntents.
- [ ] **Therapy transcripts** — corpus etico più difficile. Alexander Street Press ha "Counseling and Therapy in Video" (a pagamento, ~$2-5k anno per istituzione).
- [ ] **DAIC-WOZ** (Distress Analysis Interview Corpus) — depressione/PTSD interview. Accademico, richiesta licenza.
- [ ] **Reddit r/relationships, r/depression** — etica grigia. Usare solo aggregato, mai testo letterale → derive synthetic.
- [ ] **Italian Mental Health Corpus** — non esiste pubblico, da costruire con consenso.

### 3. Modelli AI da valutare

| Modello | Punti forti | Punti deboli | Costo |
|---|---|---|---|
| Gemini 2.5 Flash | Veloce, gratis fino a 1500 req/giorno, contesto 1M | Privacy: usa input per training (free tier) | Gratis |
| Gemini 2.5 Pro | Più ragionamento, contesto 2M | Pagamento, latenza maggiore | $1.25/$5 per M token |
| Claude Sonnet 4.5 | Migliore su empatia/sfumatura | Privacy: Anthropic dichiara no training su input pagati | $3/$15 per M token |
| OpenAI GPT-5 | Vasto, multimodale | Privacy variabile per tier | $5/$15 per M token |
| **Self-host (Llama-3.3-70B)** | Privacy assoluta, fine-tuning libero | Costo infra, qualità inferiore | $1-3/h GPU |

**Decisione attuale**: Gemini Flash (gratis) per MVP. Pianificare migrazione a Claude Sonnet quando avremo paying users (~50/giorno per coprire $200/mese di costi).

### 4. Embeddings e RAG

- [x] Attuale: `text-embedding-004` di Google (gratis, 768d, decente)
- [ ] Da testare: `gte-multilingual-base` (open, italiano nativo migliore)
- [ ] Long-term: embedding fine-tunati su corpus psicologia italiana

### 5. Memoria conversazionale

Attuale: history degli ultimi 6 messaggi. Limite: dopo 20 turni Atlas dimentica nome/contesto.

- [ ] **Vector memory**: ogni messaggio importante embedded e archiviato. Recupero by similarity al momento del prompt.
- [ ] **Episodic memory**: riassunti per "episodi" (sessione di una serata) generati dall'LLM.
- [ ] **Semantic profile**: estrai automaticamente fatti stabili (nome, età, professione, partner, figli, dipendenze attive, obiettivi) e tienili sempre nel system prompt.

### 6. Importazione conversazioni esterne (FEATURE PRIORITARIA)

Use case: utente incolla 50 messaggi di ChatGPT → Atlas analizza, fa diagnosi pattern, propone piano.

- [ ] Endpoint `/api/import-analysis` che accetta blob testo
- [ ] Pipeline: split in turni → embed → estrazione pattern (temi, emozioni, contraddizioni) → diagnosi conversazionale (attaccamento style, regolazione, distorsioni cognitive) → piano in 5 punti
- [ ] UI: tab "Importa" con drag&drop o paste
- [ ] Privacy: nulla persiste senza consenso, opt-in al salvataggio

### 7. Personalization layer

Profilo deve influenzare:
- [ ] Sistema prompt dinamico (oggi è statico in `rag.ts`)
- [ ] Tono (caldo vs diretto a seconda di `lifeThemes` e `attachment`)
- [ ] Esempi nelle risposte (es. se trauma=high, evitare confronti diretti)
- [ ] Predicted questions (oggi semantiche, da ibridare con profile-aware)

### 8. Auto-scaling intelligence

Il sistema deve diventare più intelligente con l'uso:
- [x] Feedback 👍/👎 raccolto (Fase 4 cloud)
- [x] `aggregated_insights` aggiornato anonimamente
- [ ] **Re-ranking sources**: se per topic="alcol" la fonte `lembke-dopamine-2021` ha 80% positive feedback, alzala in retrieval ranking
- [ ] **Bandit allocation** sui template di risposta (es. due varianti del consiglio "smettere di bere", routing 50/50, dopo 100 sample il vincente prende 90%)
- [ ] **Topic gap detection**: query senza match nel corpus → notifica admin → aggiungi fonti

---

## 🎯 Prossime priorità (ordine raccomandato)

1. **Smart profile modal collegato al banner** — ✅ FATTO oggi
2. **Profile gap probing in chat** — ✅ FATTO oggi (chip cliccabile, ogni 3 turni)
3. **Importazione conversazioni esterne** — Prossimo deploy
4. **Continuity prompt al ritorno** — ("Bentornato, l'ultima volta…")
5. **Insight tracker** — Atlas estrae 1 insight per sessione e lo richiama
6. **Vector memory** — superare il limite dei 6 messaggi history
7. **System prompt dinamico** in base a profile
8. **Re-ranking via feedback** quando avremo abbastanza dati
9. **Migrazione a Claude Sonnet** quando MAU > 100

---

## 🔬 Studi citabili nel marketing (validati, niente fuffa)

- **Pennebaker (1997)** — expressive writing riduce sintomi stress: usato per supportare feature journal.
- **Gottman (1994-2014)** — predizione stabilità coppia con accuratezza 90%. Usato per consigli relazione.
- **Lembke (2021)** — Dopamine Nation: bilancia piacere/dolore. Usato per dipendenze.
- **Duckworth (2007)** — grit predittore successo > IQ. Usato per motivazione.
- **Fogg (2019)** — tiny habits, BJ Fogg model. Usato per abitudini.
- **van der Kolk (2014)** — body keeps the score. Trauma somatico.
- **Schwartz (IFS)** — parti interiori.
- **Porges (polyvagal)** — autoregolazione fisiologica.

---

## 📌 Cose da decidere con Marco

- [ ] **Pricing model**: free tier limitato + abbonamento mensile, o solo donazioni, o token-based?
- [ ] **Onboarding**: il modal completo si presenta al primo accesso o solo cliccando il banner? (oggi: solo cliccando, quindi opzionale)
- [ ] **Importazione**: solo testo paste o anche upload .txt/.json export ChatGPT?
- [ ] **Account anonimo permanente**: vogliamo permettere uso senza email per sempre, o forzare login dopo 10 turni?
- [ ] **Streak**: aggiungiamo? (rischio etico). Se sì, opt-in obbligatorio + niente guilt-trip, mai.
- [ ] **Comunità**: vogliamo feature dove utenti consenzienti vedono insight aggregati ("il 73% di chi ha tuo profilo ha trovato utile X")?

---

Da rivedere: ogni 4 settimane.
