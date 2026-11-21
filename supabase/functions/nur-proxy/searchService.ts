// searchService.ts — hybrid retrieval over Supabase (lexical + source of truth) and Qdrant (semantic).
//
//   user query ──┬─► embed → Qdrant top-K ids   (hard timeout, ~2.5 s) ─┐
//                └─► Supabase lexical top-K ids                          ├─► RRF ─► top N ids ─► hydrate from Supabase
//                                                                        ┘
//   * Qdrant down / timed out / paused / unconfigured  → lexical results, silently (degraded flag set).
//   * Both backends fail                               → throws SearchUnavailableError (caller must fail closed).
//   * Text NEVER comes from Qdrant: ids are hydrated from Supabase, and ids Supabase no longer has are dropped.
//
// Runs in Deno (Supabase Edge Function) and Node >= 20. No runtime-specific imports.

import type { Grade, QdrantClient, SourceType, VectorHit } from "./qdrant.ts";
import type { EmbeddingProvider } from "./embeddings.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface IslamicText {
  id: number;
  sourceType: SourceType;
  collection: string;
  ref: string;
  refLabel: string;
  surahNumber: number | null;
  ayahNumber: number | null;
  surahName: string | null;
  bookName: string | null;
  chapterTitle: string | null;
  grade: Grade | null;
  textAr: string | null;
  textEn: string;
  isnadAr: string | null;
  narratorEn: string | null;
}

export interface LexicalHit {
  id: number;
  score: number;
  kind: "reference" | "text";
}

/** Everything the service needs from Postgres. Two adapters are provided below. */
export interface SearchDb {
  lexical(query: string, limit: number, sourceType?: SourceType): Promise<LexicalHit[]>;
  /** One query: SELECT ... FROM islamic_texts WHERE id = ANY($1). Order is NOT guaranteed. */
  hydrate(ids: number[]): Promise<IslamicText[]>;
}

export interface SearchOptions {
  vectorTopK?: number;          // default 15
  lexicalTopK?: number;         // default 15
  finalK?: number;              // default 10 (spec: 8-10)
  vectorTimeoutMs?: number;     // default 2500 (covers query embedding + Qdrant)
  rrfK?: number;                // default 60
  vectorWeight?: number;        // default 1
  lexicalWeight?: number;       // default 1
  sourceType?: SourceType;      // restrict to quran or hadith
  grade?: Grade;                // restrict hadith to one grade (applies to the vector side)
}

export type SearchMode = "hybrid" | "lexical_only" | "vector_only";

export interface SearchDiagnostics {
  vectorMs?: number;
  lexicalMs?: number;
  vectorCount: number;
  lexicalCount: number;
  vectorSkipped?: "unconfigured" | "circuit_open";
  vectorError?: string;
  lexicalError?: string;
  droppedStaleIds: number;
  droppedNonAuthentic: number;
}

export interface SearchOutcome {
  mode: SearchMode;
  /** true when the semantic side was expected but unavailable (timeout, error, paused, circuit open). */
  degraded: boolean;
  ids: number[];
  results: IslamicText[];
  diagnostics: SearchDiagnostics;
}

export class SearchUnavailableError extends Error {
  diagnostics: SearchDiagnostics;
  constructor(message: string, diagnostics: SearchDiagnostics) {
    super(message);
    this.name = "SearchUnavailableError";
    this.diagnostics = diagnostics;
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion
// ---------------------------------------------------------------------------
export interface RankedList {
  name: string;
  weight?: number;
  ids: number[]; // best first
}

export interface FusedHit {
  id: number;
  score: number;
  ranks: Record<string, number>; // 1-based rank per list
}

/** score(id) = Σ weight / (k + rank). Ties: better best-rank first, then lower id (deterministic). */
export function reciprocalRankFusion(lists: RankedList[], k = 60): FusedHit[] {
  const acc = new Map<number, FusedHit>();
  for (const list of lists) {
    const w = list.weight ?? 1;
    const seen = new Set<number>();
    let rank = 0;
    for (const id of list.ids) {
      if (seen.has(id)) continue; // a list may repeat an id; count its first (best) position only
      seen.add(id);
      rank += 1;
      const hit = acc.get(id) ?? { id, score: 0, ranks: {} };
      hit.score += w / (k + rank);
      hit.ranks[list.name] = rank;
      acc.set(id, hit);
    }
  }
  const best = (h: FusedHit) => Math.min(...Object.values(h.ranks));
  return [...acc.values()].sort((a, b) => b.score - a.score || best(a) - best(b) || a.id - b.id);
}

// ---------------------------------------------------------------------------
// Circuit breaker (stops every request from paying the full timeout while Qdrant is paused/down)
// ---------------------------------------------------------------------------
export class CircuitBreaker {
  // Plain fields (no TS parameter properties) so the file also runs under Node's strip-types mode.
  private failures = 0;
  private openUntil = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  constructor(threshold = 3, cooldownMs = 60_000, now: () => number = () => Date.now()) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
  }
  allow(): boolean {
    return this.now() >= this.openUntil;
  }
  success(): void {
    this.failures = 0;
    this.openUntil = 0;
  }
  failure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openUntil = this.now() + this.cooldownMs;
  }
}

// Module-level default: survives across invocations while the Edge Function isolate stays warm.
const defaultBreaker = new CircuitBreaker();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new TimeoutError(ms);
      ac.abort(err);
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([fn(ac.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function errLabel(err: unknown): string {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    return `${err.name}${status ? ` ${status}` : ""}: ${err.message}`.slice(0, 200);
  }
  return String(err).slice(0, 200);
}

const AUTHENTIC: ReadonlySet<string> = new Set(["Sahih", "Hasan"]);

export type SearchLogger = (event: { type: string; [k: string]: unknown }) => void;

const defaultLog: SearchLogger = (event) => {
  // Never log the user's question (privacy): only the event type and error label.
  console.warn(JSON.stringify({ svc: "searchService", ...event }));
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export interface SearchServiceDeps {
  db: SearchDb;
  qdrant?: QdrantClient | null;
  embedder?: EmbeddingProvider | null;
  breaker?: CircuitBreaker;
  log?: SearchLogger;
}

export interface SearchService {
  search(query: string, opts?: SearchOptions): Promise<SearchOutcome>;
}

export function createSearchService(deps: SearchServiceDeps): SearchService {
  const { db } = deps;
  const log = deps.log ?? defaultLog;
  const breaker = deps.breaker ?? defaultBreaker;

  return {
    async search(rawQuery, opts = {}) {
      const query = rawQuery.replace(/\s+/g, " ").trim().slice(0, 500);
      const o = {
        vectorTopK: opts.vectorTopK ?? 15,
        lexicalTopK: opts.lexicalTopK ?? 15,
        finalK: opts.finalK ?? 10,
        vectorTimeoutMs: opts.vectorTimeoutMs ?? 2500,
        rrfK: opts.rrfK ?? 60,
        vectorWeight: opts.vectorWeight ?? 1,
        lexicalWeight: opts.lexicalWeight ?? 1,
      };
      const diagnostics: SearchDiagnostics = {
        vectorCount: 0, lexicalCount: 0, droppedStaleIds: 0, droppedNonAuthentic: 0,
      };
      if (!query) return { mode: "lexical_only", degraded: false, ids: [], results: [], diagnostics };

      // ---- decide whether the semantic branch runs -----------------------------------------------
      const { qdrant, embedder } = deps;
      let vectorSkipped: SearchDiagnostics["vectorSkipped"];
      if (!qdrant || !embedder) vectorSkipped = "unconfigured";
      else if (!breaker.allow()) vectorSkipped = "circuit_open";
      diagnostics.vectorSkipped = vectorSkipped;

      const t0 = Date.now();

      // ---- semantic branch: embed + Qdrant, one shared hard deadline -----------------------------
      const vectorBranch: Promise<VectorHit[]> = vectorSkipped
        ? Promise.reject(new Error(`skipped: ${vectorSkipped}`))
        : withTimeout(o.vectorTimeoutMs, async (signal) => {
          const [vector] = await embedder!.embed([query], "query", signal);
          const hits = await qdrant!.query({
            vector,
            limit: o.vectorTopK,
            filter: { sourceType: opts.sourceType, grade: opts.grade },
            signal,
          });
          return hits;
        }).then((hits) => {
          diagnostics.vectorMs = Date.now() - t0;
          breaker.success();
          return hits;
        }, (err) => {
          diagnostics.vectorMs = Date.now() - t0;
          breaker.failure();
          throw err;
        });

      // ---- lexical branch -------------------------------------------------------------------------
      const lexicalBranch: Promise<LexicalHit[]> = db.lexical(query, o.lexicalTopK, opts.sourceType).then((hits) => {
        diagnostics.lexicalMs = Date.now() - t0;
        return hits;
      });

      const [vRes, lRes] = await Promise.allSettled([vectorBranch, lexicalBranch]);

      const vectorHits = vRes.status === "fulfilled" ? vRes.value : [];
      const lexicalHits = lRes.status === "fulfilled" ? lRes.value : [];
      diagnostics.vectorCount = vectorHits.length;
      diagnostics.lexicalCount = lexicalHits.length;

      const vectorFailed = vRes.status === "rejected" && !vectorSkipped;
      if (vRes.status === "rejected" && !vectorSkipped) {
        diagnostics.vectorError = errLabel(vRes.reason);
        log({ type: "vector_search_failed", error: diagnostics.vectorError, ms: diagnostics.vectorMs });
      }
      if (lRes.status === "rejected") {
        diagnostics.lexicalError = errLabel(lRes.reason);
        log({ type: "lexical_search_failed", error: diagnostics.lexicalError });
      }

      if (vRes.status === "rejected" && lRes.status === "rejected") {
        throw new SearchUnavailableError("both vector and lexical search failed", diagnostics);
      }

      // ---- fuse -----------------------------------------------------------------------------------
      const pinned = lexicalHits.filter((h) => h.kind === "reference").map((h) => h.id); // exact "Bukhari 1" style asks
      const fused = reciprocalRankFusion(
        [
          { name: "vector", weight: o.vectorWeight, ids: vectorHits.map((h) => h.id) },
          { name: "lexical", weight: o.lexicalWeight, ids: lexicalHits.map((h) => h.id) },
        ],
        o.rrfK,
      );
      const orderedIds: number[] = [];
      for (const id of [...pinned, ...fused.map((f) => f.id)]) {
        if (!orderedIds.includes(id)) orderedIds.push(id);
        if (orderedIds.length >= o.finalK) break;
      }

      const mode: SearchMode = vectorHits.length && lexicalHits.length
        ? "hybrid"
        : vectorHits.length ? "vector_only" : "lexical_only";
      const degraded = Boolean(vectorSkipped === "circuit_open" || vectorFailed);

      if (!orderedIds.length) return { mode, degraded, ids: [], results: [], diagnostics };

      // ---- hydrate: single query against Supabase, the only place text comes from -------------------
      const rows = await db.hydrate(orderedIds);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const results: IslamicText[] = [];
      for (const id of orderedIds) {
        const row = byId.get(id);
        if (!row) {
          diagnostics.droppedStaleIds += 1; // id in Qdrant but not (or no longer) in Supabase
          continue;
        }
        if (row.sourceType === "hadith" && !(row.grade && AUTHENTIC.has(row.grade))) {
          diagnostics.droppedNonAuthentic += 1; // defence in depth; the DB CHECK already forbids this
          continue;
        }
        results.push(row);
      }
      if (diagnostics.droppedStaleIds || diagnostics.droppedNonAuthentic) {
        log({ type: "hydration_dropped", stale: diagnostics.droppedStaleIds, nonAuthentic: diagnostics.droppedNonAuthentic });
      }
      return { mode, degraded, ids: results.map((r) => r.id), results, diagnostics };
    },
  };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

export function mapRow(r: Row): IslamicText {
  const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    id: Number(r.id),
    sourceType: r.source_type as SourceType,
    collection: String(r.collection),
    ref: String(r.ref),
    refLabel: String(r.ref_label),
    surahNumber: n(r.surah_number),
    ayahNumber: n(r.ayah_number),
    surahName: s(r.surah_name),
    bookName: s(r.book_name),
    chapterTitle: s(r.chapter_title),
    grade: (s(r.grade) as Grade | null),
    textAr: s(r.text_ar),
    textEn: String(r.text_en),
    isnadAr: s(r.isnad_ar),
    narratorEn: s(r.narrator_en),
  };
}

export function mapLexical(r: Row): LexicalHit {
  return { id: Number(r.id), score: Number(r.score), kind: r.match_kind === "reference" ? "reference" : "text" };
}

/** supabase-js (works in Deno and Node): uses the two RPCs from migration 007. */
export interface SupabaseRpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export function createSupabaseDb(client: SupabaseRpcClient): SearchDb {
  return {
    async lexical(query, limit, sourceType) {
      const { data, error } = await client.rpc("search_islamic_texts_lexical", {
        query_text: query, match_count: limit, source_filter: sourceType ?? null,
      });
      if (error) throw new Error(`lexical rpc failed: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((r) => mapLexical(r as Row));
    },
    async hydrate(ids) {
      const { data, error } = await client.rpc("get_islamic_texts_by_ids", { p_ids: ids });
      if (error) throw new Error(`hydrate rpc failed: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((r) => mapRow(r as Row));
    },
  };
}

/** node-postgres style pool/client (Vercel Node functions, scripts, tests). */
export interface PgLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

export function createPgDb(pool: PgLike): SearchDb {
  return {
    async lexical(query, limit, sourceType) {
      const { rows } = await pool.query(
        "SELECT id, score, match_kind FROM public.search_islamic_texts_lexical($1, $2, $3)",
        [query, limit, sourceType ?? null],
      );
      return rows.map(mapLexical);
    },
    async hydrate(ids) {
      const { rows } = await pool.query(
        `SELECT id, source_type, collection, ref, ref_label, surah_number, ayah_number, surah_name,
                book_name, chapter_title, grade, text_ar, text_en, isnad_ar, narrator_en
           FROM public.islamic_texts
          WHERE id = ANY($1::bigint[])`,
        [ids],
      );
      return rows.map(mapRow);
    },
  };
}
