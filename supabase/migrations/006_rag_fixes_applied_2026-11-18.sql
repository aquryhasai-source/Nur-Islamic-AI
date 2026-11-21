-- 006: RAG fixes (applied 2026-11-18)
--
-- 1. Working Quran search. The original search_quran_ayahs_hybrid() failed at
--    runtime with 42702 "column reference surah_number is ambiguous" (output-column
--    names collided with table columns), so Quran retrieval returned nothing. The
--    fixed version is created under a NEW name (_v2) so the currently deployed
--    nur-proxy keeps its behaviour until the new code is promoted. Lexical match
--    is OR-based (ranked), and the semantic half is null-safe (no embeddings yet).
-- 2. ai_response_log: add the columns the proxy already tries to write.
-- 3. Lock down the SECURITY DEFINER fiqh preference RPCs (were callable by anon).

CREATE OR REPLACE FUNCTION public.search_quran_ayahs_hybrid_v2(
  p_search_query     text,
  p_match_limit      integer DEFAULT 10,
  p_lexical_weight   real    DEFAULT 1.0,
  p_semantic_weight  real    DEFAULT 0.0,
  p_query_embedding  vector  DEFAULT NULL
)
RETURNS TABLE(
  surah_number integer, ayah_number integer, surah_name_english text,
  translation_en text, search_vector tsvector, arabic_text text,
  lexical_rank real, semantic_rank real, fused_score real
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_terms text[];
  v_tsq   tsquery;
  v_sem   vector := p_query_embedding;
BEGIN
  -- Up to 12 distinct alphanumeric terms (>= 3 chars), in query order.
  SELECT coalesce(array_agg(x.t ORDER BY x.first_pos), '{}')
    INTO v_terms
  FROM (
    SELECT lower(r.m[1]) AS t, min(r.ord) AS first_pos
    FROM regexp_matches(coalesce(p_search_query, ''), '([A-Za-z0-9]{3,})', 'g')
         WITH ORDINALITY AS r(m, ord)
    GROUP BY lower(r.m[1])
    ORDER BY min(r.ord)
    LIMIT 12
  ) x;

  IF array_length(v_terms, 1) IS NULL THEN
    RETURN;
  END IF;

  v_tsq := to_tsquery('english', array_to_string(v_terms, ' | '));

  RETURN QUERY
  WITH lexical AS (
    SELECT qa.surah_number::int AS s_num, qa.ayah_number::int AS a_num,
           qa.surah_name_english AS s_name, qa.translation_en AS t_en,
           qa.search_vector AS s_vec, qa.arabic_text AS a_txt,
           ts_rank_cd(qa.search_vector, v_tsq, 32)::real AS lex_rank,
           row_number() OVER (ORDER BY ts_rank_cd(qa.search_vector, v_tsq, 32) DESC, qa.id) AS lex_rn
    FROM public.quran_ayahs qa
    WHERE qa.search_vector @@ v_tsq
  ),
  semantic AS (
    SELECT qa.surah_number::int AS s_num, qa.ayah_number::int AS a_num,
           qa.surah_name_english AS s_name, qa.translation_en AS t_en,
           qa.search_vector AS s_vec, qa.arabic_text AS a_txt,
           (1 - (qa.embedding <=> v_sem))::real AS sem_rank,
           row_number() OVER (ORDER BY qa.embedding <=> v_sem, qa.id) AS sem_rn
    FROM public.quran_ayahs qa
    WHERE v_sem IS NOT NULL AND qa.embedding IS NOT NULL
  ),
  fused AS (
    SELECT coalesce(l.s_num, s.s_num)   AS s_num,
           coalesce(l.a_num, s.a_num)   AS a_num,
           coalesce(l.s_name, s.s_name) AS s_name,
           coalesce(l.t_en,  s.t_en)    AS t_en,
           coalesce(l.s_vec, s.s_vec)   AS s_vec,
           coalesce(l.a_txt, s.a_txt)   AS a_txt,
           coalesce(l.lex_rank, 0)::real AS lex_rank,
           coalesce(s.sem_rank, 0)::real AS sem_rank,
           ( p_lexical_weight  * coalesce(1.0 / (60 + l.lex_rn), 0)
           + p_semantic_weight * coalesce(1.0 / (60 + s.sem_rn), 0) )::real AS fused
    FROM lexical l
    FULL OUTER JOIN semantic s ON l.s_num = s.s_num AND l.a_num = s.a_num
  )
  SELECT f.s_num, f.a_num, f.s_name, f.t_en, f.s_vec, f.a_txt, f.lex_rank, f.sem_rank, f.fused
  FROM fused f
  ORDER BY f.fused DESC, f.s_num, f.a_num
  LIMIT p_match_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_quran_ayahs_hybrid_v2(text, integer, real, real, vector) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_quran_ayahs_hybrid_v2(text, integer, real, real, vector) TO service_role;

-- 2. Logging columns written by nur-proxy (previously missing, so every insert failed)
ALTER TABLE public.ai_response_log
  ADD COLUMN IF NOT EXISTS verification_results jsonb,
  ADD COLUMN IF NOT EXISTS abstained boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS school_context text;

-- 3. Preference RPCs are only called by nur-proxy using the service role.
REVOKE ALL ON FUNCTION public.get_user_fiqh_preference(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_fiqh_preference(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_fiqh_preference(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_fiqh_preference(text, text, text) TO service_role;
