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

Needs Node **22.6 or newer** (`node --version`). Then, from the repository root:

```bash
cd scripts/ingest
npm install
npm run download            # 14 files into ./data/hadith (re-run any time; finished files are skipped)
```

1. Apply `supabase/migrations/007_islamic_texts_hybrid_search.sql` (already done if `islamic_texts` exists).
2. Environment (never commit these). Bash / macOS / Linux:

```bash
export DATABASE_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres'   # Supabase → Connect → Session pooler
export QDRANT_URL='https://<cluster>.cloud.qdrant.io:6333'     # trailing slashes are stripped automatically
export QDRANT_API_KEY='…'
export GEMINI_API_KEY='…'                                       # or OPENAI_API_KEY=… and EMBEDDING_PROVIDER=openai
```

   Windows PowerShell: `$env:DATABASE_URL='…'` (same names, one line each).

## Run

```bash
node --experimental-strip-types ingest.ts load --dry-run   # counts only, touches nothing
node --experimental-strip-types ingest.ts load             # files → Supabase (safe to repeat; unchanged rows are skipped)
node --experimental-strip-types ingest.ts init             # creates the Qdrant collection + indexes (safe to repeat)
node --experimental-strip-types ingest.ts embed --dry-run  # how many rows, ~tokens and ~time; sends nothing
node --experimental-strip-types ingest.ts embed --limit 100   # smoke test: first 100 rows only
node --experimental-strip-types ingest.ts verify              # Supabase vs Qdrant counts
node --experimental-strip-types ingest.ts embed               # everything else (hours; safe to stop and restart)
node --experimental-strip-types ingest.ts verify
```

### How embedding is paced and resumed

* **Gemini `batchEmbedContents`, up to 100 texts per call**, `outputDimensionality` 768, vectors L2-normalised.
* **Token budget: 25,000 tokens per rolling minute** (`--tpm N`, `0` = off). Tokens are estimated at 3.5 characters each
  (slightly pessimistic, so the real rate is a little under the budget). A call is also capped at half a minute's budget, so
  a batch of very long hadith is split rather than breaking the quota; expect a few hundred calls rather than exactly 325.
* **429 / 5xx**: exponential backoff, 5 s, 10 s, 20 s, 40 s, 60 s… for rate limits (1 s, 2 s, 4 s… for server errors),
  up to `--max-attempts` (default 8) per call; a `Retry-After` header wins. Invalid-key / bad-request errors stop at once.
* **Resumable**: every call is *embed → write to Qdrant → mark `embedded_at` in Supabase*. Stop it (Ctrl-C), lose the
  connection or run out of quota, and the next `embed` carries on with rows that have no `embedded_at`.
* **Appendable**: to add books later, `load --collections <slug>` then `embed`. Only the new rows are sent to Gemini; the
  existing vectors are untouched and go into the same Qdrant collection. `load` also re-queues a row automatically if its
  text changed.
* Full corpus is roughly 3.7 million tokens: **about 2½ hours** at 25,000 tokens/minute. Keep the computer awake and online.

Other flags: `--collections bukhari,muslim`, `--topics-file topics.jsonl`, `--batch-size 100`,
`--force-embed` (re-embed everything), `--prune` (delete rows that no longer qualify, and their Qdrant points).

**Use one embedding model for the whole collection.** Vectors from different models (or dimensions) are not comparable. If
you ever switch provider or model, run `embed --force-embed` so every row is re-embedded with the new one.

## What is embedded

* Hadith: `Book. Chapter title. Matn` — the isnad, narrator lead-in, hadith number and grade are **not** embedded.
  The full Arabic text (isnad + matn) stays in `text_ar`; `isnad_ar` is filled only where a safe split was found (~40%).
  "Chapter title" is the *book* (kitab) title: the source files carry no per-chapter (bab) headings.
* Quran: `Surah <name> <n>:<v>. <English translation>` plus `Topic: …` when a topic line exists. Only the clean verse is
  displayed. Topic lines come from an optional JSONL file (`{"ref":"2:255","topic":"…"}`, ≤200 chars each) — none exist yet.

## Tests

```bash
npm test                                                    # pure tests (no DB): grading, splitting, throttle, backoff
PG_TEST_URL='postgres://…/scratch' npm test                 # + integration tests (DELETES hadith rows: scratch DB only!)
```
