-- 007_islamic_texts_hybrid_search.sql
--
-- Unified Quran + authentic-Hadith table that is the SINGLE SOURCE OF TRUTH for text.
-- Qdrant (vector search) stores only vectors + this table's `id` + light filter fields;
-- every citation shown to a user or passed to the LLM is hydrated from THIS table.
--
-- Design rules
--   * Authentic only, enforced by the database: a hadith row cannot exist unless
--     grade IN ('Sahih','Hasan') (see islamic_texts_shape). Weak/fabricated rows are refused.
--   * `text_ar` / `text_en` are stored exactly as sourced. Isnad stripping happens ONLY when
--     building the embedding input (ingestion script); it never alters displayed text.
--   * `topic_summary` and `aliases` are retrieval aids. They are NEVER returned by
--     get_islamic_texts_by_ids() so they can never be shown or cited as tafsir/scholarship.
--   * RLS on, no anon/authenticated access; only service_role (nur-proxy, ingestion) can read.
--
-- Run AFTER 006. Does not touch quran_ayahs (its unused `embedding` column/index from 005 are left as-is).
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.islamic_texts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- also the Qdrant point id
  source_type    text     NOT NULL CHECK (source_type IN ('quran', 'hadith')),

  -- identity / citation
  collection     text     NOT NULL,        -- 'quran' | 'bukhari' | 'muslim' | 'abudawud' | 'tirmidhi' | 'nasai' | 'ibnmajah' | 'malik' ...
  ref            text     NOT NULL,        -- quran: '2:255'   hadith: global hadith number as text ('1', '402.2')
  ref_label      text     NOT NULL,        -- 'Quran 2:255 (Al-Baqarah)' / 'Sahih al-Bukhari 1'

  -- quran
  surah_number   smallint,
  ayah_number    smallint,
  surah_name     text,

  -- hadith
  book_name      text,                     -- 'Sahih al-Bukhari'
  book_no        smallint,                 -- book (kitab) number inside the collection
  chapter_title  text,                     -- title of that book/section, e.g. 'The Book of Purification'
  grade          text,                     -- 'Sahih' | 'Hasan' (hadith only)
  grade_sources  text,                     -- audit trail, e.g. 'collection: Sahih al-Bukhari' / 'all graders agree: Al-Albani, Zubair Ali Zai'

  -- content (as sourced)
  text_ar        text,                     -- full Arabic as sourced (isnad + matn)
  text_en        text     NOT NULL,        -- full English as sourced
  isnad_ar       text,                     -- extracted Arabic chain; NULL when no confident split
  narrator_en    text,                     -- English narrator lead-in, e.g. 'Narrated Ibn Abbas'

  -- retrieval aids (never hydrated to the LLM / UI)
  topic_summary  text,                     -- 1-line topic label; retrieval only
  aliases        text,                     -- 'ayat al kursi throne verse ...'

  -- ingestion bookkeeping
  content_hash   uuid,                     -- md5 of the embedding input; re-embed when it changes
  embedded_at    timestamptz,              -- NULL = not yet in Qdrant
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- lexical search vector (A: reference/aliases, B: topic/chapter/book, C: narrator + English text)
  fts tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(ref_label, '') || ' ' || coalesce(aliases, '')), 'A')
   || setweight(to_tsvector('english', coalesce(topic_summary, '') || ' ' || coalesce(chapter_title, '') || ' ' || coalesce(book_name, '')), 'B')
   || setweight(to_tsvector('english', coalesce(narrator_en, '') || ' ' || text_en), 'C')
  ) STORED,

  CONSTRAINT islamic_texts_ref_uq UNIQUE (collection, ref),
  CONSTRAINT islamic_texts_text_nonempty CHECK (length(btrim(text_en)) > 0),
  CONSTRAINT islamic_texts_shape CHECK (
       (source_type = 'quran'  AND collection = 'quran' AND surah_number IS NOT NULL
                               AND ayah_number IS NOT NULL AND grade IS NULL)
    OR (source_type = 'hadith' AND collection <> 'quran' AND book_name IS NOT NULL
                               -- explicit IS NOT NULL: a CHECK that evaluates to NULL PASSES in SQL, so a NULL grade
                               -- would otherwise slip through `grade IN (...)`.
                               AND grade IS NOT NULL AND grade IN ('Sahih', 'Hasan'))
  )
);

COMMENT ON TABLE public.islamic_texts IS
  'Single source of truth for Quran verses and authentic (Sahih/Hasan only) hadith. Qdrant holds vectors + id only; all citations hydrate from here.';
COMMENT ON COLUMN public.islamic_texts.topic_summary IS
  'Retrieval-only topic label (may be machine-generated). Never shown to users, never cited, never passed to the LLM as evidence.';

CREATE INDEX IF NOT EXISTS islamic_texts_fts_idx ON public.islamic_texts USING gin (fts);

-- ---------------------------------------------------------------------------
-- 2. Lock-down (same pattern as the other tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.islamic_texts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'islamic_texts' AND policyname = 'service role full access') THEN
    CREATE POLICY "service role full access" ON public.islamic_texts
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

REVOKE ALL ON public.islamic_texts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lexical search RPC
--    Returns ranked ids + scores. Handles, in order:
--      a) exact references   "Surah 2:255", "quran 2:255-257", "surah 2 ayah 255", "2:255",
--                            "Bukhari 1", "Sahih Muslim 402", "abu dawud 5"      -> match_kind 'reference'
--      b) ranked keyword search (OR of up to 12 terms; rows matching ALL terms rank first,
--         alias names such as "ayat al kursi" are matched through `aliases`)     -> match_kind 'text'
--    NOTE: plain "N:M" is treated as a Quran reference only when the whole query is that
--    reference or a cue word (surah/ayah/verse/quran) precedes it, so "prayer at 5:30" is not.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_islamic_texts_lexical(
  query_text    text,
  match_count   integer DEFAULT 15,
  source_filter text    DEFAULT NULL
)
RETURNS TABLE (id bigint, score real, match_kind text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
DECLARE
  v_q        text := lower(btrim(coalesce(query_text, '')));
  v_n        int  := greatest(1, least(coalesce(match_count, 15), 50));
  v_rest     text;
  v_m        text[];
  v_surah    int;
  v_from     int;
  v_to       int;
  v_coll     text;
  v_hno      text;
  v_terms    text[];
  v_specific text[];
  v_or       tsquery;
  v_and      tsquery;

  -- Words that occur in a large share of all hadith ("The Prophet said ..."). ts_rank_cd has no IDF, so left in an
  -- OR query they outrank the rare, meaningful words. Dropped only when at least one other term remains.
  c_common     constant text[] := ARRAY['said','say','says','saying','told','tell','prophet','messenger','allah',
                                        'narrated','reported','people','islam','islamic','also','would','will'];

  -- reference patterns
  c_quran_cue  constant text := '\m(?:surah|sura|surat|soorah|quran|qur.an|ayah|aya|ayat|verse|q)\M\s*\.?\s*#?\s*(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?';
  c_quran_bare constant text := '^\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*$';
  c_quran_long constant text := '\m(?:surah|sura)\M\s*#?\s*(\d{1,3})\s*[,;]?\s*(?:ayah|aya|ayat|verse)\M\s*#?\s*(\d{1,3})';
  c_hadith     constant text := '\m(bukhari|muslim|tirmidhi|abu\s*dawud|abudawud|nasa.?i|ibn\s*majah|ibnmajah|malik|muwatta)\M\s*(?:hadith|hadees|no\.?|number|#|:)?\s*(\d{1,5}(?:\.\d+)?)';
BEGIN
  IF v_q = '' THEN
    RETURN;
  END IF;

  v_rest := v_q;

  -- ---- a) Quran reference ---------------------------------------------------
  v_m := regexp_match(v_q, c_quran_long);
  IF v_m IS NOT NULL THEN
    v_surah := v_m[1]::int; v_from := v_m[2]::int; v_to := v_from;
    v_rest := regexp_replace(v_rest, c_quran_long, ' ', 'g');
  ELSE
    v_m := regexp_match(v_q, c_quran_cue);
    IF v_m IS NULL THEN
      v_m := regexp_match(v_q, c_quran_bare);
      IF v_m IS NOT NULL THEN v_rest := regexp_replace(v_rest, c_quran_bare, ' ', 'g'); END IF;
    ELSE
      v_rest := regexp_replace(v_rest, c_quran_cue, ' ', 'g');
    END IF;
    IF v_m IS NOT NULL THEN
      v_surah := v_m[1]::int; v_from := v_m[2]::int; v_to := coalesce(v_m[3]::int, v_from);
    END IF;
  END IF;
  IF v_surah IS NOT NULL AND (v_surah < 1 OR v_surah > 114 OR v_from < 1 OR v_to < v_from) THEN
    v_surah := NULL;  -- not a plausible reference; fall through to keyword search
    v_rest := v_q;
  END IF;

  -- ---- a2) Hadith reference ---------------------------------------------------
  v_m := regexp_match(v_q, c_hadith);
  IF v_m IS NOT NULL THEN
    v_coll := CASE
      WHEN v_m[1] ~ '^abu' THEN 'abudawud'
      WHEN v_m[1] ~ '^abudawud' THEN 'abudawud'
      WHEN v_m[1] ~ '^nasa' THEN 'nasai'
      WHEN v_m[1] ~ '^ibn' THEN 'ibnmajah'
      WHEN v_m[1] IN ('malik', 'muwatta') THEN 'malik'
      ELSE v_m[1]
    END;
    v_hno := v_m[2];
    v_rest := regexp_replace(v_rest, c_hadith, ' ', 'g');
  END IF;

  -- A recognised reference ("Sahih Muslim 8") must not fall through to a keyword search on the leftover book-name
  -- words ("sahih") and return unrelated hadith. Drop those filler words; anything the user added on top
  -- ("Bukhari 1 patience") still searches.
  IF v_surah IS NOT NULL OR v_hno IS NOT NULL THEN
    v_rest := regexp_replace(v_rest,
      '\m(?:sahih|sunan|jami|jame|abi|abu|ibn|dawud|majah|hadith|hadees|number|imam|the|nasa.?i|muwatta|quran|verse|ayah|surah|sura)\M',
      ' ', 'g');
  END IF;

  -- ---- b) keyword query -------------------------------------------------------
  SELECT coalesce(array_agg(x.t ORDER BY x.first_pos), '{}')
    INTO v_terms
  FROM (
    SELECT lower(r.m[1]) AS t, min(r.ord) AS first_pos
    FROM regexp_matches(v_rest, '([a-z0-9]{3,})', 'g') WITH ORDINALITY AS r(m, ord)
    GROUP BY lower(r.m[1])
    ORDER BY min(r.ord)
    LIMIT 12
  ) x;

  SELECT coalesce(array_agg(u.t ORDER BY u.ord), '{}') INTO v_specific
  FROM unnest(v_terms) WITH ORDINALITY AS u(t, ord)
  WHERE u.t <> ALL (c_common);
  IF array_length(v_specific, 1) IS NOT NULL THEN
    v_terms := v_specific;
  END IF;

  IF array_length(v_terms, 1) IS NOT NULL THEN
    v_or  := to_tsquery('english', array_to_string(v_terms, ' | '));
    v_and := to_tsquery('english', array_to_string(v_terms, ' & '));
  END IF;

  RETURN QUERY
  WITH refs AS (
    SELECT t.id, 10.0::real AS score, 'reference'::text AS match_kind, 0 AS ord
    FROM public.islamic_texts t
    WHERE v_surah IS NOT NULL
      AND t.collection = 'quran'
      AND t.surah_number = v_surah
      AND t.ayah_number BETWEEN v_from AND least(v_to, v_from + 9)
      AND (source_filter IS NULL OR t.source_type = source_filter)
    UNION ALL
    SELECT t.id, 10.0::real, 'reference'::text, 0
    FROM public.islamic_texts t
    WHERE v_coll IS NOT NULL
      AND t.collection = v_coll
      AND t.ref = v_hno
      AND (source_filter IS NULL OR t.source_type = source_filter)
  ),
  lex AS (
    SELECT t.id,
           (ts_rank_cd(t.fts, v_or, 32)
            + CASE WHEN t.fts @@ v_and THEN 1.0 ELSE 0.0 END)::real AS score,
           'text'::text AS match_kind, 1 AS ord
    FROM public.islamic_texts t
    WHERE v_or IS NOT NULL
      AND t.fts @@ v_or
      AND (source_filter IS NULL OR t.source_type = source_filter)
    ORDER BY 2 DESC, t.id
    LIMIT v_n
  ),
  merged AS (
    SELECT DISTINCT ON (u.id) u.id, u.score, u.match_kind, u.ord
    FROM (SELECT * FROM refs UNION ALL SELECT * FROM lex) u
    ORDER BY u.id, u.ord, u.score DESC
  )
  SELECT m.id, m.score, m.match_kind
  FROM merged m
  ORDER BY m.ord, m.score DESC, m.id
  LIMIT v_n;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Hydration RPC (single query, WHERE id = ANY(...)).
--    Deliberately omits topic_summary, aliases, fts and bookkeeping columns.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_islamic_texts_by_ids(p_ids bigint[])
RETURNS TABLE (
  id bigint, source_type text, collection text, ref text, ref_label text,
  surah_number smallint, ayah_number smallint, surah_name text,
  book_name text, chapter_title text, grade text,
  text_ar text, text_en text, isnad_ar text, narrator_en text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT t.id, t.source_type, t.collection, t.ref, t.ref_label,
         t.surah_number, t.ayah_number, t.surah_name,
         t.book_name, t.chapter_title, t.grade,
         t.text_ar, t.text_en, t.isnad_ar, t.narrator_en
  FROM public.islamic_texts t
  WHERE t.id = ANY (p_ids);
$function$;

REVOKE EXECUTE ON FUNCTION public.search_islamic_texts_lexical(text, integer, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.search_islamic_texts_lexical(text, integer, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_islamic_texts_by_ids(bigint[]) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_islamic_texts_by_ids(bigint[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Seed the 6,236 Quran rows from the already-curated quran_ayahs table
--    (Sahih International text; no new content is introduced). Idempotent.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.quran_ayahs') IS NOT NULL THEN
    INSERT INTO public.islamic_texts
      (source_type, collection, ref, ref_label, surah_number, ayah_number, surah_name, text_ar, text_en)
    SELECT DISTINCT ON (q.surah_number, q.ayah_number)
           'quran', 'quran',
           q.surah_number || ':' || q.ayah_number,
           'Quran ' || q.surah_number || ':' || q.ayah_number
             || ' (' || coalesce(q.surah_name_transliteration, q.surah_name_english) || ')',
           q.surah_number, q.ayah_number,
           coalesce(q.surah_name_transliteration, q.surah_name_english),
           q.arabic_text, q.translation_en
    FROM public.quran_ayahs q
    WHERE q.translation_en IS NOT NULL AND length(btrim(q.translation_en)) > 0
    ORDER BY q.surah_number, q.ayah_number, q.translation_source
    ON CONFLICT (collection, ref) DO NOTHING;
  END IF;
END $$;

-- Search aliases for a few very commonly requested verses (retrieval only).
UPDATE public.islamic_texts t
SET aliases = v.aliases
FROM (VALUES
  ('2:255',  'ayat al kursi ayatul kursi ayat al-kursi throne verse verse of the throne'),
  ('24:35',  'ayat an nur ayat al-nur light verse verse of light'),
  ('2:285',  'last two verses of surah baqarah amana rasul'),
  ('2:286',  'last two verses of surah baqarah amana rasul'),
  ('2:282',  'ayat ad dayn verse of debt longest verse'),
  ('59:22',  'last three verses of surah hashr'),
  ('59:23',  'last three verses of surah hashr'),
  ('59:24',  'last three verses of surah hashr'),
  ('33:56',  'verse of salawat sending blessings on the prophet')
) AS v(ref, aliases)
WHERE t.collection = 'quran' AND t.ref = v.ref AND t.aliases IS DISTINCT FROM v.aliases;
