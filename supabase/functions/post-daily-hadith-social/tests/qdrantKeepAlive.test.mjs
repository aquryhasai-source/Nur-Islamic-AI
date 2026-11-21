// Run: node --experimental-strip-types --test supabase/functions/post-daily-hadith-social/tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { pingQdrant, keepQdrantAlive, normalizeQdrantUrl } from "../qdrantKeepAlive.ts";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("normalizeQdrantUrl strips every trailing slash and whitespace, rejects junk", () => {
  assert.equal(normalizeQdrantUrl("https://x.cloud.qdrant.io:6333///"), "https://x.cloud.qdrant.io:6333");
  assert.equal(normalizeQdrantUrl("  https://x.io/ "), "https://x.io");
  assert.equal(normalizeQdrantUrl(""), null);
  assert.equal(normalizeQdrantUrl("x.io"), null);
  assert.equal(normalizeQdrantUrl(undefined), null);
});

test("GET {base}/collections with api-key, no double slash, reports collection count", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return json({ result: { collections: [{ name: "islamic_texts" }] } }); };
  const r = await pingQdrant({ url: "https://q.io/", apiKey: "K", fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.equal(r.collections, 1);
  assert.equal(seen[0].url, "https://q.io/collections");
  assert.equal(seen[0].init.method, "GET");
  assert.equal(seen[0].init.headers["api-key"], "K");
});

test("never throws: HTTP 4xx/5xx, network error, timeout, bad body", async () => {
  assert.deepEqual((await pingQdrant({ url: "https://q.io", apiKey: "k", fetchImpl: async () => json({}, 503) })).error, "HTTP 503");
  assert.equal((await pingQdrant({ url: "https://q.io", apiKey: "bad", fetchImpl: async () => json({}, 401) })).ok, false);
  const net = await pingQdrant({ url: "https://q.io", apiKey: "k", fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  assert.equal(net.ok, false);
  assert.match(net.error, /network/);
  // Node unrefs AbortSignal.timeout() timers; a real fetch socket keeps the loop alive, a mock does not.
  const keeper = setInterval(() => {}, 1000);
  const slow = await pingQdrant({ url: "https://q.io", apiKey: "k", timeoutMs: 30, fetchImpl: (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(init.signal.reason))) });
  clearInterval(keeper);
  assert.equal(slow.error, "timeout");
  const html = await pingQdrant({ url: "https://q.io", apiKey: "k", fetchImpl: async () => new Response("<html>", { status: 200 }) });
  assert.equal(html.ok, true, "a 200 is a successful keep-alive even if the body is not JSON");
  assert.equal(html.collections, undefined);
});

test("unset secrets -> skipped, no request made", async () => {
  let called = false;
  const r = await pingQdrant({ url: undefined, apiKey: "", fetchImpl: async () => { called = true; return json({}); } });
  assert.equal(r.skipped, true);
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test("secrets never appear in the result or in log output", async () => {
  const logs = [];
  const orig = console.log; console.log = (...a) => logs.push(a.join(" "));
  try {
    const r = await pingQdrant({ url: "https://secret-cluster.example.io", apiKey: "TOPSECRETKEY", fetchImpl: async () => json({}, 500) });
    assert.ok(!JSON.stringify(r).includes("TOPSECRETKEY") && !JSON.stringify(r).includes("secret-cluster"));
    keepQdrantAlive({ url: "https://secret-cluster.example.io", apiKey: "TOPSECRETKEY", fetchImpl: async () => { throw new Error("secret-cluster TOPSECRETKEY exploded"); } });
    await new Promise((r) => setTimeout(r, 20));
  } finally { console.log = orig; }
  assert.ok(logs.some((l) => l.includes("[qdrant-keepalive]")));
  assert.ok(!logs.join("\n").includes("TOPSECRETKEY") && !logs.join("\n").includes("secret-cluster"));
});

test("keepQdrantAlive is fire-and-forget: returns synchronously, hands the task to EdgeRuntime.waitUntil, survives a throwing waitUntil", async () => {
  let handed;
  globalThis.EdgeRuntime = { waitUntil: (p) => { handed = p; } };
  const ret = keepQdrantAlive({ url: "https://q.io", apiKey: "k", fetchImpl: async () => json({ result: { collections: [] } }) });
  assert.equal(ret, undefined);
  assert.ok(handed instanceof Promise);
  await handed;
  globalThis.EdgeRuntime = { waitUntil: () => { throw new Error("boom"); } };
  assert.doesNotThrow(() => keepQdrantAlive({ url: "https://q.io", apiKey: "k", fetchImpl: async () => json({}) }));
  delete globalThis.EdgeRuntime;
  assert.doesNotThrow(() => keepQdrantAlive({ url: "https://q.io", apiKey: "k", fetchImpl: async () => json({}) }));
});
