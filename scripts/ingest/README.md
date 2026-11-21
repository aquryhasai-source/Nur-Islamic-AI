# Ingestion: authentic hadith + Quran → Supabase (text) and Qdrant (vectors)

Supabase `islamic_texts` is the **single source of truth** for every word shown to a user and for every grade.
Qdrant holds only: the vector, the Supabase row id (as the point id) and a thin filter payload
(`source_type`, `book`, `grade`, `surah_number`). No text is ever duplicated into Qdrant.

## What gets loaded (authenticity policy)

Only **Sahih** and **Hasan** hadith. This is enforced in three places: this script, a DB `CHECK` constraint, and the
search service (which drops anything else at hydration).

| Collection | Rule |
|---|---|
| Sahih al-Bukhari, Sahih Muslim | whole collection accepted as Sahih (agreed-upon collections) |
| Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Muwatta Malik | accepted only if ≥1 grader gave a verdict AND **every** grader who gave one said a clear Sahih/Hasan. A grader who recorded `-` (no verdict) abstains. Lowest grade wins (`Hasan Sahih` → Hasan). Bracketed references like `Sahih Bukhari (98) Sahih Muslim (884)` are fine: it means the hadith also appears in the Sahihayn. |

Rejected on purpose, even though they contain the word "Sahih": `Sahih Isnaad` / `Isnaad Hasan` (chain only, not a verdict
on the text), `Mauquf …` / `Maqtu …` (a Companion's or Successor's report, not a Prophetic hadith), `-` (no verdict),
anything with a weakness term, anything unrecognised. Hadith with no English text are skipped.

Musnad Ahmad, Mustadrak, etc. are **not** loaded: the source has no per-hadith grades for them, and "always authentic"
means we do not guess.

Result on the current source files (fawazahmed0/hadith-api): **26,180 hadith** (22,656 Sahih, 3,524 Hasan) + 6,236 Quran verses.

## Setup

```bash
cd scripts/ingest && npm install
mkdir -p data/hadith && cd data/hadith
for b in bukhari muslim abudawud tirmidhi nasai ibnmajah malik; do
  for l in eng ara; do
    curl -fsSLO "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/$l-$b.min.json"
  done
done
```

1. Apply `supabase/migrations/007_islamic_texts_hybrid_search.sql` (SQL editor or `supabase db push`). It also copies the
   6,236 Quran verses from `quran_ayahs`.
2. Environment (never commit these):

```bash
export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
export QDRANT_URL='https://<cluster>.cloud.qdrant.io:6333'     # trailing slashes are stripped automatically
export QDRANT_API_KEY='…'
export GEMINI_API_KEY='…'                                       # or OPENAI_API_KEY=… (EMBEDDING_PROVIDER=openai)
```

## Run

```bash
node --experimental-strip-types ingest.ts load --dry-run          # counts only, touches nothing
node --experimental-strip-types ingest.ts load                    # files → Supabase (idempotent)
node --experimental-strip-types ingest.ts embed --limit 50        # smoke test: 50 rows → Qdrant
node --experimental-strip-types ingest.ts embed                   # the rest (resumable: only rows with embedded_at IS NULL)
node --experimental-strip-types ingest.ts verify                  # Supabase vs Qdrant counts
```

Flags: `--collections bukhari,muslim`, `--topics-file topics.jsonl`, `--batch-size 50`, `--delay-ms 700`,
`--force-embed` (re-embed everything, e.g. after changing provider/model), `--prune` (delete rows that no longer qualify,
also removes their Qdrant points).

**Same embedding provider + model + 768 dims must be used here and at query time.** Switching provider = re-run with
`--force-embed`.

## What is embedded

* Hadith: `Book. Chapter title. Matn` — the isnad, narrator lead-in, hadith number and grade are **not** embedded.
  The full Arabic text (isnad + matn) stays in `text_ar`; `isnad_ar` is filled only where a safe split was found (~40%).
  "Chapter title" is the *book* (kitab) title: the source files carry no per-chapter (bab) headings.
* Quran: `Surah <name> <n>:<v>. <English translation>` plus `Topic: …` when a topic line exists. Only the clean verse is
  displayed. Topic lines come from an optional JSONL file (`{"ref":"2:255","topic":"…"}`, ≤200 chars each) — none exist yet.

## Tests

```bash
npm test                                                    # pure tests (no DB)
PG_TEST_URL='postgres://…/scratch' npm test                 # + integration tests (DELETES hadith rows: scratch DB only!)
```
