// Pure tests: token estimate, chunking, rate limiter, retry backoff. No database.
import test from "node:test";
import assert from "node:assert/strict";
import { estimateTokens, chunkByTokens, createTokenThrottle, withRetry } from "../ingest.ts";
import { EmbeddingError } from "../../../supabase/functions/nur-proxy/embeddings.ts";

const clock = () => { const c = { t: 0, now: () => c.t, sleep: async (ms) => { c.t += ms; } }; return c; };

test("estimateTokens is conservative (3.5 chars/token) and never zero", () => {
  assert.equal(estimateTokens("a".repeat(350)), 100);
  assert.equal(estimateTokens(""), 1);
});

test("chunkByTokens: caps items AND tokens; an oversized text gets its own chunk; order and coverage preserved", () => {
  const small = "x".repeat(35); // 10 tokens
  assert.deepEqual(chunkByTokens(Array(250).fill(small), 100, 1_000_000), [[0, 100], [100, 200], [200, 250]]);
  assert.deepEqual(chunkByTokens(Array(10).fill(small), 100, 35), [[0, 3], [3, 6], [6, 9], [9, 10]]); // 3 x 10 tokens <= 35
  const big = "y".repeat(7000); // 2000 tokens
  assert.deepEqual(chunkByTokens([small, big, small], 100, 500), [[0, 1], [1, 2], [2, 3]]);
  assert.deepEqual(chunkByTokens([], 100, 500), []);
  const texts = Array.from({ length: 333 }, (_, i) => "z".repeat(10 + (i * 37) % 900));
  const chunks = chunkByTokens(texts, 100, 3000);
  assert.equal(chunks[0][0], 0);
  assert.equal(chunks.at(-1)[1], 333);
  for (let i = 1; i < chunks.length; i++) assert.equal(chunks[i][0], chunks[i - 1][1]);
  for (const [a, b] of chunks) assert.ok(b - a <= 100 && (b - a === 1 || texts.slice(a, b).reduce((s, t) => s + estimateTokens(t), 0) <= 3000));
});

test("throttle: 25,000 tokens/minute is never exceeded in any rolling minute", async () => {
  const c = clock();
  const th = createTokenThrottle({ tokensPerMinute: 25_000, now: c.now, sleep: c.sleep });
  const log = [];
  for (let i = 0; i < 40; i++) { const n = 6000 + (i % 5) * 1500; await th.acquire(n); log.push({ t: c.now(), n }); }
  for (const e of log) {
    const used = log.filter((d) => d.t <= e.t && d.t > e.t - 60_000).reduce((a, d) => a + d.n, 0);
    assert.ok(used <= 25_000, `${used} at ${e.t}`);
  }
  const total = log.reduce((a, d) => a + d.n, 0);
  assert.ok(c.now() >= (total / 25_000 - 1) * 60_000, "no faster than the budget allows");
  assert.ok(c.now() <= (total / 25_000 + 1) * 60_000, "and not needlessly slow either");
});

test("throttle: first call is immediate; a request larger than the whole budget still goes (alone); 0 disables", async () => {
  const c = clock();
  const th = createTokenThrottle({ tokensPerMinute: 1000, now: c.now, sleep: c.sleep });
  await th.acquire(900);
  assert.equal(c.now(), 0);
  await th.acquire(50_000);
  assert.ok(c.now() > 0 && c.now() <= 60_000);
  const off = createTokenThrottle({ tokensPerMinute: 0, now: c.now, sleep: async () => { throw new Error("must not sleep"); } });
  await off.acquire(1e9);
});

test("withRetry: 429 -> 5,10,20,40,60,60,60s then gives up; 5xx -> 1,2,4s; Retry-After wins; 401 fails at once", async () => {
  const run = async (mk, attempts) => { const sleeps = []; let n = 0;
    try { await withRetry(async () => { n++; throw mk(); }, { attempts, sleep: async (ms) => { sleeps.push(ms); } }); } catch { /* expected */ }
    return { sleeps, n }; };
  const a = await run(() => new EmbeddingError("q", 429), 8);
  assert.deepEqual(a.sleeps, [5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  assert.equal(a.n, 8);
  assert.deepEqual((await run(() => new EmbeddingError("s", 503), 4)).sleeps, [1000, 2000, 4000]);
  assert.deepEqual((await run(() => new EmbeddingError("q", 429, 12000), 3)).sleeps, [12000, 12000]);
  assert.deepEqual(await run(() => new EmbeddingError("k", 401), 8), { sleeps: [], n: 1 });
  let calls = 0;
  const v = await withRetry(async () => { if (++calls < 3) throw new EmbeddingError("q", 429); return "ok"; }, { sleep: async () => {} });
  assert.equal(v, "ok");
});
