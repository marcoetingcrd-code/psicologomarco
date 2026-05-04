-- Schema Atlas Cloud
-- Esegui questo nel SQL Editor di Supabase.
-- Puoi runnarlo più volte: tutto usa CREATE IF NOT EXISTS.

-- ============================================================================
-- 1. CONVERSATIONS (una riga = una chat persistente di un utente)
-- ============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_conversations_user on public.conversations(user_id, updated_at desc);

-- ============================================================================
-- 2. MESSAGES (contenuto CIFRATO in content_encrypted)
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content_encrypted text not null,   -- AES-256-GCM (base64)
  sources jsonb,
  used_llm boolean default false,
  model_version text,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at asc);
create index if not exists idx_messages_user on public.messages(user_id, created_at desc);

-- ============================================================================
-- 3. USER SETTINGS (consenso ML, preferenze)
-- ============================================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ml_consent boolean not null default false,           -- opt-in al contributo ML aggregato
  ml_consent_at timestamptz,
  streak_opt_in boolean not null default false,         -- opt-in streak gentile, mai guilt-trip
  streak_count int not null default 0,
  last_active_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings add column if not exists streak_opt_in boolean not null default false;
alter table public.user_settings add column if not exists streak_count int not null default 0;
alter table public.user_settings add column if not exists last_active_at timestamptz;

-- ============================================================================
-- 4. FEEDBACK esplicito (thumbs up/down su risposta Atlas)
-- ============================================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  topic_tag text,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_user on public.feedback(user_id, created_at desc);
create index if not exists idx_feedback_topic on public.feedback(topic_tag);

-- ============================================================================
-- 5. AGGREGATED INSIGHTS (ANONIMO — NO user_id, NO contenuto)
--    Alimenta il re-ranking e identifica gap del corpus.
-- ============================================================================
create table if not exists public.aggregated_insights (
  id uuid primary key default gen_random_uuid(),
  topic_tag text not null,
  source_id text,                 -- ID della fonte citata in risposta, o null se general
  positive_count int not null default 0,
  negative_count int not null default 0,
  usage_count int not null default 0,
  last_updated timestamptz not null default now(),
  unique (topic_tag, source_id)
);
create index if not exists idx_insights_topic on public.aggregated_insights(topic_tag);

-- ============================================================================
-- 6. TOPIC GAPS (query che non trovano match nel corpus)
-- ============================================================================
create table if not exists public.topic_gaps (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null unique,     -- anonHash della query, non la query stessa
  topic_tag text,
  no_match_count int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists idx_gaps_count on public.topic_gaps(no_match_count desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_settings enable row level security;
alter table public.feedback enable row level security;
-- aggregated_insights & topic_gaps: lettura pubblica (dati anonimi), scrittura solo service key
alter table public.aggregated_insights enable row level security;
alter table public.topic_gaps enable row level security;

-- Conversations: user vede/gestisce solo le sue
drop policy if exists "users manage own conversations" on public.conversations;
create policy "users manage own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Messages: user vede/gestisce solo i suoi
drop policy if exists "users manage own messages" on public.messages;
create policy "users manage own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- User settings: solo proprie
drop policy if exists "users manage own settings" on public.user_settings;
create policy "users manage own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Feedback: user inserisce/legge solo suoi feedback
drop policy if exists "users manage own feedback" on public.feedback;
create policy "users manage own feedback" on public.feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Aggregated insights: lettura pubblica (dati anonimi), scrittura solo service role
drop policy if exists "public read insights" on public.aggregated_insights;
create policy "public read insights" on public.aggregated_insights
  for select using (true);
-- (nessuna policy di write = nessun ruolo può scrivere via anon/authenticated; solo service_role bypassa)

-- Topic gaps: lettura pubblica, scrittura solo service role
drop policy if exists "public read gaps" on public.topic_gaps;
create policy "public read gaps" on public.topic_gaps
  for select using (true);

-- ============================================================================
-- TRIGGER updated_at su conversations
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- FUNZIONE: crea automaticamente user_settings al signup
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RPC: increment_insight — upsert atomico per ML aggregato anonimo
-- ============================================================================
create or replace function public.increment_insight(
  p_topic text,
  p_source text,
  p_positive int default 0,
  p_negative int default 0
)
returns void language plpgsql security definer as $$
begin
  insert into public.aggregated_insights (topic_tag, source_id, positive_count, negative_count, usage_count, last_updated)
  values (p_topic, p_source, p_positive, p_negative, 1, now())
  on conflict (topic_tag, source_id) do update
    set positive_count = aggregated_insights.positive_count + p_positive,
        negative_count = aggregated_insights.negative_count + p_negative,
        usage_count = aggregated_insights.usage_count + 1,
        last_updated = now();
end; $$;

-- ============================================================================
-- RPC: record_topic_gap — registra query senza match (anonimizzata)
-- ============================================================================
create or replace function public.record_topic_gap(
  p_query_hash text,
  p_topic text
)
returns void language plpgsql security definer as $$
begin
  insert into public.topic_gaps (query_hash, topic_tag, no_match_count, first_seen, last_seen)
  values (p_query_hash, p_topic, 1, now(), now())
  on conflict (query_hash) do update
    set no_match_count = topic_gaps.no_match_count + 1,
        last_seen = now();
end; $$;

-- ============================================================================
-- 7. CASE FILES (dossier strategico per conversazione, cifrato)
-- ============================================================================
create table if not exists public.case_files (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null default 'generic',
  facts_encrypted text,
  attempts_encrypted text,
  open_questions_encrypted text,
  pending_thread_encrypted text,
  plan_encrypted text,
  readiness int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists idx_case_files_user on public.case_files(user_id, updated_at desc);
alter table public.case_files enable row level security;
drop policy if exists "case_files_owner" on public.case_files;
create policy "case_files_owner" on public.case_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 8. JOY EVENTS (eventi di gioia/successo rilevati, cifrati)
-- ============================================================================
create table if not exists public.joy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  payload_encrypted text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_joy_events_user on public.joy_events(user_id, created_at desc);
alter table public.joy_events enable row level security;
drop policy if exists "joy_events_owner" on public.joy_events;
create policy "joy_events_owner" on public.joy_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 9. JOY PROFILES (aggregato per utente, cifrato)
-- ============================================================================
create table if not exists public.joy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload_encrypted text not null,
  total_events int not null default 0,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.joy_profiles enable row level security;
drop policy if exists "joy_profiles_owner" on public.joy_profiles;
create policy "joy_profiles_owner" on public.joy_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 10. SOVEREIGN CONTRACTS (auto-vincolo firmato, cifrato)
-- ============================================================================
create table if not exists public.sovereign_contracts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload_encrypted text not null,
  signed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  last_reconsent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.sovereign_contracts enable row level security;
drop policy if exists "sov_contracts_owner" on public.sovereign_contracts;
create policy "sov_contracts_owner" on public.sovereign_contracts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 11. SOVEREIGN STATE (manipulation profile, excuse library, audit, cifrato)
-- ============================================================================
create table if not exists public.sovereign_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  manipulation_profile_encrypted text,
  excuse_library_encrypted text,
  reckoning_streak int not null default 0,
  audit_misses int not null default 0,
  last_audit_at timestamptz,
  emergency_paused_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.sovereign_state enable row level security;
drop policy if exists "sov_state_owner" on public.sovereign_state;
create policy "sov_state_owner" on public.sovereign_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 12. SOVEREIGN LOG (log reckoning/audit/intervention/tribunal, cifrato)
-- ============================================================================
create table if not exists public.sovereign_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reckoning','audit','intervention','tribunal','safety','reconsent')),
  payload_encrypted text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sov_log_user on public.sovereign_log(user_id, created_at desc);
alter table public.sovereign_log enable row level security;
drop policy if exists "sov_log_owner" on public.sovereign_log;
create policy "sov_log_owner" on public.sovereign_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 13. HOOK STATE (streak, identity, threads, modules)
-- ============================================================================
create table if not exists public.hook_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_days int not null default 0,
  longest_streak int not null default 0,
  last_seen_at timestamptz,
  identity_handle text,
  pending_threads_encrypted text,
  ritual_morning_at time,
  ritual_evening_at time,
  hook_mode text not null default 'public' check (hook_mode in ('public','personal')),
  modules_enabled jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.hook_state enable row level security;
drop policy if exists "hook_state_owner" on public.hook_state;
create policy "hook_state_owner" on public.hook_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger updated_at su tutte le tabelle nuove
do $$ begin
  drop trigger if exists case_files_touch on public.case_files;
  create trigger case_files_touch before update on public.case_files
    for each row execute function public.touch_updated_at();
  drop trigger if exists joy_profiles_touch on public.joy_profiles;
  create trigger joy_profiles_touch before update on public.joy_profiles
    for each row execute function public.touch_updated_at();
  drop trigger if exists sov_contracts_touch on public.sovereign_contracts;
  create trigger sov_contracts_touch before update on public.sovereign_contracts
    for each row execute function public.touch_updated_at();
  drop trigger if exists sov_state_touch on public.sovereign_state;
  create trigger sov_state_touch before update on public.sovereign_state
    for each row execute function public.touch_updated_at();
  drop trigger if exists hook_state_touch on public.hook_state;
  create trigger hook_state_touch before update on public.hook_state
    for each row execute function public.touch_updated_at();
end $$;
