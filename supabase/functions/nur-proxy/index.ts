import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Config ───────────────────────────────────────────────────────────────
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MODEL_LIGHT   = Deno.env.get("NUR_MODEL_LIGHT")   ?? "openai/gpt-oss-20b";
const MODEL_COMPLEX = Deno.env.get("NUR_MODEL_COMPLEX") ?? "openai/gpt-oss-120b";
const CLASSIFICATION_CONFIDENCE_THRESHOLD = parseFloat(Deno.env.get("NUR_CLASSIFICATION_CONFIDENCE_THRESHOLD") ?? "0.75");

// Every safe, validated generation is logged to ai_response_log (data collection only —
// nothing is ever read back from that table to serve a response).
const RAG_VERSION        = "v1";
const PROMPT_VERSION     = "v1";
const VALIDATION_VERSION = "v1";

interface QuranVerse   { ref: string; text: string; surah: number; ayah: number; }
interface HadithRecord { label: string; collId: string; number: number; text: string; }

const COLL_LABELS: Record<string, string> = {
  bukhari:  "Sahih Bukhari",
  muslim:   "Sahih Muslim",
  abudawud: "Abu Dawud",
  // Bare "Tirmidhi" matches the client's own citation regex (ChatTab.jsx HADITH_CITATION).
  tirmidhi: "Tirmidhi",
  nasai:    "An-Nasai",
  ibnmajah: "Ibn Majah",
};

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

// Strip a leading bracketed context/personalization header (e.g. "[Context: ...]") before
// keyword extraction / topic matching, so it doesn't crowd out the real question's words.
function stripContextPreamble(query: string): string {
  return query.replace(/^\[[^\]]*\]\s*\n+/, "").trim();
}

// Transliterated names/concepts -> the spelling used in the Saheeh International translation.
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
  tawakkul: "rely", tawakul: "rely", tawakal: "rely",
  anxiety: "distress", anxious: "distress",
  iman: "faith", eeman: "faith", imaan: "faith",
};

// Generic words that are valid keywords but crowd out a more specific term.
const GENERIC_LOW_VALUE = new Set([
  "prophet", "prophets", "messenger", "messengers", "islam", "muslim", "muslims", "religion", "people",
  "deal", "dealing", "cope", "coping", "handle", "handling", "manage", "managing", "overcome", "overcoming",
]);

function extractKeywords(query: string): string[] {
  const stop = new Set(["what","does","the","say","about","how","are","were","been","into","more","some","also","then","them","they","their","in","on","to","and","or","for","with","of","that","this","should","can","will","have","has","had","tell","please","explain","when","who","why","which","there","from"]);
  const rawWords = query.toLowerCase().replace(/[^a-z\s]/g," ").split(/\s+/).filter(Boolean);
  const normalized = rawWords.map(w => NAME_ALIASES[w] ?? w);
  const filtered = normalized.filter(w => w.length > 3 && !stop.has(w));
  const seen = new Set<string>();
  const deduped = filtered.filter(w => (seen.has(w) ? false : (seen.add(w), true)));
  const prioritized = [...deduped].sort((a, b) => Number(GENERIC_LOW_VALUE.has(a)) - Number(GENERIC_LOW_VALUE.has(b)));
  return prioritized.slice(0,8);
}

// Quran retrieval from the local quran_ayahs table via the ranked search_quran_ayahs RPC.
async function searchQuran(supabase: any, query: string): Promise<QuranVerse[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];
  const seen = new Set<string>();
  const verses: QuranVerse[] = [];
  await Promise.all(keywords.slice(0,3).map(async kw => {
    try {
      const { data, error } = await supabase.rpc("search_quran_ayahs", { search_query: kw, match_limit: 4 });
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

// islamic_entities / entity_aliases: curated background facts for known people/events.
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
    const [{ data: entities, error: entErr }, { data: aliases, error: aliasErr }] = await Promise.all([
      supabase.from("islamic_entities").select("canonical_name, arabic_name, category, era, description, related_entities, verified_references"),
      supabase.from("entity_aliases").select("alias_normalized, canonical_entity"),
    ]);
    if (entErr || !entities) return [];

    // Match set = canonical names ∪ aliases.
    const byName = new Map<string, EntityRecord>();
    const termToCanonical = new Map<string, string>();
    for (const e of entities as EntityRecord[]) {
      byName.set(e.canonical_name.toLowerCase(), e);
      termToCanonical.set(e.canonical_name.toLowerCase(), e.canonical_name);
    }
    if (!aliasErr && aliases) {
      for (const a of aliases as any[]) {
        const needle = (a.alias_normalized ?? "").trim();
        if (needle) termToCanonical.set(needle, a.canonical_entity);
      }
    }

    const matched = new Set<string>();
    for (const [term, canonical] of termToCanonical) {
      if (new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(query)) matched.add(canonical);
    }
    if (matched.size === 0) return [];
    const results: EntityRecord[] = [];
    for (const name of matched) {
      const e = byName.get(name.toLowerCase());
      if (e) results.push(e);
    }
    return results.slice(0,5);
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

6. It is always better to make a claim without a citation than to misuse one.

7. NEVER write "the Prophet ﷺ said/taught that..." (or attribute a specific
   line to a named narrator/scholar) unless that exact claim is one of the
   VERIFIED SOURCES above and you give it a bracket citation. A retrieved
   source list that doesn't happen to cover this specific point is not
   permission to invent an uncited direct attribution instead — fall back
   to rule 5's general framing ("Islamic teaching holds that...") the same
   way you would if no sources had been retrieved at all.`
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
- Write "the Prophet ﷺ said/taught that..." as if quoting a specific,
  identifiable hadith — even paraphrased. If you're confident a real hadith
  says something like this, say so as general teaching ("Islamic tradition
  teaches that...") rather than a direct attribution you can't cite here.
- Attribute a claim to a named scholar or book as if verified, unless it is
  extremely well-established general knowledge (e.g. "Ibn Kathir's Stories
  of the Prophets includes...")

If a specific verse or hadith would normally back a claim, say plainly that
no verified source was retrieved for it and point the user to sunnah.com,
quran.com, or a qualified scholar — never invent one. When you are not fully
certain of a specific detail, say so ("according to some traditions...",
"Islamic scholarship generally holds...") instead of presenting it as
settled fact.`;

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

NAME ACCURACY (read before writing anything): Islamic figures often have
similar-sounding transliterated names — e.g. "Isa" (Jesus) is not "Isaiah",
"Yahya" is not "Yahya ibn ..." any other Yahya, "Zakariyya" is not
"Zakat". Answer strictly about the exact name/spelling the user gave. Never
substitute a more familiar or more frequently-discussed figure just because
the name sounds similar. If you are not confident which figure is meant, or
whether the named figure appears in the Quran at all, say so plainly instead
of quietly answering about a different person.

COMMON PHRASE ACCURACY (2026-08-31 fix): if you want to include any of these
common Arabic phrases, use EXACTLY this transliteration — do not improvise
your own spelling from memory, even for a phrase you're sure you know:
- بِسْمِ اللَّهِ → "Bismillah" (In the name of Allah)
- الحمد لله → "Alhamdulillah" (All praise is due to Allah)
- سبحان الله → "SubhanAllah" (Glory be to Allah)
- الله أكبر → "Allahu Akbar" (Allah is the Greatest)
- لا إله إلا الله → "La ilaha illallah" (There is no god but Allah)
- لا حول ولا قوة إلا بالله → "La hawla wa la quwwata illa billah" (There is
  no power and no strength except with Allah)
- أستغفر الله → "Astaghfirullah" (I seek forgiveness from Allah)
- إن شاء الله → "InshaAllah" (If Allah wills)
- ما شاء الله → "MashaAllah" (What Allah has willed)
- جزاك الله خيرا → "JazakAllahu khayran" (May Allah reward you with good)
If a phrase you want to use is not on this list, write it in Arabic script
only or paraphrase its meaning in English — do not invent a transliteration
for anything not listed here. A dropped or altered word in a transliterated
phrase is a real, common error type and hard for a reader to catch.

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

function validateAndClean(response: string, contextSet: Set<string>): { text: string; hadInvalid: boolean } {
  const hits: { raw:string; inContext:boolean }[] = [];
  const re = new RegExp(HADITH_CITE_RE.source,"gi");
  let m: RegExpExecArray|null;
  while ((m = re.exec(response)) !== null) {
    const collId = resolveCollId(m[1]);
    const num = parseInt(m[2],10);
    hits.push({ raw:m[0], inContext:!!(collId && contextSet.has(`${collId}-${num}`)) });
  }
  let cleaned = response;
  let hadInvalid = false;
  for (const { raw, inContext } of hits) {
    if (!inContext) { hadInvalid = true; cleaned = cleaned.replace(raw,""); }
  }
  return { text: cleaned.replace(/  +/g," ").replace(/ ([.,;:])/g,"$1").trim(), hadInvalid };
}

// Quran citations: only a citation whose surah:ayah matches a retrieved verse is kept.
const QURAN_CITE_RE = /\[([A-Za-z][A-Za-z'’.\- ]{1,30}?)\s+(\d{1,3}):(\d{1,3})\]/g;

function validateAndLinkQuran(response: string, verses: QuranVerse[]): { text: string; hadInvalid: boolean } {
  const hits: { raw:string; valid:boolean }[] = [];
  const re = new RegExp(QURAN_CITE_RE.source, "g");
  let m: RegExpExecArray|null;
  while ((m = re.exec(response)) !== null) {
    const surah = parseInt(m[2],10);
    const ayah = parseInt(m[3],10);
    hits.push({ raw:m[0], valid: verses.some(v => v.surah === surah && v.ayah === ayah) });
  }
  let cleaned = response;
  let hadInvalid = false;
  for (const { raw, valid } of hits) {
    if (!valid) { hadInvalid = true; cleaned = cleaned.replace(raw,""); }
  }
  return { text: cleaned.replace(/  +/g," ").replace(/ ([.,;:])/g,"$1").trim(), hadInvalid };
}

function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Deterministic light/complex classifier; uncertainty always resolves to "complex".
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
  return { level: "complex", confidence: 0.3, reason: "no strong signal — defaulting to complex per uncertainty rule" };
}

function classifySafeToLog(query: string, complexity: QueryComplexity): boolean {
  if (complexity.level === "complex") return false;
  if (PERSONAL_PATTERNS.some(re => re.test(query))) return false;
  if (TIME_SENSITIVE_PATTERNS.some(re => re.test(query))) return false;
  return true;
}

async function callGroqOnce(model: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<
  { ok: true; reply: string } | { ok: false; rateLimited: true; retryAfter: number } | { ok: false; rateLimited: false; error: string }
> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model, max_tokens: 1200, temperature: 0.2,
      messages: [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    return { ok: false, rateLimited: true, retryAfter: retryAfterHeader ? parseInt(retryAfterHeader,10) : 20 };
  }
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, rateLimited: false, error: `Groq error ${res.status}: ${err.slice(0, 200)}` };
  }
  const json = await res.json();
  return { ok: true, reply: (json.choices?.[0]?.message?.content ?? "").trim() };
}

async function generateReply(level: "light" | "complex", systemPrompt: string, messages: { role: string; content: string }[]): Promise<
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

  if (level === "light") {
    console.error(`[nur-proxy] ${MODEL_LIGHT} failed twice, falling back to ${MODEL_COMPLEX}.`);
    const fallback = await callGroqOnce(MODEL_COMPLEX, systemPrompt, messages);
    if ("rateLimited" in fallback && fallback.rateLimited) return fallback;
    if (fallback.ok) return { reply: fallback.reply, modelUsed: MODEL_COMPLEX };
    return { error: (fallback as any).error };
  }
  // Never silently downgrade a complex/ruling question to the light model.
  return { error: (result as any).error };
}

// Response logging — data collection only, never read back to serve a response.
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

// Lightweight metrics into the existing `events` table (awaited so the row actually lands).
async function logMetric(supabase: any, deviceId: string, localDate: string, event: string, properties: Record<string, unknown>) {
  try {
    await supabase.from("events").insert({ device_id: deviceId, event, properties, local_date: localDate });
  } catch (err: any) {
    console.error("[nur-proxy] metric log failed:", err?.message ?? err);
  }
}

// ── v63 hardened request layer. Everything above this block in index.ts (RAG, prompt,
// validation of citations, classifier, Groq calls, logging) is unchanged from v62. ──

const FREE_DAILY_LIMIT = 15;               // free messages per local day (unchanged)
const UTC_DAY_SAFETY_CAP = 30;             // per device per UTC day: stops date-hopping (allows legit 2×15 straddle)
const PRO_DAILY_CAP = 200;                 // sanity cap for Pro devices / shared codes
const MAX_DEVICES_PER_LICENCE = 3;
const GLOBAL_DAILY_CAP = parseInt(Deno.env.get("NUR_GLOBAL_DAILY_CAP") ?? "5000", 10);
const REQUIRE_DEVICE_KEY = Deno.env.get("NUR_REQUIRE_DEVICE_KEY") === "1";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY = 12;                    // most recent messages forwarded to the model
const MAX_MSG_CHARS = 4000;

const ALLOWED_ORIGINS = new Set([
  "https://nur-islamic-ai.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsFor(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(o) ? o : "https://nur-islamic-ai.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Key",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

async function hmacShort(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SUPABASE_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(mac)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function utcDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

// The client says which local day it is; the server only accepts a date within one day of UTC
// (covers every real timezone) and otherwise uses its own date.
function resolveUsageDate(clientDate: unknown): string {
  if (typeof clientDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    if (clientDate === utcDate(-1) || clientDate === utcDate(0) || clientDate === utcDate(1)) return clientDate;
  }
  return utcDate(0);
}

type Msg = { role: "user" | "assistant"; content: string };

function sanitizeMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: Msg[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const role = (m as any).role;
    const content = (m as any).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null; // no "system" spoofing
    out.push({ role, content: content.slice(0, MAX_MSG_CHARS) });
  }
  const recent = out.slice(-MAX_HISTORY);
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (recent.length === 0 || recent[recent.length - 1].role !== "user" || !recent[recent.length - 1].content.trim()) return null;
  return recent;
}

Deno.serve(async (req: Request) => {
  const C = corsFor(req);
  const JH = { ...C, "Content-Type": "application/json" };
  const reply = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: JH });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: C });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  // Browsers always send Origin on cross-origin POSTs; reject foreign sites outright.
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Forbidden" }, 403);

  const len = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (len > MAX_BODY_BYTES) return reply({ error: "Request too large" }, 413);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let deviceIdForLog = "unknown";
  let reserved: { free?: [string, string]; utc?: [string, string]; pro?: [string, string] } = {};

  const refund = async () => {
    try {
      for (const k of ["free", "utc", "pro"] as const) {
        const r = reserved[k];
        if (r) await supabase.rpc("refund_quota", { p_device: r[0], p_date: r[1] });
      }
    } catch (e) { console.error("[nur-proxy] refund failed:", String(e)); }
    reserved = {};
  };

  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return reply({ error: "Request too large" }, 413);
    let body: any;
    try { body = JSON.parse(text); } catch { return reply({ error: "Invalid request" }, 400); }
    if (!body || typeof body !== "object") return reply({ error: "Invalid request" }, 400);

    const { device_id, local_date, messages, unlock_code } = body;
    if (typeof device_id !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(device_id)) {
      return reply({ error: "Missing device_id" }, 400);
    }
    deviceIdForLog = device_id;

    // ── Network + device identity ───────────────────────────────────────
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const ipH = await hmacShort(ip);

    const deviceKey = req.headers.get("x-device-key") ?? "";
    if (deviceKey) {
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(deviceKey)) return reply({ error: "Device verification failed" }, 403);
      const { data: bind } = await supabase.rpc("bind_device_key", { p_device: device_id, p_key_hash: await sha256Hex(deviceKey) });
      if (bind === "mismatch") return reply({ error: "Device verification failed" }, 403);
    } else if (REQUIRE_DEVICE_KEY) {
      return reply({ error: "Please refresh the app to continue." }, 403);
    }

    const limited = async (key: string, windowS: number, max: number) => {
      const { data, error } = await supabase.rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowS, p_max: max });
      return !error && data === false;
    };

    // ── Licence redemption path ─────────────────────────────────────────
    if (unlock_code !== undefined && unlock_code !== null) {
      if (typeof unlock_code !== "string" || unlock_code.length > 64) return reply({ error: "Invalid unlock code" }, 400);
      if (await limited(`redeem:ip:${ipH}`, 3600, 10) || await limited(`redeem:dev:${device_id}`, 3600, 10)) {
        return reply({ error: "Too many attempts. Please try again later." }, 429);
      }
      const { data: res, error } = await supabase.rpc("redeem_license", {
        p_code: unlock_code, p_device: device_id, p_max_devices: MAX_DEVICES_PER_LICENCE,
      });
      if (error) throw error;
      if (res === "ok") return reply({ unlocked: true });
      if (res === "device_limit") return reply({ error: `This code is already active on ${MAX_DEVICES_PER_LICENCE} devices.` }, 403);
      return reply({ error: "Invalid unlock code" }, 400);
    }

    // ── Chat path: validate payload ─────────────────────────────────────
    const msgs = sanitizeMessages(messages);
    if (!msgs) return reply({ error: "Missing messages" }, 400);

    // ── Rate limits (cheap, before any model work) ──────────────────────
    if (await limited(`chat:ip:${ipH}`, 60, 20) || await limited(`chat:dev:${device_id}`, 60, 6)) {
      return reply({ error: "You're sending messages too quickly. Please wait a moment.", rate_limited: true, retry_after: 30 }, 429);
    }

    // ── Pro status (revoked licences don't count) ───────────────────────
    const { data: licenseRow } = await supabase.from("licenses").select("id")
      .contains("used_by", [device_id]).is("revoked_at", null).limit(1).maybeSingle();
    const isUnlocked = !!licenseRow;

    const usageDate = resolveUsageDate(local_date);
    let remaining = 999;

    if (!isUnlocked) {
      // Free users sharing/rotating IDs: generous per-IP daily ceiling (CGNAT-safe).
      if (await limited(`chat:ipday:${ipH}`, 86400, 150)) {
        return reply({ error: "Daily limit reached", remaining: 0 }, 429);
      }
      // Atomic reservation: the count is incremented only if still below the limit.
      const { data: q, error: qErr } = await supabase.rpc("consume_quota", { p_device: device_id, p_date: usageDate, p_limit: FREE_DAILY_LIMIT });
      if (qErr) throw qErr;
      const row = Array.isArray(q) ? q[0] : q;
      if (!row?.allowed) return reply({ error: "Daily limit reached", remaining: 0 }, 429);
      reserved.free = [device_id, usageDate];
      remaining = Math.max(0, FREE_DAILY_LIMIT - (row.used ?? FREE_DAILY_LIMIT));

      const { data: u } = await supabase.rpc("consume_quota", { p_device: device_id, p_date: `u:${utcDate(0)}`, p_limit: UTC_DAY_SAFETY_CAP });
      const urow = Array.isArray(u) ? u[0] : u;
      if (!urow?.allowed) { await refund(); return reply({ error: "Daily limit reached", remaining: 0 }, 429); }
      reserved.utc = [device_id, `u:${utcDate(0)}`];
    } else {
      const { data: p } = await supabase.rpc("consume_quota", { p_device: device_id, p_date: `p:${utcDate(0)}`, p_limit: PRO_DAILY_CAP });
      const prow = Array.isArray(p) ? p[0] : p;
      if (!prow?.allowed) return reply({ error: "Daily limit reached", remaining: 0 }, 429);
      reserved.pro = [device_id, `p:${utcDate(0)}`];
    }

    // Global spend safety net
    if (await limited("global:day", 86400, GLOBAL_DAILY_CAP)) {
      await refund();
      return reply({ error: "NUR is very busy right now. Please try again later." }, 503);
    }

    // ── RAG + generation (unchanged behaviour) ──────────────────────────
    const userQuery = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    const normalizedQuestion = normalizeQuestion(userQuery);
    const topicKeys = matchTopics(userQuery.toLowerCase()).map((t) => t.key);
    const complexity = classifyComplexity(userQuery);
    const isSafeToLog = classifySafeToLog(userQuery, complexity);

    const ragQuery = stripContextPreamble(userQuery);
    const [verses, { records: hadiths, contextSet }, entities] = await Promise.all([
      searchQuran(supabase, ragQuery), retrieveHadiths(ragQuery), detectEntities(supabase, ragQuery),
    ]);
    console.log(`[RAG] verses=${verses.length} hadiths=${hadiths.length} entities=${entities.length}`);

    const systemPrompt = buildSystemPrompt(verses, hadiths, entities);
    const routeLevel: "light" | "complex" =
      complexity.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD ? complexity.level : "complex";

    const genResult = await generateReply(routeLevel, systemPrompt, msgs);

    if ("rateLimited" in genResult) {
      await refund();
      console.error(`[nur-proxy] Groq rate limited, retry_after=${genResult.retryAfter}`);
      return reply({
        error: "NUR is getting a lot of requests right now. Please try again in a moment.",
        rate_limited: true, retry_after: genResult.retryAfter,
      }, 429);
    }
    if ("error" in genResult) throw new Error(genResult.error);

    const modelUsed = genResult.modelUsed;
    const hadithResult = validateAndClean(genResult.reply, contextSet);
    const quranResult = validateAndLinkQuran(hadithResult.text, verses);
    const replyText = quranResult.text;
    const hadCitationIssues = hadithResult.hadInvalid || quranResult.hadInvalid;

    if (isSafeToLog) {
      try {
        await logResponse(supabase, {
          deviceId: device_id, normalizedQuestion, topicKeys, userQuery, reply: replyText,
          sourceRefs: { verses: verses.map((v) => v.ref), hadiths: [...contextSet] },
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

    return reply({ reply: replyText, remaining, unlocked: isUnlocked, model: modelUsed });
  } catch (err: any) {
    await refund();
    console.error("[nur-proxy] Fatal:", err?.message ?? err);
    await logMetric(supabase, deviceIdForLog, utcDate(0), "ai_provider_failure", { message: String(err?.message ?? err).slice(0, 300) });
    return reply({ error: "Something went wrong. Please try again." }, 500); // no internal details to the client
  }
});
