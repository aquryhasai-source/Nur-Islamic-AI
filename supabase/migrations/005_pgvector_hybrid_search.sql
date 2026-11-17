-- 005_pgvector_hybrid_search.sql
-- Enable pgvector and create hybrid search for quran_ayahs
-- Run AFTER 001_security_additive_applied_2026-10-19.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to quran_ayahs (1536 dimensions for text-embedding-3-small or similar)
-- Note: This assumes quran_ayahs already exists with columns:
-- surah_number, ayah_number, surah_name_english, translation_en, search_vector
ALTER TABLE public.quran_ayahs
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for vector similarity search (HNSW for performance)
CREATE INDEX IF NOT EXISTS quran_ayahs_embedding_idx
  ON public.quran_ayahs
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create hybrid search RPC that combines lexical (FTS) and semantic (vector) search
-- Uses Reciprocal Rank Fusion (RRF) to combine results
CREATE OR REPLACE FUNCTION public.search_quran_ayahs_hybrid(
  p_search_query text,
  p_match_limit integer DEFAULT 10,
  p_lexical_weight real DEFAULT 0.5,
  p_semantic_weight real DEFAULT 0.5,
  p_query_embedding vector(1536) DEFAULT NULL
)
RETURNS TABLE (
  surah_number integer,
  ayah_number integer,
  surah_name_english text,
  translation_en text,
  search_vector tsvector,
  arabic_text text,
  lexical_rank real,
  semantic_rank real,
  fused_score real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lexical_query text;
  v_semantic_query vector(1536);
BEGIN
  -- Build lexical query (plainto_tsquery for FTS)
  v_lexical_query := plainto_tsquery('english', p_search_query);

  -- If query_embedding provided, use it; otherwise caller must provide
  -- In production, we'd generate embedding here, but for Edge Function we pass it in
  v_semantic_query := p_query_embedding;

  -- Return combined results using RRF
  RETURN QUERY
  WITH lexical_results AS (
    SELECT
      surah_number,
      ayah_number,
      surah_name_english,
      translation_en,
      search_vector,
      arabic_text,
      ts_rank_cd(search_vector, v_lexical_query, 32) AS lexical_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(search_vector, v_lexical_query, 32) DESC) AS lexical_rn
    FROM public.quran_ayahs
    WHERE search_vector @@ v_lexical_query
  ),
  semantic_results AS (
    SELECT
      surah_number,
      ayah_number,
      surah_name_english,
      translation_en,
      search_vector,
      arabic_text,
      1 - (embedding <=> v_semantic_query) AS semantic_rank,
      ROW_NUMBER() OVER (ORDER BY embedding <=> v_semantic_query) AS semantic_rn
    FROM public.quran_ayahs
    WHERE v_semantic_query IS NOT NULL
      AND embedding IS NOT NULL
  ),
  fused AS (
    SELECT
      COALESCE(l.surah_number, s.surah_number) AS surah_number,
      COALESCE(l.ayah_number, s.ayah_number) AS ayah_number,
      COALESCE(l.surah_name_english, s.surah_name_english) AS surah_name_english,
      COALESCE(l.translation_en, s.translation_en) AS translation_en,
      COALESCE(l.search_vector, s.search_vector) AS search_vector,
      COALESCE(l.arabic_text, s.arabic_text) AS arabic_text,
      COALESCE(l.lexical_rank, 0) AS lexical_rank,
      COALESCE(s.semantic_rank, 0) AS semantic_rank,
      -- RRF: 1 / (k + rank) where k=60 is standard
      (p_lexical_weight * COALESCE(1.0 / (60 + l.lexical_rn), 0))
      + (p_semantic_weight * COALESCE(1.0 / (60 + s.semantic_rn), 0)) AS fused_score
    FROM lexical_results l
    FULL OUTER JOIN semantic_results s
      ON l.surah_number = s.surah_number AND l.ayah_number = s.ayah_number
  )
  SELECT
    surah_number,
    ayah_number,
    surah_name_english,
    translation_en,
    search_vector,
    arabic_text,
    lexical_rank,
    semantic_rank,
    fused_score
  FROM fused
  ORDER BY fused_score DESC
  LIMIT p_match_limit;
END;
$$;

-- Keep the original FTS-only function for backward compatibility
-- but update it to use the new schema
CREATE OR REPLACE FUNCTION public.search_quran_ayahs(
  p_search_query text,
  p_match_limit integer DEFAULT 10
)
RETURNS TABLE (
  surah_number integer,
  ayah_number integer,
  surah_name_english text,
  translation_en text,
  search_vector tsvector,
  arabic_text text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    surah_number,
    ayah_number,
    surah_name_english,
    translation_en,
    search_vector,
    arabic_text
  FROM public.quran_ayahs
  WHERE search_vector @@ plainto_tsquery('english', p_search_query)
  ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', p_search_query), 32) DESC
  LIMIT p_match_limit;
END;
$$;

-- Grant execute to service_role only (per lockdown)
REVOKE EXECUTE ON FUNCTION public.search_quran_ayahs_hybrid(text, integer, real, real, vector) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_quran_ayahs_hybrid(text, integer, real, real, vector) TO service_role;

REVOKE EXECUTE ON FUNCTION public.search_quran_ayahs(text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_quran_ayahs(text, integer) TO service_role;

-- Create table for structured evidence (citations with stable IDs)
CREATE TABLE IF NOT EXISTS public.evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('quran', 'hadith', 'scholarly')),
  source_id TEXT NOT NULL, -- e.g., 'quran:2:255', 'hadith:bukhari:1', 'scholar:abu_hanifa:book:chapter'
  title TEXT,
  arabic_text TEXT,
  translation_en TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS evidence_sources_source_id_idx
  ON public.evidence_sources (source_type, source_id);

-- Create table for four-school jurisprudence rulings
CREATE TABLE IF NOT EXISTS public.fiqh_rulings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL, -- e.g., 'dog_ownership', 'prayer_travel', 'riba_loan'
  question_hash TEXT NOT NULL, -- hash of canonical question for deduplication
  school TEXT NOT NULL CHECK (school IN ('hanafi', 'maliki', 'shafi', 'hanbali', 'consensus', 'difference')),
  ruling TEXT NOT NULL, -- 'permissible', 'prohibited', 'disliked', 'recommended', 'obligatory', 'varies'
  evidence_source_ids UUID[] DEFAULT '{}', -- references to evidence_sources
  scholar_references TEXT[], -- e.g., ['Abu Hanifa', 'Al-Quduri']
  notes TEXT,
  confidence REAL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic, school, question_hash)
);

CREATE INDEX IF NOT EXISTS fiqh_rulings_topic_idx ON public.fiqh_rulings (topic);
CREATE INDEX IF NOT EXISTS fiqh_rulings_school_idx ON public.fiqh_rulings (school);

-- Create table for user jurisprudence preferences
CREATE TABLE IF NOT EXISTS public.user_fiqh_preferences (
  device_id TEXT PRIMARY KEY,
  preferred_school TEXT CHECK (preferred_school IN ('hanafi', 'maliki', 'shafi', 'hanbali', 'comparative', 'none')),
  default_view TEXT CHECK (default_view IN ('preferred', 'comparative')) DEFAULT 'preferred',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiqh_rulings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fiqh_preferences ENABLE ROW LEVEL SECURITY;

-- Evidence sources: readable by service_role only (backend)
CREATE POLICY evidence_sources_service_read ON public.evidence_sources
  FOR SELECT TO service_role USING (true);

-- Fiqh rulings: readable by service_role only (backend)
CREATE POLICY fiqh_rulings_service_read ON public.fiqh_rulings
  FOR SELECT TO service_role USING (true);

-- User preferences: device can read/write own
CREATE POLICY user_fiqh_prefs_self ON public.user_fiqh_preferences
  FOR ALL TO anon USING (device_id = current_setting('request.jwt.claims.device_id', true))
  WITH CHECK (device_id = current_setting('request.jwt.claims.device_id', true));

-- Service role can manage all preferences
CREATE POLICY user_fiqh_prefs_service ON public.user_fiqh_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to get user's fiqh preference
CREATE OR REPLACE FUNCTION public.get_user_fiqh_preference(p_device_id TEXT)
RETURNS TABLE (
  preferred_school TEXT,
  default_view TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT preferred_school, default_view
  FROM public.user_fiqh_preferences
  WHERE device_id = p_device_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fiqh_preference(text) TO service_role;

-- Function to upsert user fiqh preference
CREATE OR REPLACE FUNCTION public.set_user_fiqh_preference(
  p_device_id TEXT,
  p_preferred_school TEXT,
  p_default_view TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_fiqh_preferences (device_id, preferred_school, default_view, updated_at)
  VALUES (p_device_id, p_preferred_school, p_default_view, NOW())
  ON CONFLICT (device_id) DO UPDATE SET
    preferred_school = EXCLUDED.preferred_school,
    default_view = EXCLUDED.default_view,
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_fiqh_preference(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_fiqh_preference(text, text, text) TO anon;