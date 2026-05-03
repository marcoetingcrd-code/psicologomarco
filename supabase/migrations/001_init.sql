-- Atlas Omega - Supabase Schema
-- Enable RLS per multi-tenancy privacy

-- Journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  text TEXT NOT NULL,
  mood INTEGER CHECK (mood >= 1 AND mood <= 10),
  word_count INTEGER DEFAULT 0,
  negative_emotion_words INTEGER DEFAULT 0,
  positive_emotion_words INTEGER DEFAULT 0,
  first_person_count INTEGER DEFAULT 0,
  insight_markers TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own journal entries"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id);

-- Assessment results
CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  scale_id TEXT NOT NULL,
  scale_name TEXT NOT NULL,
  scores JSONB NOT NULL,
  critical BOOLEAN DEFAULT FALSE,
  critical_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own assessment results"
  ON assessment_results FOR ALL
  USING (auth.uid() = user_id);

-- User queries (for profiling/prediction persistence)
CREATE TABLE IF NOT EXISTS user_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own queries"
  ON user_queries FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_session ON journal_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_user ON assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_user ON user_queries(user_id);
