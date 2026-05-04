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
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
