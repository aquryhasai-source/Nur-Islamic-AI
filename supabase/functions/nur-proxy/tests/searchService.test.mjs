// Run: node --experimental-strip-types --test supabase/functions/nur-proxy/tests/
import test from "node:test";
import assert from "node:assert/strict";
import {
  reciprocalRankFusion, createSearchService, CircuitBreaker, SearchUnavailableError, TimeoutError,
  createSupabaseDb, mapRow,
} from "../searchService.ts";
import {
  normalizeBaseUrl, createQdrantClient, QdrantError, versionAtLeast, toQdrantFilter, qdrantConfigFromEnv,
} from "../qdrant.ts";
import { createGeminiProvider, createOpenAIProvider, embeddingProviderFromEnv, l2Normalize } from "../embeddings.ts";

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------
const row = (id, over = {}) => ({
  id, sourceType: "hadith", collection: "bukhari", ref: String(id), refLabel: `Sahih al-Bukhari ${id}`,
  surahNumber: null, ayahNumber: null, surahName: null, bookName: "Sahih al-Bukhari", chapterTitle: "Book",
  grade: "Sahih", textAr: "ar", textEn: `text ${id}`, isnadAr: null, narratorEn: null, ...over,
});

function fakeDb({ lexical = [], rows = null, lexicalError = null, hydrateError = null } = {}) {
  const calls = { lexical: [], hydrate: [] };
  return {
    calls,
    async lexical(q, limit, st) {
      calls.lexical.push({ q, limit, st });
      if (lexicalError) throw lexicalError;
      return lexical;
    },
    async hydrate(ids) {
      calls.hydrate.push(ids);
      if (hydrateError) throw hydrateError;
      const all = rows ?? [...new Set([...ids])].map((i) => row(i));
      return all.filter((r) => ids.includes(r.id));
    },
  };
}
const lex = (...ids) => ids.map((id, i) => ({ id, score: 1 - i * 0.1, kind: "text" }));
const embedder = { name: "fake", dims: 768, async embed(texts) { return texts.map(() => new Array(768).fill(0.1)); } };
const qdrantReturning = (ids) => ({ calls: 0, async query(args) { this.calls++; this.last = args; return ids.map((id, i) => ({ id, score: 0.9 - i * 0.01 })); } });
const quiet = () => { const events = []; const fn = (e) => events.push(e); fn.events = events; return fn; };

// ---------------------------------------------------------------------------------------------
// RRF
// ---------------------------------------------------------------------------------------------
test("RRF: matches the formula 1/(k+rank) and orders by fused score", () => {
  const fused = reciprocalRankFusion([
    { name: "vector", ids: [1, 2, 3] },
    { name: "lexical", ids: [3, 1, 9] },
  ], 60);
  assert.deepEqual(fused.map((f) => f.id), [1, 3, 2, 9]);
  assert.ok(Math.abs(fused[0].score - (1 / 61 + 1 / 62)) < 1e-12);
  assert.ok(Math.abs(fused[1].score - (1 / 63 + 1 / 61)) < 1e-12);
  assert.deepEqual(fused[0].ranks, { vector: 1, lexical: 2 });
});

test("RRF: duplicate ids inside one list count once; weights apply; ties are deterministic", () => {
  const f = reciprocalRankFusion([{ name: "a", ids: [5, 5, 6] }], 60);
  assert.deepEqual(f.map((x) => x.id), [5, 6]);
  assert.equal(f[1].ranks.a, 2);
  const w = reciprocalRankFusion([{ name: "v", weight: 3, ids: [1] }, { name: "l", weight: 1, ids: [2] }], 60);
  assert.deepEqual(w.map((x) => x.id), [1, 2]);
  const tie = reciprocalRankFusion([{ name: "v", ids: [10] }, { name: "l", ids: [4] }], 60);
  assert.deepEqual(tie.map((x) => x.id), [4, 10]); // equal score, equal best rank -> lower id first
});

// ---------------------------------------------------------------------------------------------
// searchService
// ---------------------------------------------------------------------------------------------
test("hybrid: both succeed -> RRF merge, ONE hydrate call, ordered, <= finalK", async () => {
  const db = fakeDb({ lexical: lex(3, 1, 9, 20, 21) });
  const q = qdrantReturning([1, 2, 3, 30, 31, 32]);
  const svc = createSearchService({ db, qdrant: q, embedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("what is said about patience", { finalK: 5 });
  assert.equal(out.mode, "hybrid");
  assert.equal(out.degraded, false);
  assert.equal(db.calls.hydrate.length, 1, "exactly one hydration query");
  assert.equal(db.calls.hydrate[0].length, 5);
  assert.deepEqual(out.ids.slice(0, 3), [1, 3, 2]);
  assert.equal(out.results.length, 5);
  assert.equal(q.last.limit, 15);
  assert.equal(db.calls.lexical[0].limit, 15);
});

test("fallback: Qdrant HTTP error -> lexical results, no throw, degraded, error logged without the query text", async () => {
  const db = fakeDb({ lexical: lex(5, 6, 7) });
  const q = { async query() { throw new QdrantError("http", "Qdrant POST -> 503", 503); } };
  const log = quiet();
  const svc = createSearchService({ db, qdrant: q, embedder, log, breaker: new CircuitBreaker() });
  const out = await svc.search("secret question text");
  assert.equal(out.mode, "lexical_only");
  assert.equal(out.degraded, true);
  assert.deepEqual(out.ids, [5, 6, 7]);
  assert.match(out.diagnostics.vectorError, /503/);
  assert.ok(log.events.some((e) => e.type === "vector_search_failed"));
  assert.ok(!JSON.stringify(log.events).includes("secret question text"), "never log the user's question");
});

test("fallback: Qdrant paused / network error behaves the same", async () => {
  const q = { async query() { throw new QdrantError("network", "fetch failed"); } };
  const svc = createSearchService({ db: fakeDb({ lexical: lex(1) }), qdrant: q, embedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("x");
  assert.equal(out.degraded, true);
  assert.deepEqual(out.ids, [1]);
});

test("timeout: a hung Qdrant call is cut off at vectorTimeoutMs and lexical results are returned", async () => {
  const q = { query: () => new Promise(() => {}) }; // never settles, ignores abort
  const svc = createSearchService({ db: fakeDb({ lexical: lex(2, 4) }), qdrant: q, embedder, log: quiet(), breaker: new CircuitBreaker() });
  const t = Date.now();
  const out = await svc.search("q", { vectorTimeoutMs: 40 });
  const ms = Date.now() - t;
  assert.ok(ms >= 35 && ms < 500, `took ${ms} ms`);
  assert.equal(out.degraded, true);
  assert.match(out.diagnostics.vectorError, /timed out/);
  assert.deepEqual(out.ids, [2, 4]);
});

test("timeout covers the embedding call too and aborts its signal", async () => {
  let aborted = false;
  const slowEmbedder = { name: "slow", dims: 768, embed: (_t, _k, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); })) };
  const svc = createSearchService({ db: fakeDb({ lexical: lex(1) }), qdrant: qdrantReturning([2]), embedder: slowEmbedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("q", { vectorTimeoutMs: 30 });
  assert.equal(aborted, true);
  assert.equal(out.degraded, true);
  assert.deepEqual(out.ids, [1]);
});

test("circuit breaker: after 3 failures Qdrant is skipped (no 2.5 s penalty), then retried after the cooldown", async () => {
  let now = 1_000_000;
  const breaker = new CircuitBreaker(3, 60_000, () => now);
  let fail = true;
  const q = { calls: 0, async query() { this.calls++; if (fail) throw new QdrantError("http", "down", 500); return [{ id: 9, score: 0.8 }]; } };
  const svc = createSearchService({ db: fakeDb({ lexical: lex(1) }), qdrant: q, embedder, log: quiet(), breaker });
  for (let i = 0; i < 3; i++) await svc.search("q");
  assert.equal(q.calls, 3);
  const skipped = await svc.search("q");
  assert.equal(q.calls, 3, "Qdrant not called while the circuit is open");
  assert.equal(skipped.diagnostics.vectorSkipped, "circuit_open");
  assert.equal(skipped.degraded, true);
  now += 61_000;
  fail = false;
  const back = await svc.search("q");
  assert.equal(q.calls, 4);
  assert.equal(back.mode, "hybrid");
  assert.equal(back.degraded, false);
});

test("unconfigured Qdrant/embedder -> lexical only, NOT degraded (nothing was expected)", async () => {
  const svc = createSearchService({ db: fakeDb({ lexical: lex(8, 9) }), qdrant: null, embedder: null, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("q");
  assert.equal(out.mode, "lexical_only");
  assert.equal(out.degraded, false);
  assert.equal(out.diagnostics.vectorSkipped, "unconfigured");
});

test("both backends failing throws SearchUnavailableError (callers must fail closed, never return a silent empty)", async () => {
  const q = { async query() { throw new QdrantError("network", "x"); } };
  const svc = createSearchService({ db: fakeDb({ lexicalError: new Error("pg down") }), qdrant: q, embedder, log: quiet(), breaker: new CircuitBreaker() });
  await assert.rejects(() => svc.search("q"), (e) => e instanceof SearchUnavailableError && /pg down/.test(e.diagnostics.lexicalError));
});

test("lexical down but Qdrant up -> vector_only results", async () => {
  const svc = createSearchService({ db: fakeDb({ lexicalError: new Error("rpc failed") }), qdrant: qdrantReturning([4, 5]), embedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("q");
  assert.equal(out.mode, "vector_only");
  assert.deepEqual(out.ids, [4, 5]);
});

test("stale Qdrant ids (not in Supabase) are dropped, never surfaced", async () => {
  const db = fakeDb({ lexical: lex(1), rows: [row(1), row(2)] });
  const svc = createSearchService({ db, qdrant: qdrantReturning([2, 99]), embedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("q");
  assert.ok(!out.ids.includes(99));
  assert.equal(out.diagnostics.droppedStaleIds, 1);
});

test("defence in depth: a hadith without Sahih/Hasan grade is dropped at hydration", async () => {
  const db = fakeDb({ lexical: lex(1, 2), rows: [row(1, { grade: "Daif" }), row(2), row(3, { sourceType: "quran", grade: null, collection: "quran" })] });
  const svc = createSearchService({ db, qdrant: qdrantReturning([3]), embedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("q");
  assert.deepEqual(out.ids.sort(), [2, 3]);
  assert.equal(out.diagnostics.droppedNonAuthentic, 1);
});

test("exact references from the lexical RPC are pinned first even if the vector side never saw them", async () => {
  const db = fakeDb({ lexical: [{ id: 7, score: 10, kind: "reference" }, { id: 1, score: 0.5, kind: "text" }] });
  const svc = createSearchService({ db, qdrant: qdrantReturning([1, 2, 3]), embedder, log: quiet(), breaker: new CircuitBreaker() });
  const out = await svc.search("Bukhari 7");
  assert.equal(out.ids[0], 7);
});

test("filters: sourceType/grade are passed to Qdrant and sourceType to the lexical RPC", async () => {
  const db = fakeDb({ lexical: lex(1) });
  const q = qdrantReturning([1]);
  const svc = createSearchService({ db, qdrant: q, embedder, log: quiet(), breaker: new CircuitBreaker() });
  await svc.search("q", { sourceType: "hadith", grade: "Sahih" });
  assert.deepEqual(q.last.filter, { sourceType: "hadith", grade: "Sahih" });
  assert.equal(db.calls.lexical[0].st, "hadith");
});

test("empty query -> empty result, no backend calls", async () => {
  const db = fakeDb();
  const q = qdrantReturning([1]);
  const out = await createSearchService({ db, qdrant: q, embedder, log: quiet(), breaker: new CircuitBreaker() }).search("   ");
  assert.deepEqual(out.ids, []);
  assert.equal(q.calls, 0);
  assert.equal(db.calls.lexical.length, 0);
});

test("hydration failure propagates (no context can be built without Supabase)", async () => {
  const db = fakeDb({ lexical: lex(1), hydrateError: new Error("hydrate failed") });
  const svc = createSearchService({ db, qdrant: null, embedder: null, log: quiet(), breaker: new CircuitBreaker() });
  await assert.rejects(() => svc.search("q"), /hydrate failed/);
});

test("supabase-js adapter: rpc names/args and row mapping", async () => {
  const calls = [];
  const client = {
    async rpc(fn, args) {
      calls.push([fn, args]);
      if (fn === "search_islamic_texts_lexical") return { data: [{ id: 5, score: 10, match_kind: "reference" }], error: null };
      return { data: [{ id: 5, source_type: "quran", collection: "quran", ref: "2:255", ref_label: "Quran 2:255", surah_number: 2, ayah_number: 255, surah_name: "Al-Baqarah", book_name: null, chapter_title: null, grade: null, text_ar: "a", text_en: "e", isnad_ar: null, narrator_en: null }], error: null };
    },
  };
  const db = createSupabaseDb(client);
  const l = await db.lexical("Surah 2:255", 15, "quran");
  assert.deepEqual(l, [{ id: 5, score: 10, kind: "reference" }]);
  assert.deepEqual(calls[0], ["search_islamic_texts_lexical", { query_text: "Surah 2:255", match_count: 15, source_filter: "quran" }]);
  const h = await db.hydrate([5]);
  assert.equal(h[0].surahNumber, 2);
  assert.deepEqual(calls[1], ["get_islamic_texts_by_ids", { p_ids: [5] }]);
  await assert.rejects(() => createSupabaseDb({ rpc: async () => ({ data: null, error: { message: "boom" } }) }).hydrate([1]), /boom/);
  assert.equal(mapRow({ id: "12", source_type: "hadith", collection: "muslim", ref: "1", ref_label: "x", text_en: "t" }).id, 12);
});

// ---------------------------------------------------------------------------------------------
// qdrant.ts
// ---------------------------------------------------------------------------------------------
test("normalizeBaseUrl strips every trailing slash and whitespace; rejects junk", () => {
  assert.equal(normalizeBaseUrl("https://abc.cloud.qdrant.io:6333///"), "https://abc.cloud.qdrant.io:6333");
  assert.equal(normalizeBaseUrl("  https://abc.io/  "), "https://abc.io");
  assert.throws(() => normalizeBaseUrl(""), QdrantError);
  assert.throws(() => normalizeBaseUrl("abc.io"), QdrantError);
  assert.equal(qdrantConfigFromEnv((k) => ({ QDRANT_URL: "https://x.io/", QDRANT_API_KEY: "k" })[k]).url, "https://x.io");
  assert.equal(qdrantConfigFromEnv(() => undefined), null);
});

function recordingFetch(handler) {
  const reqs = [];
  const f = async (url, init) => {
    reqs.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, json = {} } = await handler(url, init, reqs.length);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  };
  f.reqs = reqs;
  return f;
}

test("qdrant client: no double slashes, api-key header, thin payload, wait=true, query shape", async () => {
  const fetchImpl = recordingFetch(async (url) => {
    if (url.endsWith("/collections")) return { json: { result: { collections: [{ name: "islamic_texts" }] } } };
    if (url.endsWith("/points/query")) return { json: { result: { points: [{ id: 7, score: 0.81 }, { id: "bad", score: 1 }] } } };
    return { json: { result: true } };
  });
  const c = createQdrantClient({ url: "https://q.example.io///", apiKey: "SECRET", fetchImpl });
  const ping = await c.ping();
  assert.deepEqual(ping.collections, ["islamic_texts"]);
  const hits = await c.query({ vector: [0.1, 0.2], limit: 15, filter: { sourceType: "hadith", grade: "Sahih" } });
  assert.deepEqual(hits, [{ id: 7, score: 0.81 }]);
  await c.upsert([{ id: 7, vector: [0.1], payload: { source_type: "hadith", book: "bukhari", grade: "Sahih" } }]);
  for (const r of fetchImpl.reqs) {
    assert.ok(!/\/\/(collections|api)/.test(r.url.replace("https://", "")), `double slash in ${r.url}`);
    assert.equal(r.headers["api-key"], "SECRET");
  }
  const q = fetchImpl.reqs[1];
  assert.equal(q.url, "https://q.example.io/collections/islamic_texts/points/query");
  assert.equal(q.body.limit, 15);
  assert.equal(q.body.with_payload, false);
  assert.deepEqual(q.body.filter, { must: [{ key: "source_type", match: { value: "hadith" } }, { key: "grade", match: { value: "Sahih" } }] });
  assert.deepEqual(q.body.params.quantization, { rescore: true, oversampling: 2 });
  const up = fetchImpl.reqs[2];
  assert.equal(up.url, "https://q.example.io/collections/islamic_texts/points?wait=true");
  assert.equal(up.method, "PUT");
  assert.deepEqual(Object.keys(up.body.points[0]).sort(), ["id", "payload", "vector"]);
});

test("qdrant client: error mapping (HTTP status, abort, network, non-JSON)", async () => {
  const mk = (fetchImpl) => createQdrantClient({ url: "https://q.io", apiKey: "k", fetchImpl });
  await assert.rejects(() => mk(async () => new Response("paused", { status: 503 })).ping(), (e) => e.kind === "http" && e.status === 503);
  await assert.rejects(() => mk(async () => { const e = new Error("x"); e.name = "AbortError"; throw e; }).ping(), (e) => e.kind === "timeout");
  await assert.rejects(() => mk(async () => { throw new TypeError("fetch failed"); }).ping(), (e) => e.kind === "network");
  await assert.rejects(() => mk(async () => new Response("<html>", { status: 200 })).ping(), (e) => e.kind === "bad_response");
});

test("qdrant createCollection: quantization key depends on server version (always_ram < 1.19, memory >= 1.19)", async () => {
  const run = async (version) => {
    const fetchImpl = recordingFetch(async (url) => (url === "https://q.io/" ? { json: { version } } : { json: { result: true } }));
    await createQdrantClient({ url: "https://q.io", apiKey: "k", fetchImpl }).createCollection();
    return fetchImpl.reqs.find((r) => r.method === "PUT").body;
  };
  const old = await run("1.15.4");
  assert.deepEqual(old.quantization_config.scalar, { type: "int8", quantile: 0.99, always_ram: true });
  const neu = await run("1.19.0");
  assert.deepEqual(neu.quantization_config.scalar, { type: "int8", quantile: 0.99, memory: "pinned" });
  assert.deepEqual(neu.vectors, { size: 768, distance: "Cosine" });
  assert.ok(versionAtLeast("2.0.1", 1, 19) && !versionAtLeast(null, 1, 19) && !versionAtLeast("1.18.9", 1, 19));
  assert.equal(toQdrantFilter({}), undefined);
});

// ---------------------------------------------------------------------------------------------
// embeddings.ts
// ---------------------------------------------------------------------------------------------
test("gemini provider: request shape, task types, 768 dims, output is L2-normalised", async () => {
  const fetchImpl = recordingFetch(async (url) => {
    if (url.endsWith(":embedContent")) return { json: { embedding: { values: new Array(768).fill(2) } } };
    return { json: { embeddings: [{ values: new Array(768).fill(3) }, { values: new Array(768).fill(1) }] } };
  });
  const p = createGeminiProvider({ apiKey: "G", fetchImpl });
  const [v] = await p.embed(["hello"], "query");
  const r1 = fetchImpl.reqs[0];
  assert.equal(r1.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent");
  assert.equal(r1.headers["x-goog-api-key"], "G");
  assert.equal(r1.body.taskType, "RETRIEVAL_QUERY");
  assert.equal(r1.body.outputDimensionality, 768);
  assert.deepEqual(r1.body.content, { parts: [{ text: "hello" }] });
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9);
  const out = await p.embed(["a", "b"], "document");
  assert.equal(fetchImpl.reqs[1].url.endsWith(":batchEmbedContents"), true);
  assert.equal(fetchImpl.reqs[1].body.requests[0].taskType, "RETRIEVAL_DOCUMENT");
  assert.equal(out.length, 2);
});

test("gemini provider: wrong dimension / wrong count / HTTP error are rejected", async () => {
  const bad = createGeminiProvider({ apiKey: "G", fetchImpl: recordingFetch(async () => ({ json: { embedding: { values: [1, 2, 3] } } })) });
  await assert.rejects(() => bad.embed(["x"], "query"), /768 finite/);
  const http = createGeminiProvider({ apiKey: "G", fetchImpl: async () => new Response("", { status: 429, headers: { "retry-after": "7" } }) });
  await assert.rejects(() => http.embed(["x"], "query"), (e) => e.status === 429 && e.retryAfterMs === 7000);
});

test("openai provider: dimensions=768, ordered by index", async () => {
  const fetchImpl = recordingFetch(async () => ({ json: { data: [{ index: 1, embedding: new Array(768).fill(1) }, { index: 0, embedding: new Array(768).fill(2) }] } }));
  const p = createOpenAIProvider({ apiKey: "O", fetchImpl });
  const out = await p.embed(["a", "b"], "document");
  assert.equal(fetchImpl.reqs[0].body.dimensions, 768);
  assert.equal(fetchImpl.reqs[0].body.model, "text-embedding-3-small");
  assert.equal(fetchImpl.reqs[0].headers.Authorization, "Bearer O");
  assert.ok(Math.abs(out[0][0] - 1 / Math.sqrt(768)) < 1e-9);
  assert.equal(l2Normalize([3, 4])[0], 0.6);
});

test("embeddingProviderFromEnv picks by env; null when nothing configured", () => {
  const env = (o) => (k) => o[k];
  assert.match(embeddingProviderFromEnv(env({ GEMINI_API_KEY: "g" })).name, /^gemini:/);
  assert.match(embeddingProviderFromEnv(env({ OPENAI_API_KEY: "o" })).name, /^openai:/);
  assert.match(embeddingProviderFromEnv(env({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", EMBEDDING_PROVIDER: "openai" })).name, /^openai:/);
  assert.equal(embeddingProviderFromEnv(env({})), null);
});

test("TimeoutError is exported and named", () => {
  assert.equal(new TimeoutError(10).name, "TimeoutError");
});
