// ingest.ts — authentic hadith + Quran -> Supabase (text, source of truth) and Qdrant (vectors only).
//
//   node --experimental-strip-types ingest.ts load   --hadith-dir ./data/hadith      # files -> Supabase (+ Quran topics, hashes)
//   node --experimental-strip-types ingest.ts embed                                  # Supabase rows with embedded_at IS NULL -> Qdrant
//   node --experimental-strip-types ingest.ts all
//   node --experimental-strip-types ingest.ts verify                                 # counts in both stores
//
// Safe to re-run: load upserts on (collection, ref) and only resets embedded_at when the embedding input changed;
// embed only touches rows that are not yet embedded (or everything with --force-embed).
//
// Env: DATABASE_URL (Supabase Postgres connection string), QDRANT_URL, QDRANT_API_KEY, GEMINI_API_KEY | OPENAI_API_KEY
//      optional: EMBEDDING_PROVIDER, EMBEDDING_MODEL, QDRANT_COLLECTION

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import {
  COLLECTIONS, loadHadithCollection, embedText, contentHash,
  type CollectionInfo, type HadithRow, type LoadStats,
} from "./preprocess.ts";
import {
  createQdrantClient, qdrantConfigFromEnv, QdrantError,
  type QdrantClient, type QdrantPoint, type ThinPayload,
} from "../../supabase/functions/nur-proxy/qdrant.ts";
import { embeddingProviderFromEnv, EmbeddingError, type EmbeddingProvider } from "../../supabase/functions/nur-proxy/embeddings.ts";

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}
type Log = (msg: string) => void;
const noop: Log = () => {};

const sleepReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Retry with backoff (429 / 5xx / timeouts / network)
// ---------------------------------------------------------------------------------------------
function isRetryable(err: unknown): { retry: boolean; waitMs?: number } {
  if (err instanceof EmbeddingError) {
    const st = err.status;
    return { retry: st === undefined || st === 429 || st >= 500, waitMs: err.retryAfterMs };
  }
  if (err instanceof QdrantError) {
    return { retry: err.kind === "timeout" || err.kind === "network" || err.status === 429 || (err.status ?? 0) >= 500 };
  }
  return { retry: false };
}

export async function withRetry<T>(
  fn: () => Promise<T>, o: { attempts?: number; sleep?: (ms: number) => Promise<void>; log?: Log; what?: string } = {},
): Promise<T> {
  const attempts = o.attempts ?? 6;
  const sleep = o.sleep ?? sleepReal;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const { retry, waitMs } = isRetryable(err);
      if (!retry || i >= attempts) throw err;
      const wait = Math.min(60_000, waitMs ?? 1000 * 2 ** (i - 1));
      (o.log ?? noop)(`  retry ${i}/${attempts - 1} for ${o.what ?? "call"} in ${Math.round(wait / 1000)}s: ${(err as Error).message}`);
      await sleep(wait);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// LOAD: hadith files -> Supabase
// ---------------------------------------------------------------------------------------------
const UPSERT_HADITH = `
INSERT INTO public.islamic_texts
  (source_type, collection, ref, ref_label, book_name, book_no, chapter_title, grade, grade_sources,
   text_ar, text_en, isnad_ar, narrator_en, content_hash)
SELECT 'hadith', * FROM unnest(
  $1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::text[], $8::text[],
  $9::text[], $10::text[], $11::text[], $12::text[], $13::uuid[])
ON CONFLICT (collection, ref) DO UPDATE SET
  ref_label = EXCLUDED.ref_label, book_name = EXCLUDED.book_name, book_no = EXCLUDED.book_no,
  chapter_title = EXCLUDED.chapter_title, grade = EXCLUDED.grade, grade_sources = EXCLUDED.grade_sources,
  text_ar = EXCLUDED.text_ar, text_en = EXCLUDED.text_en, isnad_ar = EXCLUDED.isnad_ar,
  narrator_en = EXCLUDED.narrator_en,
  embedded_at = CASE WHEN public.islamic_texts.content_hash IS DISTINCT FROM EXCLUDED.content_hash
                     THEN NULL ELSE public.islamic_texts.embedded_at END,
  content_hash = EXCLUDED.content_hash
WHERE (public.islamic_texts.text_en, public.islamic_texts.text_ar, public.islamic_texts.grade,
       public.islamic_texts.grade_sources, public.islamic_texts.chapter_title, public.islamic_texts.book_no,
       public.islamic_texts.isnad_ar, public.islamic_texts.narrator_en, public.islamic_texts.content_hash)
      IS DISTINCT FROM
      (EXCLUDED.text_en, EXCLUDED.text_ar, EXCLUDED.grade, EXCLUDED.grade_sources, EXCLUDED.chapter_title,
       EXCLUDED.book_no, EXCLUDED.isnad_ar, EXCLUDED.narrator_en, EXCLUDED.content_hash)`;

export async function upsertHadithBatch(db: Queryable, rows: HadithRow[]): Promise<number> {
  if (!rows.length) return 0;
  const col = <T>(f: (r: HadithRow) => T) => rows.map(f);
  const res = await db.query(UPSERT_HADITH, [
    col((r) => r.collection), col((r) => r.ref), col((r) => r.refLabel), col((r) => r.bookName),
    col((r) => r.bookNo), col((r) => r.chapterTitle), col((r) => r.grade), col((r) => r.gradeSources),
    col((r) => r.textAr), col((r) => r.textEn), col((r) => r.isnadAr), col((r) => r.narratorEn), col((r) => r.contentHash),
  ]);
  return res.rowCount ?? 0;
}

export interface LoadOptions {
  db: Queryable;
  dir: string;
  collections?: string[];       // slugs; default all
  limit?: number;               // per collection (smoke tests)
  dryRun?: boolean;
  prune?: boolean;              // delete rows of the loaded collections that no longer qualify
  batchSize?: number;
  log?: Log;
}

export interface LoadResult {
  stats: LoadStats[];
  written: number;
  prunedIds: number[];
}

export async function runLoadHadith(o: LoadOptions): Promise<LoadResult> {
  const log = o.log ?? noop;
  if (o.prune && o.limit) throw new Error("--prune cannot be combined with --limit (it would delete everything past the limit)");
  const wanted = o.collections?.length ? COLLECTIONS.filter((c) => o.collections!.includes(c.slug)) : [...COLLECTIONS];
  if (o.collections?.length && wanted.length !== o.collections.length) {
    const known = COLLECTIONS.map((c) => c.slug).join(", ");
    throw new Error(`unknown collection in --collections (known: ${known})`);
  }
  const result: LoadResult = { stats: [], written: 0, prunedIds: [] };
  for (const c of wanted as CollectionInfo[]) {
    const { rows: all, stats } = loadHadithCollection(o.dir, c);
    const rows = o.limit ? all.slice(0, o.limit) : all;
    result.stats.push(stats);
    log(`${c.slug}: ${stats.total} in file -> ${stats.accepted} authentic (skipped: ${stats.skippedEmptyEnglish} empty English, ` +
      `${stats.skippedNoGrades} ungraded, ${stats.skippedNotAllAuthentic} not unanimously Sahih/Hasan, ${stats.skippedDuplicateRef} duplicate)`);
    if (o.dryRun) continue;
    const size = o.batchSize ?? 500;
    for (let i = 0; i < rows.length; i += size) result.written += await upsertHadithBatch(o.db, rows.slice(i, i + size));
    if (o.prune) {
      const keep = rows.map((r) => r.ref);
      const del = await o.db.query(
        `DELETE FROM public.islamic_texts WHERE collection = $1 AND NOT (ref = ANY($2::text[])) RETURNING id`, [c.slug, keep],
      );
      for (const r of del.rows) result.prunedIds.push(Number(r.id));
      if (del.rowCount) log(`  pruned ${del.rowCount} ${c.slug} rows that no longer qualify`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// LOAD: Quran rows (seeded by migration 007) — apply optional topic file, refresh content hashes
// ---------------------------------------------------------------------------------------------
/** JSONL: {"ref":"2:255","topic":"..."} — retrieval-only, one line each, never shown to users. */
export function parseTopicsJsonl(text: string): Map<string, string> {
  const out = new Map<string, string>();
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let obj: { ref?: unknown; topic?: unknown };
    try { obj = JSON.parse(line); } catch { throw new Error(`topics file line ${i + 1}: invalid JSON`); }
    if (typeof obj.ref !== "string" || !/^\d{1,3}:\d{1,3}$/.test(obj.ref)) throw new Error(`topics file line ${i + 1}: "ref" must look like 2:255`);
    if (typeof obj.topic !== "string" || !obj.topic.trim()) throw new Error(`topics file line ${i + 1}: "topic" is empty`);
    if (obj.topic.length > 200) throw new Error(`topics file line ${i + 1}: topic longer than 200 chars (keep it to one line)`);
    out.set(obj.ref, obj.topic.trim());
  });
  return out;
}

export async function runSyncQuran(
  o: { db: Queryable; topics?: Map<string, string>; dryRun?: boolean; log?: Log },
): Promise<{ quranRows: number; changed: number; topicsApplied: number }> {
  const log = o.log ?? noop;
  const res = await o.db.query(
    `SELECT id, ref, surah_name, surah_number, ayah_number, text_en, topic_summary, content_hash
       FROM public.islamic_texts WHERE source_type = 'quran' ORDER BY id`,
  );
  const ids: number[] = [], topics: (string | null)[] = [], hashes: string[] = [];
  let topicsApplied = 0;
  for (const r of res.rows) {
    const topic: string | null = o.topics?.get(r.ref) ?? r.topic_summary ?? null;
    if (o.topics?.has(r.ref)) topicsApplied++;
    const h = contentHash(embedText({
      sourceType: "quran", textEn: r.text_en, surahName: r.surah_name, surahNumber: r.surah_number, ayahNumber: r.ayah_number, topicSummary: topic,
    }));
    if (h !== r.content_hash || topic !== r.topic_summary) { ids.push(Number(r.id)); topics.push(topic); hashes.push(h); }
  }
  log(`quran: ${res.rows.length} rows, ${ids.length} need (re)hash${o.topics ? `, ${topicsApplied} topic lines matched` : ""}`);
  if (!o.dryRun && ids.length) {
    await o.db.query(
      `UPDATE public.islamic_texts t
          SET topic_summary = v.topic, content_hash = v.h,
              embedded_at = CASE WHEN t.content_hash IS DISTINCT FROM v.h THEN NULL ELSE t.embedded_at END
         FROM unnest($1::bigint[], $2::text[], $3::uuid[]) AS v(id, topic, h)
        WHERE t.id = v.id`,
      [ids, topics, hashes],
    );
  }
  return { quranRows: res.rows.length, changed: ids.length, topicsApplied };
}

// ---------------------------------------------------------------------------------------------
// EMBED: Supabase -> Qdrant (thin payload only)
// ---------------------------------------------------------------------------------------------
export interface EmbedOptions {
  db: Queryable;
  qdrant: QdrantClient;
  embedder: EmbeddingProvider;
  batchSize?: number;           // texts per embedding call / Qdrant upsert (default 50)
  limit?: number;               // stop after N rows (smoke test)
  force?: boolean;              // re-embed rows that already have embedded_at
  dryRun?: boolean;
  delayMs?: number;             // pause between batches (free-tier rate limits)
  sleep?: (ms: number) => Promise<void>;
  log?: Log;
}

export interface EmbedResult { embedded: number; batches: number; pending: number }

/** The ONLY things Qdrant is allowed to hold besides the vector. No text, ever. */
export function thinPayload(r: { source_type: string; collection: string; grade: string | null; surah_number: number | null }): ThinPayload {
  if (r.source_type === "quran") {
    if (r.surah_number == null) throw new Error("quran row without surah_number");
    return { source_type: "quran", surah_number: Number(r.surah_number) };
  }
  if (r.source_type === "hadith") {
    // Never send a vector for a hadith that is not Sahih/Hasan, even though the DB CHECK already forbids it.
    if (r.grade !== "Sahih" && r.grade !== "Hasan") throw new Error("refusing to embed a hadith without a Sahih/Hasan grade");
    return { source_type: "hadith", book: r.collection, grade: r.grade };
  }
  throw new Error(`unknown source_type ${r.source_type}`);
}

export async function runEmbed(o: EmbedOptions): Promise<EmbedResult> {
  const log = o.log ?? noop;
  const sleep = o.sleep ?? sleepReal;
  const batch = Math.max(1, Math.min(o.batchSize ?? 50, 100));

  const cnt = await o.db.query(
    `SELECT count(*)::int AS n FROM public.islamic_texts WHERE ($1::boolean OR embedded_at IS NULL)`, [!!o.force],
  );
  const pending: number = cnt.rows[0].n;
  log(`embed: ${pending} rows ${o.force ? "(force)" : "pending"}; provider ${o.embedder.name}; collection ${o.qdrant.collection}`);
  if (o.dryRun || pending === 0) return { embedded: 0, batches: 0, pending };

  if (!(await o.qdrant.collectionExists())) {
    log("creating Qdrant collection (768-d cosine, int8 scalar quantisation) + payload indexes");
    await o.qdrant.createCollection();
    await o.qdrant.createPayloadIndexes();
  }

  let last = 0, embedded = 0, batches = 0;
  const cap = o.limit ?? Infinity;
  while (embedded < cap) {
    const take = Math.min(batch, cap - embedded);
    const page = await o.db.query(
      `SELECT id, source_type, collection, grade, surah_number, ayah_number, surah_name, book_name, chapter_title, text_en, topic_summary
         FROM public.islamic_texts WHERE id > $1 AND ($2::boolean OR embedded_at IS NULL) ORDER BY id LIMIT $3`,
      [last, !!o.force, take],
    );
    if (!page.rows.length) break;
    const rows = page.rows;
    last = Number(rows[rows.length - 1].id);

    const inputs = rows.map((r) => embedText({
      sourceType: r.source_type, textEn: r.text_en, surahName: r.surah_name, surahNumber: r.surah_number,
      ayahNumber: r.ayah_number, topicSummary: r.topic_summary, bookName: r.book_name, chapterTitle: r.chapter_title,
    }));
    if (inputs.some((t) => !t)) throw new Error(`empty embedding input for a row in id range ..${last}`);

    const vectors = await withRetry(() => o.embedder.embed(inputs, "document"), { sleep, log, what: "embedding batch" });
    const points: QdrantPoint[] = rows.map((r, i) => ({ id: Number(r.id), vector: vectors[i], payload: thinPayload(r) }));
    await withRetry(() => o.qdrant.upsert(points), { sleep, log, what: "qdrant upsert" });

    await o.db.query(
      `UPDATE public.islamic_texts t SET embedded_at = now(), content_hash = v.h
         FROM unnest($1::bigint[], $2::uuid[]) AS v(id, h) WHERE t.id = v.id`,
      [rows.map((r) => Number(r.id)), inputs.map(contentHash)],
    );
    embedded += rows.length;
    batches += 1;
    if (batches % 10 === 0 || embedded >= cap) log(`  embedded ${embedded}/${Math.min(pending, cap)}`);
    if (o.delayMs) await sleep(o.delayMs);
  }
  return { embedded, batches, pending };
}

// ---------------------------------------------------------------------------------------------
// VERIFY
// ---------------------------------------------------------------------------------------------
export async function runVerify(o: { db: Queryable; qdrant: QdrantClient | null }): Promise<Record<string, number | string>> {
  const r = await o.db.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE source_type = 'quran')::int AS quran,
            count(*) FILTER (WHERE source_type = 'hadith')::int AS hadith,
            count(*) FILTER (WHERE embedded_at IS NOT NULL)::int AS embedded,
            count(*) FILTER (WHERE source_type = 'hadith' AND grade NOT IN ('Sahih','Hasan'))::int AS non_authentic
       FROM public.islamic_texts`,
  );
  const out: Record<string, number | string> = { ...r.rows[0] };
  if (o.qdrant) {
    try { out.qdrant_points = await o.qdrant.count(); } catch (e) { out.qdrant_points = `unavailable: ${(e as Error).message}`; }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "hadith-dir": { type: "string", default: "./data/hadith" },
      collections: { type: "string" },
      "topics-file": { type: "string" },
      limit: { type: "string" },
      "batch-size": { type: "string", default: "50" },
      "delay-ms": { type: "string", default: "700" },
      "dry-run": { type: "boolean", default: false },
      "force-embed": { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
    },
  });
  const phase = positionals[0];
  if (!["load", "embed", "all", "verify"].includes(phase ?? "")) {
    console.error("usage: ingest.ts <load|embed|all|verify> [--hadith-dir DIR] [--collections a,b] [--topics-file F.jsonl] [--limit N] [--batch-size N] [--delay-ms N] [--dry-run] [--force-embed] [--prune]");
    process.exit(2);
  }
  const log: Log = (m) => console.log(m);
  const env = (k: string) => process.env[k];
  const limit = values.limit ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) throw new Error("--limit must be a positive integer");

  const needsDb = !(values["dry-run"] && phase === "load");
  let pool: { query: Queryable["query"]; end(): Promise<void> } | null = null;
  if (needsDb) {
    const url = env("DATABASE_URL");
    if (!url) throw new Error("DATABASE_URL is not set (Supabase → Project Settings → Database → Connection string, session pooler or direct)");
    const { default: pg } = await import("pg");
    // Supabase presents a certificate chain Node does not trust by default; encrypt but do not verify the chain.
    pool = new pg.Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""), ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 2 });
  }
  const db = (pool ?? { query: async () => { throw new Error("no database in dry-run"); } }) as Queryable;

  try {
    const qcfg = qdrantConfigFromEnv(env);
    const qdrant = qcfg ? createQdrantClient(qcfg) : null;

    if (phase === "load" || phase === "all") {
      const res = await runLoadHadith({
        db, dir: values["hadith-dir"]!, collections: values.collections?.split(",").map((s) => s.trim()).filter(Boolean),
        limit, dryRun: values["dry-run"], prune: values.prune, log,
      });
      log(`hadith: ${res.stats.reduce((a, s) => a + s.accepted, 0)} authentic rows prepared, ${res.written} rows written/changed`);
      if (res.prunedIds.length && qdrant && !values["dry-run"]) {
        await qdrant.deletePoints(res.prunedIds);
        log(`removed ${res.prunedIds.length} pruned points from Qdrant`);
      }
      if (needsDb) {
        const topics = values["topics-file"] ? parseTopicsJsonl(readFileSync(values["topics-file"], "utf8")) : undefined;
        await runSyncQuran({ db, topics, dryRun: values["dry-run"], log });
      }
    }
    if (phase === "embed" || phase === "all") {
      if (!qdrant) throw new Error("QDRANT_URL / QDRANT_API_KEY are not set");
      const embedder = embeddingProviderFromEnv(env);
      if (!embedder) throw new Error("no embedding provider: set GEMINI_API_KEY or OPENAI_API_KEY");
      const r = await runEmbed({
        db, qdrant, embedder, batchSize: Number(values["batch-size"]), limit, force: values["force-embed"],
        dryRun: values["dry-run"], delayMs: Number(values["delay-ms"]), log,
      });
      log(`embed: ${r.embedded} rows in ${r.batches} batches (${r.pending} were pending)`);
    }
    if (phase === "verify") console.log(await runVerify({ db, qdrant }));
  } finally {
    await pool?.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`ingest failed: ${(e as Error).message}`); process.exit(1); });
}
