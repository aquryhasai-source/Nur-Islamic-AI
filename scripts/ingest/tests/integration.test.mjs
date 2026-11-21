// Integration test against a REAL Postgres that already has migration 007 applied.
//   PG_TEST_URL=postgres://postgres@localhost:5544/t npm test        (skipped when PG_TEST_URL is unset)
// It deletes and recreates hadith rows in that database — point it at a scratch DB, never at production.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLLECTIONS } from "../preprocess.ts";
import {
  runLoadHadith, runSyncQuran, runEmbed, runVerify, parseTopicsJsonl, withRetry, thinPayload,
} from "../ingest.ts";
import { createPgDb, createSearchService, CircuitBreaker } from "../../../supabase/functions/nur-proxy/searchService.ts";
import { EmbeddingError } from "../../../supabase/functions/nur-proxy/embeddings.ts";

const URL = process.env.PG_TEST_URL;
const skip = !URL && "PG_TEST_URL not set";

let pool;
async function db() {
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({ connectionString: URL, max: 2 });
  }
  return pool;
}
test.after(async () => { await pool?.end(); });

// --- synthetic edition files in the fawazahmed0 shape -----------------------------------------
function writeEditions() {
  const dir = mkdtempSync(join(tmpdir(), "nur-ingest-"));
  const ed = (hadiths, sections) => JSON.stringify({ metadata: { sections }, hadiths });
  const g = (grade) => [{ name: "Al-Albani", grade }, { name: "Zubair Ali Zai", grade }];
  const sec = { "1": "Book of Faith", "2": "Book of Prayer" };
  writeFileSync(join(dir, "eng-bukhari.min.json"), ed([
    { hadithnumber: 1, text: "Narrated 'Umar bin Al-Khattab:I heard Allah's Messenger (ﷺ) saying, \"The reward of deeds depends upon the intentions.\"", reference: { book: 1, hadith: 1 } },
    { hadithnumber: 2, text: "Narrated 'Aisha:The Prophet used to be patient and forgiving with everyone he met.", reference: { book: 1, hadith: 2 } },
    { hadithnumber: 3, text: "", reference: { book: 1, hadith: 3 } },
  ], sec));
  writeFileSync(join(dir, "ara-bukhari.min.json"), ed([
    { hadithnumber: 1, text: "حَدَّثَنَا الْحُمَيْدِيُّ، قَالَ حَدَّثَنَا سُفْيَانُ، عَنْ يَحْيَى، عَنْ عُمَرَ ـ رضى الله عنه ـ قَالَ سَمِعْتُ رَسُولَ اللَّهِ صلى الله عليه وسلم يَقُولُ إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى" },
  ], sec));
  writeFileSync(join(dir, "eng-abudawud.min.json"), ed([
    { hadithnumber: 10, text: "Narrated Abu Huraira: Patience is half of faith, and prayer is a light for the believer.", grades: g("Sahih"), reference: { book: 2, hadith: 10 } },
    { hadithnumber: 11, text: "Narrated Abu Huraira: A weak report that must never be served.", grades: g("Daif"), reference: { book: 2, hadith: 11 } },
    { hadithnumber: 12, text: "Narrated Anas: A report whose chain only is sound, not the text.", grades: g("Sahih Isnaad"), reference: { book: 2, hadith: 12 } },
  ], sec));
  return dir;
}

const mockEmbedder = (fail429Once = false) => {
  let failed = !fail429Once;
  const calls = [];
  return {
    calls, name: "mock:768", dims: 768,
    async embed(texts, task) {
      calls.push({ n: texts.length, task });
      if (!failed) { failed = true; throw new EmbeddingError("rate limited", 429, 1000); }
      return texts.map((t, i) => { const v = new Array(768).fill(0); v[i % 768] = 1; return v; });
    },
  };
};
const mockQdrant = () => {
  const store = new Map();
  return {
    store, baseUrl: "https://q", collection: "islamic_texts", created: 0,
    async collectionExists() { return this.created > 0; },
    async createCollection() { this.created++; },
    async createPayloadIndexes() {},
    async upsert(points) { for (const p of points) store.set(p.id, p); },
    async deletePoints(ids) { for (const i of ids) store.delete(i); },
    async count() { return store.size; },
  };
};

async function resetHadith(p) {
  await p.query("DELETE FROM public.islamic_texts WHERE source_type = 'hadith'");
  await p.query("UPDATE public.islamic_texts SET embedded_at = NULL, content_hash = NULL, topic_summary = NULL WHERE source_type = 'quran'");
}

test("schema: DB itself refuses non-authentic hadith and empty English", { skip }, async () => {
  const p = await db();
  await assert.rejects(() => p.query(
    `INSERT INTO islamic_texts (source_type, collection, ref, ref_label, book_name, grade, text_en) VALUES ('hadith','bukhari','x1','l','b','Daif','t')`),
    /islamic_texts_shape|check/i);
  await assert.rejects(() => p.query(
    `INSERT INTO islamic_texts (source_type, collection, ref, ref_label, book_name, grade, text_en) VALUES ('hadith','bukhari','x2','l','b',NULL,'t')`), /check/i);
  await assert.rejects(() => p.query(
    `INSERT INTO islamic_texts (source_type, collection, ref, ref_label, book_name, grade, text_en) VALUES ('hadith','bukhari','x3','l','b','Sahih','   ')`), /check/i);
  const ok = await p.query(
    `INSERT INTO islamic_texts (source_type, collection, ref, ref_label, book_name, grade, text_en) VALUES ('hadith','bukhari','x4','l','b','Hasan','t') RETURNING id`);
  assert.equal(ok.rowCount, 1);
  await p.query("DELETE FROM islamic_texts WHERE ref = 'x4'");
});

test("load: writes only authentic rows, is idempotent, resets embedded_at only for changed text, prunes", { skip }, async () => {
  const p = await db();
  await resetHadith(p);
  const dir = writeEditions();
  const opts = { db: p, dir, collections: ["bukhari", "abudawud"] };

  const r1 = await runLoadHadith(opts);
  assert.equal(r1.written, 3);                // bukhari 1,2 + abudawud 10
  const rows = (await p.query("SELECT collection, ref, grade, isnad_ar IS NOT NULL AS has_isnad, narrator_en, chapter_title FROM islamic_texts WHERE source_type='hadith' ORDER BY collection, ref")).rows;
  assert.deepEqual(rows.map((r) => `${r.collection}:${r.ref}:${r.grade}`), ["abudawud:10:Sahih", "bukhari:1:Sahih", "bukhari:2:Sahih"]);
  assert.equal(rows.find((r) => r.ref === "1").has_isnad, true);
  assert.equal(rows.find((r) => r.ref === "1").narrator_en, "Narrated 'Umar bin Al-Khattab");
  assert.equal(rows.find((r) => r.ref === "10").chapter_title, "Book of Prayer");
  assert.equal(r1.stats.find((s) => s.collection === "abudawud").skippedNotAllAuthentic, 2);

  const r2 = await runLoadHadith(opts);
  assert.equal(r2.written, 0, "re-running load changes nothing");

  await p.query("UPDATE islamic_texts SET embedded_at = now() WHERE source_type='hadith'");
  const edited = JSON.parse((await import("node:fs")).readFileSync(join(dir, "eng-bukhari.min.json"), "utf8"));
  edited.hadiths[1].text = "Narrated 'Aisha:The Prophet used to be very patient and forgiving with everyone he met.";
  writeFileSync(join(dir, "eng-bukhari.min.json"), JSON.stringify(edited));
  const r3 = await runLoadHadith(opts);
  assert.equal(r3.written, 1);
  const st = (await p.query("SELECT ref, embedded_at IS NULL AS pending FROM islamic_texts WHERE collection='bukhari' ORDER BY ref")).rows;
  assert.deepEqual(st.map((r) => [r.ref, r.pending]), [["1", false], ["2", true]]);

  // prune: abudawud 10 now graded weak by one grader -> must be deleted
  const ab = JSON.parse((await import("node:fs")).readFileSync(join(dir, "eng-abudawud.min.json"), "utf8"));
  ab.hadiths[0].grades[1].grade = "Daif";
  writeFileSync(join(dir, "eng-abudawud.min.json"), JSON.stringify(ab));
  const idBefore = (await p.query("SELECT id FROM islamic_texts WHERE collection='abudawud' AND ref='10'")).rows[0].id;
  await assert.rejects(() => runLoadHadith({ ...opts, prune: true, limit: 1 }), /--prune cannot be combined/);
  const r4 = await runLoadHadith({ ...opts, prune: true });
  assert.deepEqual(r4.prunedIds, [Number(idBefore)]);
  assert.equal((await p.query("SELECT count(*)::int n FROM islamic_texts WHERE collection='abudawud'")).rows[0].n, 0);

  const dry = await runLoadHadith({ ...opts, dryRun: true });
  assert.equal(dry.written, 0);
});

test("quran sync: topics applied, hashes set, second run is a no-op, bad topics file rejected", { skip }, async () => {
  const p = await db();
  await resetHadith(p);
  const topics = parseTopicsJsonl('{"ref":"2:255","topic":"Allah\'s oneness, life and sovereignty"}\n\n{"ref":"3:10","topic":"Wealth and children will not avail"}\n');
  const a = await runSyncQuran({ db: p, topics });
  assert.equal(a.topicsApplied, 2);
  assert.ok(a.changed >= 486 - 0);
  const row = (await p.query("SELECT topic_summary, content_hash FROM islamic_texts WHERE collection='quran' AND ref='2:255'")).rows[0];
  assert.equal(row.topic_summary, "Allah's oneness, life and sovereignty");
  assert.ok(row.content_hash);
  const b = await runSyncQuran({ db: p, topics });
  assert.equal(b.changed, 0);
  assert.throws(() => parseTopicsJsonl('{"ref":"bad","topic":"x"}'), /ref/);
  assert.throws(() => parseTopicsJsonl('{"ref":"1:1","topic":"' + "x".repeat(201) + '"}'), /200/);
  assert.throws(() => parseTopicsJsonl("not json"), /invalid JSON/);
});

test("embed: thin payload only, ids == Supabase ids, retries a 429, resumable, no text sent to Qdrant", { skip }, async () => {
  const p = await db();
  await resetHadith(p);
  await runLoadHadith({ db: p, dir: writeEditions(), collections: ["bukhari", "abudawud"] });
  await runSyncQuran({ db: p });
  const total = (await p.query("SELECT count(*)::int n FROM islamic_texts")).rows[0].n;

  const q = mockQdrant();
  const e = mockEmbedder(true);
  const sleeps = [];
  const first = await runEmbed({ db: p, qdrant: q, embedder: e, batchSize: 100, limit: 120, sleep: async (ms) => { sleeps.push(ms); } });
  assert.equal(first.embedded, 120);
  assert.deepEqual(sleeps, [1000], "429 retried once, honouring retry-after");
  assert.equal(q.created, 1, "collection created on first use");
  assert.equal(q.store.size, 120);

  const second = await runEmbed({ db: p, qdrant: q, embedder: e, batchSize: 100, sleep: async () => {} });
  assert.equal(second.embedded, total - 120, "resumes where it stopped");
  assert.equal(q.store.size, total);
  const third = await runEmbed({ db: p, qdrant: q, embedder: e, sleep: async () => {} });
  assert.equal(third.pending, 0);
  assert.ok(e.calls.every((c) => c.task === "document"));

  const ids = new Set((await p.query("SELECT id FROM islamic_texts")).rows.map((r) => Number(r.id)));
  for (const [id, pt] of q.store) {
    assert.ok(ids.has(id));
    assert.equal(pt.vector.length, 768);
    const keys = Object.keys(pt.payload).sort();
    if (pt.payload.source_type === "quran") assert.deepEqual(keys, ["source_type", "surah_number"]);
    else assert.deepEqual(keys, ["book", "grade", "source_type"]);
    assert.ok(["Sahih", "Hasan"].includes(pt.payload.grade) || pt.payload.source_type === "quran");
  }
  const blob = JSON.stringify([...q.store.values()].map((x) => x.payload));
  assert.ok(!/Allah|Narrated|patient/i.test(blob), "no text in Qdrant payloads");

  const v = await runVerify({ db: p, qdrant: q });
  assert.equal(v.total, total);
  assert.equal(v.embedded, total);
  assert.equal(v.qdrant_points, total);
  assert.equal(v.non_authentic, 0);
});

test("embed helpers: retry gives up on non-retryable errors; thinPayload refuses non-authentic hadith", async () => {
  await assert.rejects(() => withRetry(async () => { throw new EmbeddingError("bad key", 401); }, { sleep: async () => {} }), /bad key/);
  let n = 0;
  await assert.rejects(() => withRetry(async () => { n++; throw new EmbeddingError("down", 503); }, { attempts: 3, sleep: async () => {} }));
  assert.equal(n, 3);
  assert.throws(() => thinPayload({ source_type: "hadith", collection: "abudawud", grade: "Daif", surah_number: null }), /Sahih\/Hasan/);
  assert.throws(() => thinPayload({ source_type: "hadith", collection: "abudawud", grade: null, surah_number: null }));
});

test("lexical RPC: references, aliases, ranges, keywords, hostile input", { skip }, async () => {
  const p = await db();
  await resetHadith(p);
  await runLoadHadith({ db: p, dir: writeEditions(), collections: ["bukhari", "abudawud"] });
  const lex = async (q, n = 15, st = null) =>
    (await p.query("SELECT l.id, l.score::float8 AS score, l.match_kind, t.ref, t.collection FROM search_islamic_texts_lexical($1,$2,$3) l JOIN islamic_texts t USING (id) ORDER BY l.score DESC", [q, n, st])).rows;

  for (const q of ["Surah 2:255", "surah 2 ayah 255", "Quran 2:255", "2:255", "q 2:255", "Ayat al-Kursi", "ayatul kursi", "verse of the throne"]) {
    const r = await lex(q);
    assert.equal(`${r[0]?.collection}:${r[0]?.ref}`, "quran:2:255", `"${q}" -> ${JSON.stringify(r[0])}`);
  }
  assert.equal((await lex("Surah 2:255"))[0].match_kind, "reference");
  const range = await lex("Quran 3:1-3");
  assert.deepEqual(range.filter((r) => r.match_kind === "reference").map((r) => r.ref).sort(), ["3:1", "3:2", "3:3"]);

  assert.equal((await lex("Bukhari 1"))[0].ref, "1");
  assert.equal((await lex("Bukhari 1"))[0].collection, "bukhari");
  assert.equal((await lex("Sahih al-Bukhari 2"))[0].ref, "2");
  const ab = await lex("abu dawud 10");
  assert.equal(`${ab[0].collection}:${ab[0].ref}`, "abudawud:10");

  const pat = await lex("what is said about patience");
  assert.ok(pat.some((r) => r.collection === "abudawud" && r.ref === "10"), "keyword (stemmed) match on 'patience'");
  assert.ok(!pat.some((r) => r.collection === "abudawud" && r.ref === "11"), "weak hadith was never loaded, so can never match");
  assert.ok(pat.every((r) => r.match_kind === "text"));

  const onlyQuran = await lex("patient", 15, "quran");
  assert.ok(onlyQuran.length > 0 && onlyQuran.every((r) => r.collection === "quran"));
  assert.equal((await lex("surah 115:1")).filter((r) => r.match_kind === "reference").length, 0, "surah 115 does not exist");
  assert.equal((await lex("Bukhari 999999")).filter((r) => r.match_kind === "reference").length, 0);
  // a reference to a hadith that is not in the corpus must return NOTHING, not unrelated "sahih" keyword hits
  assert.deepEqual(await lex("Sahih Muslim 8"), []);
  assert.deepEqual(await lex("Sahih al-Bukhari 999999"), []);
  assert.deepEqual(await lex("Sunan Abu Dawud 5000"), []);
  // ...but extra words after a reference still search
  const mixed = await lex("Bukhari 1 patient");
  assert.equal(mixed[0].match_kind, "reference");
  assert.ok(mixed.some((r) => r.match_kind === "text"));
  assert.deepEqual(await lex(""), []);
  assert.deepEqual(await lex("   "), []);
  assert.deepEqual(await lex("!!! ??? ..."), []);
  for (const hostile of ["'; DROP TABLE islamic_texts; --", "a & b | !c <-> d", "((((", "\\", "x".repeat(5000)]) await lex(hostile);
  assert.ok((await p.query("SELECT count(*)::int n FROM islamic_texts")).rows[0].n > 0);
  assert.ok((await lex("patience", 3)).length <= 3, "match_count respected");
});

test("end to end: createPgDb + searchService with a Qdrant that returns a stale id", { skip }, async () => {
  const p = await db();
  await resetHadith(p);
  await runLoadHadith({ db: p, dir: writeEditions(), collections: ["bukhari", "abudawud"] });
  const goodId = Number((await p.query("SELECT id FROM islamic_texts WHERE collection='abudawud' AND ref='10'")).rows[0].id);
  const qdrant = { async query() { return [{ id: 99999999, score: 0.9 }, { id: goodId, score: 0.8 }]; } };
  const embedder = { name: "m", dims: 768, async embed(t) { return t.map(() => new Array(768).fill(0.1)); } };
  const svc = createSearchService({ db: createPgDb(p), qdrant, embedder, log: () => {}, breaker: new CircuitBreaker() });
  const out = await svc.search("patience and prayer");
  assert.equal(out.mode, "hybrid");
  assert.ok(out.ids.includes(goodId));
  assert.ok(!out.ids.includes(99999999));
  assert.equal(out.diagnostics.droppedStaleIds, 1);
  const hit = out.results.find((r) => r.id === goodId);
  assert.equal(hit.grade, "Sahih");
  assert.equal(hit.refLabel, "Sunan Abi Dawud 10");

  const down = createSearchService({ db: createPgDb(p), qdrant: { async query() { throw new Error("paused"); } }, embedder, log: () => {}, breaker: new CircuitBreaker() });
  const fb = await down.search("Bukhari 1");
  assert.equal(fb.mode, "lexical_only");
  assert.equal(fb.degraded, true);
  assert.equal(fb.results[0].refLabel, "Sahih al-Bukhari 1");
});

test("COLLECTIONS covers exactly the seven gradable collections", () => {
  assert.deepEqual(COLLECTIONS.map((c) => c.slug), ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik"]);
});
