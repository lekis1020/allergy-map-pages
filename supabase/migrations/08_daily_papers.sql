-- daily_papers: stores pre-computed PubMed results + Gemini classifications
-- Populated once daily by /api/cron/daily-papers

CREATE TABLE IF NOT EXISTS daily_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  articles JSONB NOT NULL DEFAULT '[]',       -- PubMed article summaries
  abstracts JSONB NOT NULL DEFAULT '{}',      -- pmid → AbstractSection[]
  category_map JSONB NOT NULL DEFAULT '{}',   -- pmid → category string[]
  total_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anyone to read (public page), only service role can write
ALTER TABLE daily_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily_papers"
  ON daily_papers FOR SELECT
  USING (true);
