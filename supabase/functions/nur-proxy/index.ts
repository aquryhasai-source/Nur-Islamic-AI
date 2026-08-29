import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Existing config (unchanged) ──────────────────────────────────────────
const DAILY_LIMIT  = 15;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── New config — all overridable via env vars, all defaults match the spec ─
const MODEL_LIGHT   = Deno.env.get("NUR_MODEL_LIGHT")   ?? "openai/gpt-oss-20b";
const MODEL_COMPLEX = Deno.env.get("NUR_MODEL_COMPLEX") ?? "openai/gpt-oss-120b";
const CLASSIFICATION_CONFIDENCE_THRESHOLD = parseFloat(Deno.env.get("NUR_CLASSIFICATION_CONFIDENCE_THRESHOLD") ?? "0.75");

// Cache-serving was tried and dropped (word/keyword-based similarity risks
// misclassifying materially different questions as the same). Every safe,
// validated generation is still logged to ai_response_log for future use —
// e.g. building a proper embeddings-based cache once traffic justifies it —
// but nothing is ever read back from that table to serve a response.
// Version stamps are informational metadata on each logged row.
const RAG_VERSION        = "v1";
const PROMPT_VERSION     = "v1";
const VALIDATION_VERSION = "v1";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const JSON_H = { ...CORS, "Content-Type": "application/json" };

interface QuranVerse   { ref: string; text: string; surah: number; ayah: number; }
interface HadithRecord { label: string; collId: string; number: number; text: string; }

const COLL_LABELS: Record<string, string> = {
  bukhari:  "Sahih Bukhari",
  muslim:   "Sahih Muslim",
  abudawud: "Abu Dawud",
  tirmidhi: "Jami at-Tirmidhi",
  nasai:    "An-Nasai",
  ibnmajah: "Ibn Majah",
};

// NOTE: added a `key` field to every topic (was: kw/refs only). Existing
// consumers (retrieveHadiths) only ever read .kw/.refs, so this is additive
// and doesn't change hadith retrieval. `key` is stored as an informational
// tag on logged responses (ai_response_log.topic_keys) — it is not used for
// any matching decision.
const TOPIC_MAP: { key: string; kw: string[]; refs: { c: string; n: number }[] }[] = [
  { key:"intention", kw: ["intention","niyyah","niyyat","actions judged","deeds judged"], refs: [{ c:"bukhari",n:1 }] },
  { key:"pillars", kw: ["five pillars","shahada","testimony of faith","pillars of islam"], refs: [{ c:"bukhari",n:8 },{c:"muslim",n:16}] },
  { key:"prayer", kw: ["prayer","salah","salat","namaz","fajr","dhuhr","asr","maghrib","isha","worship"], refs: [{c:"bukhari",n:8},{c:"bukhari",n:504},{c:"muslim",n:223}] },
  { key:"patience", kw: ["patience","sabr","trial","hardship","affliction","difficulty","suffering","calamity","test"], refs: [{c:"bukhari",n:5641},{c:"muslim",n:2999},{c:"tirmidhi",n:2396}] },
  { key:"knowledge", kw: ["knowledge","ilm","learn","scholar","education","teach","wisdom","study"], refs: [{c:"ibnmajah",n:224},{c:"bukhari",n:71},{c:"tirmidhi",n:2682}] },
  { key:"charity", kw: ["charity","sadaqah","donate","donation","zakat","give","poor","needy","spend","generosity"], refs: [{c:"bukhari",n:1410},{c:"muslim",n:1017},{c:"bukhari",n:1344}] },
  { key:"fasting", kw: ["fasting","ramadan","sawm","fast","iftar","suhoor","suhur"], refs: [{c:"bukhari",n:1904},{c:"muslim",n:1151},{c:"bukhari",n:1894}] },
  { key:"parents", kw: ["parent","mother","father","parents","birr","respect parents","honor parents"], refs: [{c:"bukhari",n:5971},{c:"muslim",n:2548},{c:"tirmidhi",n:1900}] },
  { key:"kindness", kw: ["kindness","mercy","compassion","gentle","rahma","care","soft"], refs: [{c:"bukhari",n:6013},{c:"muslim",n:2593},{c:"bukhari",n:6039}] },
  { key:"tawakkul", kw: ["tawakkul","trust allah","reliance","rely on allah","depend on allah"], refs: [{ c:"tirmidhi",n:2517}] },
  { key:"dua", kw: ["dua","supplication","supplicate","invocation","make dua","asking allah"], refs: [{c:"tirmidhi",n:3371},{c:"bukhari",n:6340},{c:"tirmidhi",n:3604}] },
  { key:"honesty", kw: ["honest","honesty","truth","truthful","truthfulness","lying","lie","deceive","deception"], refs: [{c:"bukhari",n:6094},{c:"muslim",n:2607}] },
  { key:"anger", kw: ["anger","angry","temper","rage","control anger","wrath"], refs: [{c:"bukhari",n:6116},{c:"tirmidhi",n:2020}] },
  { key:"forgiveness", kw: ["forgive","forgiveness","pardon","repent","repentance","tawbah","tawba","istighfar","sin"], refs: [{c:"tirmidhi",n:3540},{c:"bukhari",n:6307},{c:"muslim",n:2758}] },
  { key:"brotherhood", kw: ["neighbor","community","brotherhood","ummah","love brother","unity","muslim brother"], refs: [{c:"bukhari",n:6015},{c:"muslim",n:2563},{c:"muslim",n:2564}] },
  { key:"afterlife", kw: ["death","afterlife","akhirah","paradise","jannah","hell","hellfire","hereafter","judgment"], refs: [{c:"bukhari",n:6514},{c:"tirmidhi",n:2381}] },
  { key:"purity", kw: ["purity","purification","wudu","ablution","tahara","cleanliness"], refs: [{c:"muslim",n:223}] },
  { key:"marriage", kw: ["marriage","nikah","spouse","husband","wife","wed","matrimony"], refs: [{c:"bukhari",n:5063},{c:"tirmidhi",n:1162}] },
  { key:"quran_recitation", kw: ["quran reading","recite quran","recitation","memorize quran","quran recitation"], refs: [{c:"bukhari",n:5027},{c:"muslim",n:798}] },
  { key:"dhikr", kw: ["dhikr","remembrance","zikr","subhanallah","alhamdulillah","remembering allah"], refs: [{c:"muslim",n:2691},{c:"bukhari",n:6407}] },
  { key:"hajj", kw: ["hajj","pilgrimage","mecca","kaaba","umrah","tawaf"], refs: [{c:"bukhari",n:1513},{c:"muslim",n:1350}] },
  { key:"bidah", kw: ["innovation","bidah","sunnah following","misguidance","new matter"], refs: [{c:"muslim",n:867},{c:"bukhari",n:2697}] },
  { key:"love", kw: ["love","affection","loving for sake of allah","brotherhood love"], refs: [{c:"bukhari",n:15},{c:"muslim",n:45}] },
  { key:"greeting", kw: ["greeting","salam","assalamu alaikum","peace greeting","salutation"], refs: [{c:"muslim",n:54},{c:"bukhari",n:6236}] },
  { key:"food", kw: ["eating","food","drink","halal food","bismillah eating","bismillah before"], refs: [{c:"bukhari",n:5376},{c:"muslim",n:2022}] },
  { key:"backbiting", kw: ["backbiting","gossip","gheebah","slander","speak ill","talk behind"], refs: [{c:"muslim",n:2589},{c:"bukhari",n:6052}] },
  { key:"envy", kw: ["envy","jealousy","hasad","covet","envious"], refs: [{c:"bukhari",n:5032}] },
  { key:"humility", kw: ["arrogance","pride","humble","humility","kibr","arrogant"], refs: [{c:"muslim",n:91},{c:"tirmidhi",n:1999}] },
  { key:"gratitude", kw: ["gratitude","shukr","thankful","grateful","gratefulness"], refs: [{c:"tirmidhi",n:2816},{c:"abudawud",n:4811}] },
  { key:"children", kw: ["children","child","raising children","parenting","upbringing"], refs: [{c:"bukhari",n:5097},{c:"tirmidhi",n:1952}] },
];

// ── Fix (2026-08-26): strip a leading bracketed context/personalization
// header — e.g. "[Context: The person asking is a teenager. Keep
// explanations clear...]" — before it reaches Quran keyword extraction or
// hadith topic matching. The client prepends this kind of header to the
// actual question; extractKeywords() takes only the first 8 non-stopword
// words of whatever string it's given, so a sufficiently long header word
// like "context"/"person" was permanently occupying the top keyword slots
// and crowding out the real question's words, which produced the same
// alquran.cloud search terms — and therefore the same handful of returned
// verses — for every question that carried a header, regardless of topic.
// Hadith topic matching (matchTopics) was never affected, since it does a
// substring scan over the whole string rather than a fixed-width keyword
// window — the real topic word was still found wherever it appeared.
function stripContextPreamble(query: string): string {
  return query.replace(/^\[[^\]]*\]\s*\n+/, "").trim();
}

// ── Phase 1 (2026-08-26): Islamic name/entity normalization ──────────────
// Maps common transliterated Arabic names to the spelling actually used in
// the en.sahih (Saheeh International) Quran translation searchQuran() calls
// against. Without this, a question about "Zakaria" or "Isa" finds zero real
// matches even though that person IS in the Quran — just under a different
// English spelling ("Zechariah", "Jesus"). This doesn't relax what counts as
// a valid citation; it only helps the existing keyword search actually find
// verse text that's already there.
const NAME_ALIASES: Record<string, string> = {
  isa: "jesus", eesa: "jesus", esa: "jesus",
  musa: "moses", mousa: "moses",
  ibrahim: "abraham", ibraheem: "abraham",
  zakariya: "zechariah", zakariyya: "zechariah", zakaria: "zechariah", zachariah: "zechariah",
  yahya: "john",
  nuh: "noah",
  yusuf: "joseph", yousuf: "joseph",
  dawud: "david", dawood: "david",
  sulaiman: "solomon", sulayman: "solomon",
  ismail: "ishmael", ismael: "ishmael",
  ishaq: "isaac", ishak: "isaac",
  yaqub: "jacob", yakub: "jacob",
  ilyas: "elias", elyas: "elias",
  ayyub: "job", ayub: "job",
  yunus: "jonah", younus: "jonah", yunis: "jonah",
  idris: "enoch",
  harun: "aaron",
  // Concept words, not just names — same problem, same fix: these
  // transliterated Arabic terms don't appear in the Saheeh International
  // English text at all, so without normalization the local quran_ayahs
  // full-text search returns zero rows even though the concept is present
  // throughout the Quran under its English rendering.
  tawakkul: "rely", tawakul: "rely", tawakal: "rely",
};

// Generic Islamic-discourse words that are valid keywords but so common in
// the translation text that they crowd out a more specific term (e.g.
// "prophet" appears in dozens of verses unrelated to whichever prophet was
// actually asked about). extractKeywords still includes them if nothing
// more specific is present — they just no longer occupy the top-2 slots
// ahead of a real name or topic word.
const GENERIC_LOW_VALUE = new Set([
  "prophet", "prophets", "messenger", "messengers", "islam", "muslim", "muslims", "religion", "people",
]);

function extractKeywords(query: string): string[] {
  const stop = new Set(["what","does","the","say","about","how","are","were","been","into","more","some","also","then","them","they","their","in","on","to","and","or","for","with","of","that","this","should","can","will","have","has","had","tell","please","explain","when","who","why","which","there","from"]);
  const rawWords = query.toLowerCase().replace(/[^a-z\s]/g," ").split(/\s+/).filter(Boolean);
  // Normalize name variants BEFORE the length filter — some transliterations
  // ("isa") are shorter than the >3 threshold even though their canonical
  // translation spelling ("jesus") is not.
  const normalized = rawWords.map(w => NAME_ALIASES[w] ?? w);
  const filtered = normalized.filter(w => w.length > 3 && !stop.has(w));
  const seen = new Set<string>();
  const deduped = filtered.filter(w => (seen.has(w) ? false : (seen.add(w), true)));
  // Stable-sort generic filler words behind more specific ones so a real
  // name/topic word gets first claim on the top-2 slots searchQuran() uses.
  const prioritized = [...deduped].sort((a, b) => Number(GENERIC_LOW_VALUE.has(a)) - Number(GENERIC_LOW_VALUE.has(b)));
  return prioritized.slice(0,8);
}

// ── Rewired (2026-08-28): Quran retrieval now queries the local quran_ayahs
// table (full Saheeh International text + FTS, populated separately) instead
// of the external alquran.cloud keyword-search API. Same interface (still
// keyed off extractKeywords, still up to 2 keywords × 4 matches, still
// capped at 5 total, still returns QuranVerse[] in the same `ref` shape
// buildSystemPrompt/citation instructions already expect) — this also
// resolves the pre-existing bug where alquran.cloud's search endpoint kept
// returning the same fixed handful of verses regardless of query, since we
// no longer depend on it at all.
async function searchQuran(supabase: any, query: string): Promise<QuranVerse[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];
  const seen = new Set<string>();
  const verses: QuranVerse[] = [];
  await Promise.all(keywords.slice(0,2).map(async kw => {
    try {
      const { data, error } = await supabase
        .from("quran_ayahs")
        .select("surah_number, ayah_number, surah_name_english, translation_en")
        .textSearch("search_vector", kw, { type: "plain", config: "english" })
        .limit(4);
      if (error || !data) return;
      for (const row of data as any[]) {
        const key = `${row.surah_number}:${row.ayah_number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        verses.push({ ref:`${row.surah_name_english} ${row.surah_number}:${row.ayah_number}`, text:row.translation_en??"", surah:row.surah_number??0, ayah:row.ayah_number??0 });
      }
    } catch {}
  }));
  return verses.slice(0,5);
}

// ── New (2026-08-28): islamic_entities / entity_aliases wiring ───────────
// Detects mentions of known people/events — including transliteration
// variants via entity_aliases — and pulls back curated, human-verified
// background facts from islamic_entities to ground the model's general
// knowledge writing. Fully independent of Quran/Hadith retrieval and of
// validateAndClean's citation validation above: entity facts are plain
// background context, never given a bracket citation, and never affect
// hasContext or the strict citation-rules branch in buildSystemPrompt.
interface EntityRecord {
  canonical_name: string;
  arabic_name: string | null;
  category: string;
  era: string | null;
  description: string;
  related_entities: string[];
  verified_references: unknown;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function detectEntities(supabase: any, query: string): Promise<EntityRecord[]> {
  try {
    const { data: aliases, error } = await supabase
      .from("entity_aliases")
      .select("alias_normalized, canonical_entity");
    if (error || !aliases) return [];
    const matched = new Set<string>();
    for (const a of aliases as any[]) {
      const needle = (a.alias_normalized ?? "").trim();
      if (!needle) continue;
      if (new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(query)) matched.add(a.canonical_entity);
    }
    if (matched.size === 0) return [];
    const { data: entities, error: entErr } = await supabase
      .from("islamic_entities")
      .select("canonical_name, arabic_name, category, era, description, related_entities, verified_references")
      .in("canonical_name", [...matched])
      .limit(5);
    if (entErr || !entities) return [];
    return entities as EntityRecord[];
  } catch {
    return [];
  }
}

async function fetchOneHadith(collId: string, number: number): Promise<HadithRecord|null> {
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${collId}/${number}.json`,{ signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const raw = await res.json();
    const text: string|undefined = raw?.text ?? raw?.hadiths?.[0]?.text ?? (Array.isArray(raw) ? raw[0]?.text : undefined);
    if (!text || typeof text !== "string") return null;
    return { label: COLL_LABELS[collId]??collId, collId, number, text: text.replace(/\s+/g," ").trim().slice(0,900) };
  } catch { return null; }
}

// Shared by hadith retrieval and response logging — unchanged matching
// logic, just factored out so both callers stay in sync.
function matchTopics(qLower: string) {
  return TOPIC_MAP.filter(topic => topic.kw.some(kw => qLower.includes(kw)));
}

async function retrieveHadiths(query: string): Promise<{ records: HadithRecord[]; contextSet: Set<string> }> {
  const qLower = query.toLowerCase();
  const refs = new Map<string,{ c:string; n:number }>();
  for (const topic of matchTopics(qLower)) {
    for (const ref of topic.refs) {
      const key = `${ref.c}-${ref.n}`;
      if (!refs.has(key)) refs.set(key, ref);
    }
  }
  const toFetch = [...refs.values()].slice(0,8);
  const fetched = await Promise.all(toFetch.map(r => fetchOneHadith(r.c, r.n)));
  const records = fetched.filter((h): h is HadithRecord => h !== null);
  const contextSet = new Set(records.map(h => `${h.collId}-${h.number}`));
  return { records, contextSet };
}

function buildSystemPrompt(verses: QuranVerse[], hadiths: HadithRecord[], entities: EntityRecord[]): string {
  const hasContext = verses.length > 0 || hadiths.length > 0;

  let srcBlock = "";
  if (verses.length > 0) {
    srcBlock += "\n-- VERIFIED QURAN VERSES --\n";
    for (const v of verses) {
      // Include full retrieved text so the LLM can fact-check its own claims
      srcBlock += `[${v.ref}]\nFull text: "${v.text}"\n\n`;
    }
  }
  if (hadiths.length > 0) {
    srcBlock += "\n-- VERIFIED HADITH --\n";
    for (const h of hadiths) {
      srcBlock += `[${h.label} #${h.number}]\nFull text: "${h.text}"\n\n`;
    }
  }

  const citationRules = hasContext
    ? `RETRIEVED & VERIFIED SOURCES FOR THIS QUERY:
${srcBlock}
CITATION RULES — READ EVERY RULE BEFORE WRITING A SINGLE WORD:

1. ONLY cite sources listed in VERIFIED SOURCES above. Never cite from memory.

2. CONTENT ACCURACY CHECK (most important rule):
   Before citing any source, re-read its "Full text" above and ask:
   "Does this text LITERALLY say what I am about to claim?"
   If NO → do NOT add the citation. Write the claim without any citation instead.
   Example of what NOT to do: citing Ayat al-Kursi [Al-Baqarah 2:255] to support
   a claim about "gardens of delight" — Ayat al-Kursi is about Allah's eternal
   sovereignty, not gardens. Wrong contextual use of a real verse is as harmful
   as a fabricated reference.

3. DO NOT stretch citations. A verse about Paradise in general does not support
   a specific claim about Hoorain, houris, rivers of honey, or any detail not
   present in the retrieved text itself.

4. Quran format: [Surah Name Chapter:Verse]  e.g. [Al-Baqarah 2:255]
   Hadith format: [Collection #Number]        e.g. [Sahih Bukhari #1]

5. If no retrieved source directly supports a point, write:
   "Islamic scholarship generally holds that..." — never force a citation.

6. It is always better to make a claim without a citation than to misuse one.`
    : `CITATION RULES:
No specific Quran verses or Hadith were retrieved for this query.

You MAY use your general Islamic knowledge to explain and contextualize this
topic — established history, scholarly consensus, tradition (e.g. tafsir,
sirah, Qisas al-Anbiya), and well-known facts. Be as specific and informative
as you genuinely can about names, relationships, timelines, and context.

You must NEVER, under any circumstances, in this mode:
- Cite a specific Quran verse reference, e.g. [Al-Baqarah 2:255]
- Cite a specific Hadith number or collection, e.g. [Sahih Bukhari #1]
- Present any sentence as a direct quotation from the Quran or Hadith
- Attribute a claim to a named scholar or book as if verified, unless it is
  extremely well-established general knowledge (e.g. "Ibn Kathir's Stories
  of the Prophets includes...")

If a specific verse or hadith would normally back a claim, say plainly that
no verified source was retrieved for it and point the user to sunnah.com,
quran.com, or a qualified scholar — never invent one. When you are not fully
certain of a specific detail, say so ("according to some traditions...",
"Islamic scholarship generally holds...") instead of presenting it as
settled fact.`;

  // Entity background is additive and orthogonal to hasContext above — it's
  // shown whenever a known person/event is detected, whether or not a Quran
  // verse or Hadith also matched, since it answers a different need
  // (biographical/historical grounding vs. verse/hadith citation).
  let entityBlock = "";
  if (entities.length > 0) {
    entityBlock = "\nVERIFIED ENTITY REFERENCE (curated background facts — use freely; this is not a Quran verse or Hadith and must never be given a bracket citation like [Al-Baqarah 2:255] or [Sahih Bukhari #1]):\n";
    for (const e of entities) {
      const arabic = e.arabic_name ? ` (${e.arabic_name})` : "";
      const era = e.era ? `, ${e.era} era` : "";
      entityBlock += `- ${e.canonical_name}${arabic} — ${e.category}${era}: ${e.description}\n`;
    }
    entityBlock += "\n";
  }

  return `You are NUR, a warm and knowledgeable Islamic assistant grounded in the Quran and authentic Sunnah.

${citationRules}
${entityBlock}
RESPONSE GUIDELINES:
- Write in flowing connected paragraphs, not bullet points.
- Be warm, encouraging, and spiritually uplifting.
- Distinguish between scholarly consensus (ijma) and disagreement (ikhtilaf) where relevant.
- For personal fatwas, always advise consulting a qualified scholar.
- Respond in the same language the user writes in.
- Aim for 2-3 focused paragraphs — do not pad the response.
- End with: Allahu A'lam (Allah knows best).`;
}

const HADITH_CITE_RE = /\[((?:Sahih\s+)?(?:Bukhari|Muslim|Abu\s+Dawud|Tirmidhi|Jami[^\]]{0,20}?|An-Nasai|Nasai|Ibn\s+Majah))\s*[,#]?\s*(?:Hadith\s+)?#?(\d{1,5})\]/gi;
const LABEL_TO_ID: Record<string,string> = { bukhari:"bukhari","sahih bukhari":"bukhari",muslim:"muslim","sahih muslim":"muslim","abu dawud":"abudawud",tirmidhi:"tirmidhi",jami:"tirmidhi","an-nasai":"nasai",nasai:"nasai","ibn majah":"ibnmajah",ibnmajah:"ibnmajah" };

function resolveCollId(raw: string): string|null {
  const lower = raw.toLowerCase().trim();
  for (const [key, id] of Object.entries(LABEL_TO_ID)) { if (lower.includes(key)) return id; }
  return null;
}

function validateAndClean(response: string, contextSet: Set<string>): string {
  const hits: { raw:string; inContext:boolean }[] = [];
  const re = new RegExp(HADITH_CITE_RE.source,"gi");
  let m: RegExpExecArray|null;
  while ((m = re.exec(response)) !== null) {
    const collId = resolveCollId(m[1]);
    const num = parseInt(m[2],10);
    hits.push({ raw:m[0], inContext:!!(collId && contextSet.has(`${collId}-${num}`)) });
  }
  let cleaned = response;
  for (const { raw, inContext } of hits) { if (!inContext) cleaned = cleaned.replace(raw,""); }
  return cleaned.replace(/  +/g," ").replace(/ ([.,;:])/g,"$1").trim();
}

async function getUsageForDate(supabase: any, deviceId: string, localDate: string): Promise<number> {
  const { data, error } = await supabase.from("usage_log").select("count").eq("device_id",deviceId).eq("local_date",localDate).maybeSingle();
  if (error) throw error;
  return data?.count ?? 0;
}

async function incrementUsage(supabase: any, deviceId: string, localDate: string): Promise<number> {
  const { data, error } = await supabase.rpc("increment_usage_count",{ p_device_id:deviceId, p_local_date:localDate });
  if (error) throw error;
  return data;
}

// ── New: question normalization ──────────────────────────────────────────
function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── New: light/complex classifier ────────────────────────────────────────
// Deterministic keyword scan first — the 120B model is never asked to
// classify every request. Uncertainty always resolves to "complex".
const COMPLEX_SIGNALS = [
  "halal","haram","ruling","fatwa","permissible","forbidden","wajib","fard",
  "sunnah ruling","bid'ah","bidah","madhhab","hanafi","shafi","maliki","hanbali",
  "authentic","sahih hadith","weak hadith","fabricated hadith","difference of opinion",
  "scholars say","scholarly evidence","marriage ruling","divorce","inheritance",
  "finance","riba","interest","zakat calculation","can i","is it permissible",
  "is this allowed","is it allowed","is it haram","is it halal",
];
const LIGHT_SIGNALS = [
  "what is","what does","what are","meaning of","define","definition of",
  "who was","who is","simple explanation","basic history","short dua",
  "general concept","basic terminology",
];
const PERSONAL_PATTERNS = [
  /\bcan i\b/i, /\bam i\b/i, /\bshould i\b/i, /\bfor me\b/i,
  /\bmy (husband|wife|spouse|marriage|job|business|income|loan|debt|family|situation|case|father|mother|son|daughter|health|divorce)\b/i,
];
const TIME_SENSITIVE_PATTERNS = [
  /\btoday\b/i, /\btonight\b/i, /\bthis (week|month|year)\b/i, /\bcurrently\b/i,
  /\bright now\b/i, /\bcurrent (ruling|fatwa|situation|fiqh)\b/i, /\b(this|last|next) ramadan\b/i,
];

type QueryComplexity = { level: "light" | "complex"; confidence: number; reason: string };

function classifyComplexity(query: string): QueryComplexity {
  const q = query.toLowerCase();
  const complexHits = COMPLEX_SIGNALS.filter(s => q.includes(s));
  const personalHits = PERSONAL_PATTERNS.some(re => re.test(query));
  const lightHits = LIGHT_SIGNALS.filter(s => q.includes(s));

  if (complexHits.length > 0 || personalHits) {
    const score = complexHits.length + (personalHits ? 2 : 0);
    return {
      level: "complex",
      confidence: Math.min(0.99, 0.75 + 0.06 * score),
      reason: personalHits ? "personal-circumstance phrasing" : `matched: ${complexHits.slice(0,3).join(", ")}`,
    };
  }
  if (lightHits.length > 0) {
    return {
      level: "light",
      confidence: Math.min(0.97, 0.7 + 0.08 * lightHits.length),
      reason: `matched: ${lightHits.slice(0,3).join(", ")}`,
    };
  }
  // No strong signal either way — uncertain, so default to complex/low-confidence.
  // The confidence-threshold check below will route this to 120B regardless.
  return { level: "complex", confidence: 0.3, reason: "no strong signal — defaulting to complex per uncertainty rule" };
}

// ── New: log-safety classifier ───────────────────────────────────────────
// Deliberately conservative: anything classified "complex" is excluded by
// construction, since the complex signals above ARE the fiqh/madhhab/
// authenticity/personal markers that shouldn't be recorded as generic,
// reusable Q&A data. Light questions are loggable unless they also carry
// a personal or time-sensitive marker.
function classifySafeToLog(query: string, complexity: QueryComplexity): boolean {
  if (complexity.level === "complex") return false;
  if (PERSONAL_PATTERNS.some(re => re.test(query))) return false;
  if (TIME_SENSITIVE_PATTERNS.some(re => re.test(query))) return false;
  return true;
}

// ── New: Groq call with retry + the failure-handling rules from §16 ─────
async function callGroqOnce(model: string, systemPrompt: string, messages: any[]): Promise<
  { ok: true; reply: string } | { ok: false; rateLimited: true; retryAfter: number } | { ok: false; rateLimited: false; error: string }
> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model, max_tokens: 1200, temperature: 0.2,
      messages: [{ role: "system", content: systemPrompt }, ...messages.map((m:any) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    return { ok: false, rateLimited: true, retryAfter: retryAfterHeader ? parseInt(retryAfterHeader,10) : 20 };
  }
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, rateLimited: false, error: `Groq error ${res.status}: ${err}` };
  }
  const json = await res.json();
  return { ok: true, reply: (json.choices?.[0]?.message?.content ?? "").trim() };
}

async function generateReply(level: "light" | "complex", systemPrompt: string, messages: any[]): Promise<
  { reply: string; modelUsed: string } | { rateLimited: true; retryAfter: number } | { error: string }
> {
  const primaryModel = level === "light" ? MODEL_LIGHT : MODEL_COMPLEX;

  let result = await callGroqOnce(primaryModel, systemPrompt, messages);
  if ("rateLimited" in result && result.rateLimited) return result;
  if (result.ok) return { reply: result.reply, modelUsed: primaryModel };

  console.error(`[nur-proxy] ${primaryModel} failed: ${(result as any).error}. Retrying once.`);
  result = await callGroqOnce(primaryModel, systemPrompt, messages);
  if ("rateLimited" in result && result.rateLimited) return result;
  if (result.ok) return { reply: result.reply, modelUsed: primaryModel };

  // Both attempts on the primary model failed.
  if (level === "light") {
    // §16: 20B failure → retry once → 120B fallback.
    console.error(`[nur-proxy] ${MODEL_LIGHT} failed twice, falling back to ${MODEL_COMPLEX}.`);
    const fallback = await callGroqOnce(MODEL_COMPLEX, systemPrompt, messages);
    if ("rateLimited" in fallback && fallback.rateLimited) return fallback;
    if (fallback.ok) return { reply: fallback.reply, modelUsed: MODEL_COMPLEX };
    return { error: (fallback as any).error };
  }
  // §16: 120B failure → retry once → controlled error. Never silently
  // downgrade a complex/ruling question to 20B.
  return { error: (result as any).error };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null,{ status:200, headers:CORS });
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let deviceIdForLog = "unknown";

  try {
    const body = await req.json();
    const { device_id, local_date, messages, unlock_code } = body;
    if (!device_id) return new Response(JSON.stringify({ error:"Missing device_id" }),{ status:400, headers:JSON_H });
    deviceIdForLog = device_id;
    const usageDate = local_date || new Date().toISOString().split("T")[0];

    if (unlock_code) {
      const { data:license, error } = await supabase.from("licenses").select("id, used_by").eq("unlock_code",unlock_code.trim().toUpperCase()).single();
      if (error || !license) return new Response(JSON.stringify({ error:"Invalid unlock code" }),{ status:400, headers:JSON_H });
      const usedBy = license.used_by ?? [];
      if (!usedBy.includes(device_id)) await supabase.from("licenses").update({ used_by:[...usedBy,device_id] }).eq("id",license.id);
      return new Response(JSON.stringify({ unlocked:true }),{ status:200, headers:JSON_H });
    }

    const { data:licenseRow } = await supabase.from("licenses").select("id").contains("used_by",[device_id]).limit(1).maybeSingle();
    const isUnlocked = !!licenseRow;

    // Unchanged: existing 15/day gate, same position, same behavior — this is
    // the one thing §11/§20 both require to keep working exactly as today.
    if (!isUnlocked) {
      const usedToday = await getUsageForDate(supabase,device_id,usageDate);
      if (usedToday >= DAILY_LIMIT) return new Response(JSON.stringify({ error:"Daily limit reached",remaining:0 }),{ status:429, headers:JSON_H });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return new Response(JSON.stringify({ error:"Missing messages" }),{ status:400, headers:JSON_H });

    const userQuery = ([...messages].reverse().find((m:any) => m.role==="user")?.content ?? "");
    const normalizedQuestion = normalizeQuestion(userQuery);
    const qLower = userQuery.toLowerCase();
    const topicKeys = matchTopics(qLower).map(t => t.key);

    // classifyComplexity/classifySafeToLog decide what's worth recording
    // to ai_response_log below — there's no cache lookup or hit path at all.
    const complexity = classifyComplexity(userQuery);
    const isSafeToLog = classifySafeToLog(userQuery, complexity);

    // ── RAG + classification + generation (always runs — nothing is ever served from stored data) ──
    // Fix (2026-08-26): RAG retrieval (Quran search + hadith topic matching)
    // runs on the context-stripped question, not the raw client payload —
    // see stripContextPreamble() for why. The LLM still receives the raw,
    // un-stripped userQuery (via `messages`) so personalization context
    // (e.g. "the person asking is a teenager") still reaches the model.
    const ragQuery = stripContextPreamble(userQuery);
    const [verses, { records:hadiths, contextSet }, entities] = await Promise.all([
      searchQuran(supabase, ragQuery), retrieveHadiths(ragQuery), detectEntities(supabase, ragQuery),
    ]);
    console.log(`[RAG] verses=${verses.length} hadiths=${hadiths.length} entities=${entities.length} context=[${[...contextSet].join(",")}]`);

    const systemPrompt = buildSystemPrompt(verses, hadiths, entities);

    const routeLevel: "light" | "complex" =
      complexity.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD ? complexity.level : "complex";
    console.log(`[classify] level=${complexity.level} route=${routeLevel} confidence=${complexity.confidence.toFixed(2)} reason="${complexity.reason}"`);

    const genResult = await generateReply(routeLevel, systemPrompt, messages);

    if ("rateLimited" in genResult) {
      console.error(`[nur-proxy] Groq rate limited, retry_after=${genResult.retryAfter}`);
      return new Response(JSON.stringify({
        error: "NUR is getting a lot of requests right now. Please try again in a moment.",
        rate_limited: true, retry_after: genResult.retryAfter,
      }), { status:429, headers:JSON_H });
    }
    if ("error" in genResult) throw new Error(genResult.error);

    const rawReply = genResult.reply;
    const modelUsed = genResult.modelUsed;

    // RAG Step 4 (unchanged): validate — strip any hadith number not in contextSet
    const reply = validateAndClean(rawReply, contextSet);
    const hadCitationIssues = rawReply.length !== reply.length;
    if (hadCitationIssues) console.log(`[RAG] Stripped ${rawReply.length - reply.length} chars of unverified citations`);

    let remaining = 999;
    if (!isUnlocked) { const n = await incrementUsage(supabase,device_id,usageDate); remaining = Math.max(0,DAILY_LIMIT-n); }

    // ── Response logging (data collection only — never read back to serve
    // a response; see ai_response_log). Never blocks the user-facing reply.
    if (isSafeToLog) {
      try {
        await logResponse(supabase, {
          deviceId: device_id, normalizedQuestion, topicKeys, userQuery, reply,
          sourceRefs: { verses: verses.map(v=>v.ref), hadiths: [...contextSet] },
          model: modelUsed, generationType: routeLevel, hadCitationIssues,
        });
      } catch (err: any) {
        console.error("[nur-proxy] response log write failed (non-fatal):", err?.message ?? err);
      }
    }

    await logMetric(supabase, device_id, usageDate, "ai_request", {
      model: modelUsed, generation_type: routeLevel,
      classification_confidence: complexity.confidence, citation_issues: hadCitationIssues,
      safe_to_log: isSafeToLog, topic_keys: topicKeys,
    });

    return new Response(JSON.stringify({ reply, remaining, unlocked:isUnlocked, model: modelUsed }),{ status:200, headers:JSON_H });

  } catch (err: any) {
    console.error("[nur-proxy] Fatal:", err?.message ?? err);
    await logMetric(supabase, deviceIdForLog, new Date().toISOString().split("T")[0], "ai_provider_failure", { message: err?.message ?? String(err) });
    return new Response(JSON.stringify({ error: err?.message ?? "Internal server error" }),{ status:500, headers:JSON_H });
  }
});

// ── Response logging — data collection only, never read back to serve a
// response. Kept deliberately simple (one insert, no matching/clustering)
// since semantic-cache serving was tried and dropped as too fragile to
// trust; if NUR's traffic ever grows enough to justify revisiting that,
// this table is the raw material to build from.
async function logResponse(supabase: any, opts: {
  deviceId: string; normalizedQuestion: string; topicKeys: string[]; userQuery: string; reply: string;
  sourceRefs: unknown; model: string; generationType: string; hadCitationIssues: boolean;
}) {
  const { deviceId, normalizedQuestion, topicKeys, userQuery, reply, sourceRefs, model, generationType, hadCitationIssues } = opts;
  const { error } = await supabase.from("ai_response_log").insert({
    device_id: deviceId,
    question: userQuery,
    normalized_question: normalizedQuestion,
    topic_keys: topicKeys,
    answer: reply,
    source_refs: sourceRefs,
    model,
    generation_type: generationType,
    had_citation_issues: hadCitationIssues,
    rag_version: RAG_VERSION, prompt_version: PROMPT_VERSION, validation_version: VALIDATION_VERSION,
  });
  if (error) throw error;
}

// ── Lightweight metrics — reuses the existing `events` table rather than
// introducing a new one, same pattern already used elsewhere in this project.
// Previously fired via EdgeRuntime.waitUntil as a background task; that
// wasn't landing any rows in production (ai_response_log, which is properly
// awaited, worked fine — this, fire-and-forget, didn't: the function tore
// down before the insert completed). Simplest reliable fix: just await it.
async function logMetric(supabase: any, deviceId: string, localDate: string, event: string, properties: Record<string, unknown>) {
  try {
    await supabase.from("events").insert({ device_id: deviceId, event, properties, local_date: localDate });
  } catch (err: any) {
    console.error("[nur-proxy] metric log failed:", err?.message ?? err);
  }
}
