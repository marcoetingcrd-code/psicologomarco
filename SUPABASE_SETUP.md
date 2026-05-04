# Setup Supabase per Atlas Cloud

Guida veloce per attivare cloud sync + auth magic link + conversazioni criptate.

## 1. Crea il progetto Supabase (3 min)

1. Vai su https://supabase.com → **Start your project**
2. Accedi con GitHub (usa l'account `marcoetingcrd-code`)
3. **New Project**:
   - Name: `atlas-cloud` (o come vuoi)
   - Database password: generane una forte e salvala
   - Region: **Frankfurt (EU Central)** (per GDPR)
   - Pricing plan: **Free** (fino a 50k MAU)
4. Aspetta 1-2 min che provisioni il DB

## 2. Esegui lo schema SQL (1 min)

1. Nel progetto Supabase: **SQL Editor** (sidebar)
2. Clicca **New Query**
3. Copia tutto il contenuto di `supabase/schema.sql` (in questo repo)
4. Incolla e clicca **Run**
5. Dovresti vedere "Success. No rows returned"

## 3. Copia le credenziali (1 min)

Nella dashboard progetto → **Settings → API**:

| Valore | Dove serve |
|---|---|
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon public key` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role key` | `SUPABASE_SERVICE_ROLE_KEY` (⚠️ SEGRETO) |

## 4. Genera chiave di crittografia

Nel terminale:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Output esempio: `k7ZQ9xYvB2mN...` → salvalo, sarà `ENCRYPTION_KEY`.

> ⚠️ **Attenzione**: se perdi questa chiave, non puoi più decriptare le conversazioni esistenti. Backup sicuro!

## 5. Configura env vars su Vercel (2 min)

Dashboard Vercel → progetto `psicologomarco` → **Settings → Environment Variables**.

Aggiungi queste **5 variabili** (tutte su Production + Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (Project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (service_role key) |
| `ENCRYPTION_KEY` | (chiave generata al punto 4) |

Già presente: `GEMINI_API_KEY` (non toccarla).

## 6. Configura email auth su Supabase (2 min)

Supabase → **Authentication → Providers → Email**:
- **Enable Email provider**: ✅
- **Confirm email**: ❌ (non serve con magic link)
- **Secure email change**: ✅

**Authentication → URL Configuration**:
- **Site URL**: `https://distributoreautomaticotakeaway.com`
- **Redirect URLs** (aggiungi tutti):
  - `https://distributoreautomaticotakeaway.com/**`
  - `https://www.distributoreautomaticotakeaway.com/**`
  - `https://psicologomarco.vercel.app/**`
  - `http://localhost:3000/**` (per dev)

## 7. Redeploy

Vercel → **Deployments** → ⋯ sul deploy più recente → **Redeploy**.

## 8. Test

1. Vai su https://distributoreautomaticotakeaway.com/login
2. Inserisci la tua email → ricevi link → clicca → sei dentro
3. Manda un messaggio in chat
4. Supabase SQL Editor: `select * from messages;` — dovresti vedere 1 riga con `content_encrypted` criptato (base64)
5. `/settings` → toggle ML consent → export dati → cancellazione account

---

## Cosa succede dopo il setup

- **Utenti anonimi** (no login) → continuano a usare localStorage come prima
- **Utenti loggati** → conversazioni salvate nel cloud, sincronizzate tra dispositivi
- **Con consenso ML** → feedback aggregati anonimi popolano `aggregated_insights` (visibile via SQL)
- **Senza consenso** → nessun dato oltre alle conversazioni private

## Debug

Se vedi "Sistema auth non configurato" sulla pagina `/login`:
- env vars `NEXT_PUBLIC_SUPABASE_*` mancanti o il redeploy non è stato fatto

Se l'invio messaggio in chat fallisce dopo il login:
- env `ENCRYPTION_KEY` mancante o malformata
- `SUPABASE_SERVICE_ROLE_KEY` mancante

Controlla i logs: Vercel → **Logs** → filtra per `error`.
