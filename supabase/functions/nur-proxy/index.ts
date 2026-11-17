import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MODEL_LIGHT   = Deno.env.get("NUR_MODEL_LIGHT")   ?? "openai/gpt-oss-20b";
const MODEL_COMPLEX = Deno.env.get("NUR_MODEL_COMPLEX") ?? "openai/gpt-oss-120b";
const MODEL_VERIFY  = Deno.env.get("NUR_MODEL_VERIFY")  ?? "openai/gpt-oss-20b"; // separate verification model

const CLASSIFICATION_CONFIDENCE_THRESHOLD = parseFloat(Deno.env.get("NUR_CLASSIFICATION_CONFIDENCE_THRESHOLD") ?? "0.75");
const EMBEDDING_MODEL = Deno.env.get("NUR_EMBEDDING_MODEL") ?? "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

const RAG_VERSION        = "v3";
const PROMPT_VERSION     = "v3";
const VALIDATION_VERSION = "v2";

// ──────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

interface QuranVerse {
  sourceId: string;        // stable: "quran:2:255"
  surah: number;
  ayah: number;
  surahName: string;
  arabicText: string;
  translationEn: string;
  lexicalScore: number;
  semanticScore: number;
  fusedScore: number;
}

interface HadithRecord {
  sourceId: string;        // stable: "hadith:bukhari:1"
  collection: string;      // bukhari, muslim, abudawud, tirmidhi, nasai, ibnmajah
  collectionLabel: string; // "Sahih Bukhari"
  number: number;
  arabicText: string | null;
  translationEn: string;
  grade: string | null;
  relevanceScore: number;
}

interface ScholarlyRuling {
  sourceId: string;        // stable: "scholar:hanafi:dog_ownership"
  school: "hanafi" | "maliki" | "shafi" | "hanbali" | "consensus" | "difference";
  topic: string;
  ruling: "permissible" | "prohibited" | "disliked" | "recommended" | "obligatory" | "varies";
  evidenceSourceIds: string[];
  scholarReferences: string[];
  notes: string;
  confidence: number;
}

interface EntityRecord {
  canonicalName: string;
  arabicName: string | null;
  category: string;
  era: string | null;
  description: string;
  relatedEntities: string[];
  verifiedReferences: unknown;
}

interface EvidenceBundle {
  quran: QuranVerse[];
  hadith: HadithRecord[];
  scholarly: ScholarlyRuling[];
  entities: EntityRecord[];
}

interface QueryAnalysis {
  intent: "fiqh_ruling" | "definition" | "history" | "arabic_term" | "personal" | "ambiguous";
  subQuestions: string[];
  keywords: string[];
  entities: string[];
  schoolContext: "hanafi" | "maliki" | "shafi" | "hanbali" | "comparative" | "none";
  isPersonal: boolean;
  isTimeSensitive: boolean;
  complexity: "light" | "complex";
  confidence: number;
}

interface Claim {
  id: string;
  text: string;
  type: "ruling" | "fact" | "attribution" | "definition";
  citedSourceIds: string[];
  schoolContext?: string;
}

interface VerificationResult {
  claimId: string;
  status: "supported" | "partially_supported" | "contradicted" | "irrelevant" | "insufficient_evidence";
  evidenceSourceIds: string[];
  explanation: string;
  confidence: number;
}

interface VerifiedAnswer {
  text: string;
  claims: Claim[];
  verifications: VerificationResult[];
  citations: Citation[];
  schoolAttribution: string;
  hasUnsupportedClaims: boolean;
  abstained: boolean;
  abstentionReason?: string;
}

interface Citation {
  sourceId: string;
  sourceType: "quran" | "hadith" | "scholarly";
  label: string;           // Display label: "Al-Baqarah 2:255", "Sahih Bukhari #1"
  school?: string;
  textSnippet: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// FAQ SYSTEM (unchanged)
// ──────────────────────────────────────────────────────────────────────────────

const FA_QS: FAQEntry[] = [
  {
    id: "faq_identity_who_are_you",
    category: "identity",
    question: "who are you",
    aliases: ["what is your name", "what are you", "tell me about yourself", "who is nur", "what is nur", "introduce yourself"],
    keywords: ["who", "are", "you", "name", "nur", "identity", "assistant", "bot"],
    answer: "I am NŪR, a warm and knowledgeable Islamic AI assistant grounded in the Holy Quran and authentic Sunnah. I am designed to help explore Islamic knowledge, study verses, read Hadith, and learn about Islamic teachings."
  },
  {
    id: "faq_identity_developer",
    category: "identity",
    question: "who made you",
    aliases: ["who created you", "who built you", "who developed you", "who owns nur", "what company made you", "who is behind nur"],
    keywords: ["who", "made", "created", "built", "developed", "owner", "company", "team"],
    answer: "NŪR was developed by a small independent team dedicated to making authentic Islamic knowledge accessible worldwide. NŪR is an independent app and is not affiliated with any commercial organisation or political entity."
  },
  {
    id: "faq_identity_purpose",
    category: "identity",
    question: "what is the purpose of nur",
    aliases: ["why was nur created", "what can nur do", "how can nur help me", "what is nur used for"],
    keywords: ["purpose", "goal", "mission", "help", "do", "features", "benefit"],
    answer: "NŪR aims to provide a clear, reliable, and accessible platform for learning about Islam. Key features include an AI assistant grounded in verified scripture, full Quran text with translations, six canonical Hadith collections, precise Salah prayer times, a Hijri calendar, and Qibla direction."
  },
  {
    id: "faq_app_sources",
    category: "app",
    question: "where do you get your information",
    aliases: ["what sources do you use", "are your hadith authentic", "how do you verify answers", "what quran translation do you use"],
    keywords: ["source", "sources", "quran", "hadith", "authentic", "verification", "translation", "database"],
    answer: "NŪR retrieves information directly from verified Islamic texts: the Holy Quran (Saheeh International and other authentic translations) and six primary Hadith collections (Sahih Bukhari, Sahih Muslim, Sunan Abu Dawud, Jami at-Tirmidhi, Sunan an-Nasai, and Sunan Ibn Majah)."
  },
  {
    id: "faq_app_fatwa_disclaimer",
    category: "app",
    question: "can you give me a fatwa",
    aliases: ["is this fatwa", "can you make a ruling for me", "can you issue a fatwa", "are you an alim or scholar"],
    keywords: ["fatwa", "ruling", "scholar", "alim", "mufti", "personal", "fiqh", "judge"],
    answer: "No, NŪR is an educational tool and does not issue religious rulings (fatwas). For personal legal matters, complex fiqh questions, or binding Islamic rulings, please consult a qualified human scholar (Alim or Mufti). Allahu A'lam."
  },
  {
    id: "faq_pricing_pro",
    category: "billing",
    question: "is nur free or paid",
    aliases: ["what is nur pro", "how much does pro cost", "what do i get with pro", "is nur completely free"],
    keywords: ["free", "pro", "cost", "price", "paid", "subscription", "limit"],
    answer: "NŪR is free to use with a daily limit of 15 AI reflection messages. NŪR Pro is available as a single one-time payment ($2.99 globally / ₹299 in India) for lifetime unlimited AI reflections and an ad-free experience. There are no recurring subscriptions."
  },
  {
    id: "faq_pricing_unlock_code",
    category: "billing",
    question: "how do i redeem my pro code",
    aliases: ["where do i enter my code", "i paid for pro where is my code", "how to unlock pro"],
    keywords: ["redeem", "code", "unlock", "enter", "licence", "payment", "activate"],
    answer: "After completing payment for NŪR Pro, your unlock code is emailed to you. Open the Get Pro page in the app, scroll to 'Already paid? Enter your code', enter your unlock code, and click 'Activate Pro Access'."
  },
  {
    id: "faq_privacy_data",
    category: "privacy",
    question: "do you save my messages or personal data",
    aliases: ["is my chat private", "do you track me", "what data is stored"],
    keywords: ["privacy", "data", "store", "save", "track", "private", "security", "pii"],
    answer: "Your privacy is respected. NŪR does not require account creation or personal login for basic use. Chat messages are processed securely via encrypted proxies, and no personal identifiable information (PII) is sold or shared."
  }
];

interface FAQEntry {
  id: string;
  category: string;
  question: string;
  aliases: string[];
  keywords: string[];
  answer: string;
}

function normalizeForFaq(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchFAQ(query: string): FAQEntry | null {
  const q = normalizeForFaq(query);
  const tokens = q.split(/[\s]+/);

  for (const faq of FA_QS) {
    const normalizedQ = normalizeForFaq(faq.question);
    const normalizedA = normalizeForFaq(faq.aliases.join(" "));
    if (q === normalizedQ || faq.aliases.some(a => normalizeForFaq(a) === q)) {
      return faq;
    }
    const kwTokens = faq.keywords.flatMap(k => normalizeForFaq(k).split(/[\s]+/));
    const overlap = tokens.filter(t => kwTokens.includes(t)).length;
    const ratio = tokens.length > 0 ? overlap / tokens.length : 0;
    if (ratio >= 0.7 && overlap >= 2) {
      return faq;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// QUERY UNDERSTANDING & ANALYSIS (Phase 1)
// ──────────────────────────────────────────────────────────────────────────────

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

const GENERIC_LOW_VALUE = new Set([
  "prophet", "prophets", "messenger", "messengers", "islam", "muslim", "muslims", "religion", "people",
  "deal", "dealing", "cope", "coping", "handle", "handling", "manage", "managing", "overcome", "overcoming",
]);

// Expanded synonym map for fiqh concepts
const EXPANSION_MAP: Record<string, string[]> = {
  "halal": ["permissible", "lawful", "halal", "clean", "pure", "fitrah", "jaiz"],
  "haram": ["forbidden", "haram", "makruh", "disliked", "prohibited", "haramun"],
  "dog": ["dogs", "canine", "puppy", "hunting dog", "guard dog", "guardian dog", "watchdog", "sheepdog", "guide dog", "service dog", "kalb", "kilaab"],
  "pet": ["pets", "animal companion", "domestic animal", "household animal", "companion animal"],
  "animal": ["animals", "creature", "living being", "beast", "hayawan"],
  "guardian": ["guard", "protect", "protection", "watch", "watchman", "guardian", "haaris", "haafiz"],
  "prayer": ["salah", "salat", "namaz", "salawat", "ibadah", "worship"],
  "fasting": ["sawm", "ramadan", "saum", "fast", "suhoor", "iftar"],
  "charity": ["sadaqah", "zakat", "donation", "giving", "contribution", "philanthropy"],
  "knowledge": ["ilm", "learning", "education", "study", "wisdom", "understanding"],
  "patience": ["sabr", "perseverance", "endurance", "calamity", "trial"],
  "dua": ["supplication", "du'a", "duaa", "prayer", "invocation", "asking"],
  "forgiveness": ["tawbah", "istighfar", "repentance", "pardoning", "forgiver"],
  "anger": ["ghadab", "temper", "rage", "irritation", "wrath"],
  "brotherhood": ["ummah", "community", "muslim unity", "social cohesion"],
  "truth": ["sidq", "honesty", "truthfulness", "siddiq"],
  "good": ["hayr", "virtue", "benefit", "righteous"],
  "evil": ["sharr", "misguidance", "harm", "sin"],
  "beautiful": ["hasan", "good", "excellent", "commendable"],
  "worship": ["ibadah", "salah", "dhikr", "acts of devotion"],
  "beauty": ["hassan", "goodness", "positive"],
  "sin": ["dhulm", "wrong", "transgression", "offense"],
  "ruling": ["fatwa", "hukm", "judgment", "legal opinion"],
  "permissible": ["halal", "jaiz", "valid", "allowed"],
  "forbidden": ["haram", "haramat", "makruh", "prohibited"],
  "marriage": ["nikah", "wedlock", "matrimony", "spouse", "husband", "wife"],
  "divorce": ["talaq", "khula", "separation", "dissolution"],
  "inheritance": ["mirath", "wirath", "succession", "heir", "legacy"],
  "interest": ["riba", "usury", "interest rate", "lending"],
  "loan": ["debt", "borrowing", "lending", "qard"],
  "trade": ["commerce", "business", "buying", "selling", "bay"],
  "al-baqarah": ["baqarah", "cow", "surah 2", "al-baqarah", "al-baqarah 2:255"],
  "2:255": ["ayat al-kursi", "kursi", "throne verse", "2:255", "2:255 surah"]
  "food": ["eating", "consumption", "diet", "nutrition", "makan"],
  "meat": ["flesh", "protein", "animal flesh", "lahm"],
  "slaughter": ["zabiha", "dhabiha", "qurbani", "ritual slaughter", "halal slaughter"],
  "travel": ["journey", "safar", "traveling", "trip"],
  "combine": ["join", "jam", "combining prayers", "qasr"],
  "wudu": ["ablution", "purification", "tahara"],
  "tayammum": ["dry ablution", "sand purification"],
};

function stripContextPreamble(query: string): string {
  return query.replace(/^\[[^\]]*\]\s*\n+/, "").trim();
}

function extractKeywords(query: string): string[] {
  const stop = new Set([
    "what","does","the","say","about","how","are","were","been","into","more","some","also","then","them","they","their",
    "in","on","to","and","or","for","with","of","that","this","should","can","will","have","has","had","tell","please",
    "explain","when","who","why","which","there","from","is","it","a","an","as","at","be","by","do","if","my","your",
    "i","you","we","he","she","me","him","her","us","them"
  ]);

  // Preserve hyphens, dots, and colons so "al-baqarah" and "2:255" survive intact
  const rawWords = query.toLowerCase().replace(/[^a-z0-9\s':-]/g, " ").split(/[\s]+/).filter(Boolean);
  const normalized = rawWords.map(w => NAME_ALIASES[w] ?? w);
  // Keep meaningful short words (dog, cat, pig, etc.) - only filter stopwords
  const filtered = normalized.filter(w => !stop.has(w));
  const seen = new Set<string>();
  const deduped = filtered.filter(w => (seen.has(w) ? false : (seen.add(w), true)));
  const prioritized = [...deduped].sort((a, b) => Number(GENERIC_LOW_VALUE.has(a)) - Number(GENERIC_LOW_VALUE.has(b)));
  return prioritized.slice(0, 12);
}

function expandQuery(query: string): string {
  const q = query.toLowerCase();
  const terms = new Set<string>();
  const words = q.replace(/[^a-z0-9\s':-]/g, "").split(/[\s]+/);

  for (let i = 0; i < words.length; i++) {
    // Check 2-word phrases first so "guardian dog" expands correctly
    if (i < words.length - 1) {
      const phrase = words[i] + " " + words[i + 1];
      if (EXPANSION_MAP[phrase]) {
        for (const ex of EXPANSION_MAP[phrase]) terms.add(ex);
      }
    }
    const word = words[i];
    if (EXPANSION_MAP[word]) {
      for (const ex of EXPANSION_MAP[word]) terms.add(ex);
    }
    if (word.length >= 2) terms.add(word);
  }
  const baseTokens = words.filter(t => t.length >= 2);
  return [...baseTokens, ...terms].join(" ");
}

// Intent classification and query decomposition
async function analyzeQuery(query: string, supabase: any): Promise<QueryAnalysis> {
  const qLower = query.toLowerCase();
  const keywords = extractKeywords(query);
  const entities = await detectEntities(supabase, query).then(e => e.map(x => x.canonicalName));

  // Detect intent
  let intent: QueryAnalysis["intent"] = "definition";
  const fiqhSignals = ["halal", "haram", "permissible", "forbidden", "ruling", "fatwa", "can i", "is it allowed", "is it haram", "is it halal", "wajib", "fard", "mandub", "makruh", "mustahabb"];
  const personalSignals = ["can i", "am i", "should i", "for me", "my "];
  const historySignals = ["who was", "who is", "story of", "history of", "biography", "life of"];
  const arabicSignals = ["meaning of", "define", "definition", "what does", "translate", "arabic"];

  if (fiqhSignals.some(s => qLower.includes(s)) || personalSignals.some(s => qLower.includes(s))) {
    intent = "fiqh_ruling";
  } else if (historySignals.some(s => qLower.includes(s))) {
    intent = "history";
  } else if (arabicSignals.some(s => qLower.includes(s))) {
    intent = "arabic_term";
  }

  // Check for school-specific queries
  let schoolContext: QueryAnalysis["schoolContext"] = "none";
  if (qLower.includes("hanafi") || qLower.includes("hanafiy")) schoolContext = "hanafi";
  else if (qLower.includes("maliki") || qLower.includes("malikiy")) schoolContext = "maliki";
  else if (qLower.includes("shafi") || qLower.includes("shafii") || qLower.includes("shaafi")) schoolContext = "shafi";
  else if (qLower.includes("hanbali") || qLower.includes("hanbaliy")) schoolContext = "hanbali";
  else if (qLower.includes("compare") || qLower.includes("difference") || qLower.includes("ikhtilaf") || qLower.includes("disagreement")) schoolContext = "comparative";

  // Personal/time-sensitive patterns
  const PERSONAL_PATTERNS = [
    /\bcan i\b/i, /\bam i\b/i, /\bshould i\b/i, /\bfor me\b/i,
    /\bmy (husband|wife|spouse|marriage|job|business|income|loan|debt|family|situation|case|father|mother|son|daughter|health|divorce)\b/i,
  ];
  const TIME_SENSITIVE_PATTERNS = [
    /\btoday\b/i, /\btonight\b/i, /\bthis (week|month|year)\b/i, /\bcurrently\b/i,
    /\bright now\b/i, /\bcurrent (ruling|fatwa|situation|fiqh)\b/i, /\b(this|last|next) ramadan\b/i,
  ];

  const isPersonal = PERSONAL_PATTERNS.some(re => re.test(query));
  const isTimeSensitive = TIME_SENSITIVE_PATTERNS.some(re => re.test(query));

  // Query decomposition for fiqh questions
  let subQuestions: string[] = [query];
  if (intent === "fiqh_ruling") {
    const baseKeywords = keywords.filter(k => k.length > 3).slice(0, 4);
    subQuestions = [
      query,
      ...baseKeywords.flatMap(k => [
        `What does the Quran say about ${k}?`,
        `What do authentic hadiths say about ${k}?`,
        `What is the ruling on ${k} in the four schools?`,
      ]),
    ].slice(0, 5);
  }

  // Complexity classification
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

  const q = query.toLowerCase();
  const complexHits = COMPLEX_SIGNALS.filter(s => q.includes(s));
  const personalHits = isPersonal;
  const lightHits = LIGHT_SIGNALS.filter(s => q.includes(s));

  let complexity: "light" | "complex";
  let confidence: number;
  let reason: string;

  if (complexHits.length > 0 || personalHits) {
    const score = complexHits.length + (personalHits ? 2 : 0);
    complexity = "complex";
    confidence = Math.min(0.99, 0.75 + 0.06 * score);
    reason = personalHits ? "personal-circumstance phrasing" : `matched: ${complexHits.slice(0,3).join(", ")}`;
  } else if (lightHits.length > 0) {
    complexity = "light";
    confidence = Math.min(0.97, 0.7 + 0.08 * lightHits.length);
    reason = `matched: ${lightHits.slice(0,3).join(", ")}`;
  } else {
    complexity = "complex";
    confidence = 0.3;
    reason = "no strong signal — defaulting to complex per uncertainty rule";
  }

  return {
    intent,
    subQuestions,
    keywords,
    entities,
    schoolContext,
    isPersonal,
    isTimeSensitive,
    complexity,
    confidence,
    reason,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// EMBEDDING GENERATION (for semantic search)
// ──────────────────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  // Use Groq's embedding endpoint or a dedicated embedding service
  // For now, we'll use a placeholder - in production, call your embedding API
  try {
    const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // truncate if needed
      }),
    });
    if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
    const data = await res.json();
    return data.data[0].embedding;
  } catch (e) {
    console.error("[Embedding] Failed to generate embedding:", e);
    // Return zero vector as fallback
    return new Array(EMBEDDING_DIM).fill(0);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// QURAN RETRIEVAL: HYBRID FTS + VECTOR (Phase 1)
// ──────────────────────────────────────────────────────────────────────────────

async function searchQuranHybrid(supabase: any, query: string, queryEmbedding: number[]): Promise<QuranVerse[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  // Use top 3 keywords for lexical search, full query for semantic
  const lexicalQuery = keywords.slice(0, 3).join(" ");

  try {
    const embeddingVector = `[${queryEmbedding.join(",")}]`;
    const { data, error } = await supabase.rpc("search_quran_ayahs_hybrid", {
      p_search_query: lexicalQuery,
      p_match_limit: 10,
      p_lexical_weight: 0.4,
      p_semantic_weight: 0.6,
      p_query_embedding: embeddingVector,
    });

    if (error || !data) {
      console.error("[Quran Hybrid] RPC error:", error);
      return [];
    }

    return (data as any[]).map(row => ({
      sourceId: `quran:${row.surah_number}:${row.ayah_number}`,
      surah: row.surah_number,
      ayah: row.ayah_number,
      surahName: row.surah_name_english,
      arabicText: row.arabic_text || "",
      translationEn: row.translation_en || "",
      lexicalScore: row.lexical_rank || 0,
      semanticScore: row.semantic_rank || 0,
      fusedScore: row.fused_score || 0,
    })).slice(0, 8); // Return top 8 after RRF
  } catch (e) {
    console.error("[Quran Hybrid] Exception:", e);
    return [];
  }
}

// Fallback to original FTS-only search
async function searchQuranFts(supabase: any, query: string): Promise<QuranVerse[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];
  const seen = new Set<string>();
  const verses: QuranVerse[] = [];

  await Promise.all(keywords.slice(0, 3).map(async kw => {
    try {
      const { data, error } = await supabase.rpc("search_quran_ayahs", { search_query: kw, match_limit: 4 });
      if (error || !data) return;
      for (const row of data as any[]) {
        const key = `${row.surah_number}:${row.ayah_number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        verses.push({
          sourceId: `quran:${row.surah_number}:${row.ayah_number}`,
          surah: row.surah_number,
          ayah: row.ayah_number,
          surahName: row.surah_name_english,
          arabicText: row.arabic_text || "",
          translationEn: row.translation_en || "",
          lexicalScore: 1.0,
          semanticScore: 0,
          fusedScore: 1.0,
        });
      }
    } catch {}
  }));

  return verses.slice(0, 8);
}

// ──────────────────────────────────────────────────────────────────────────────
// HADITH RETRIEVAL: SEMANTIC + TOPIC MAP (Phase 1)
// ──────────────────────────────────────────────────────────────────────────────

const COLL_LABELS: Record<string, string> = {
  bukhari:  "Sahih Bukhari",
  muslim:   "Sahih Muslim",
  abudawud: "Abu Dawud",
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
  // NEW: Animal/pet topics
  { key:"animals", kw: ["dog","dogs","pet","pets","animal","animals","guardian dog","guard dog","hunting dog","guide dog","service dog","kalb","kilaab"], refs: [
    { c:"muslim",n:2244 }, { c:"bukhari",n:3316 }, { c:"muslim",n:1572 }, { c:"bukhari",n:5483 },
    { c:"abudawud",n:2839 }, { c:"tirmidhi",n:1468 }, { c:"nasai",n:4235 }, { c:"ibnmajah",n:3639 }
  ]},
];

function matchTopics(qLower: string) {
  return TOPIC_MAP.filter(topic => topic.kw.some(kw => qLower.includes(kw)));
}

async function fetchOneHadith(collId: string, number: number): Promise<HadithRecord|null> {
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${collId}/${number}.json`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const raw = await res.json();
    const text: string|undefined = raw?.text ?? raw?.hadiths?.[0]?.text ?? (Array.isArray(raw) ? raw[0]?.text : undefined);
    if (!text || typeof text !== "string") return null;
    const grade = raw?.grades?.[0]?.grade ?? raw?.hadiths?.[0]?.grades?.[0]?.grade ?? null;
    return {
      sourceId: `hadith:${collId}:${number}`,
      collection: collId,
      collectionLabel: COLL_LABELS[collId] ?? collId,
      number,
      arabicText: raw?.arabic ?? null,
      translationEn: text.replace(/\s+/g, " ").trim().slice(0, 1200),
      grade,
      relevanceScore: 1.0,
    };
  } catch { return null; }
}

async function retrieveHadiths(query: string, queryEmbedding: number[]): Promise<{ records: HadithRecord[]; contextSet: Set<string> }> {
  const qLower = query.toLowerCase();
  const refs = new Map<string, { c: string; n: number }>();

  // 1. Topic map matches (high precision)
  for (const topic of matchTopics(qLower)) {
    for (const ref of topic.refs) {
      const key = `${ref.c}-${ref.n}`;
      if (!refs.has(key)) refs.set(key, ref);
    }
  }

  // 2. Keyword-based fallback for broader coverage
  const keywords = extractKeywords(query);
  if (refs.size < 8 && keywords.length > 0) {
    // Search hadith collections by keyword via API
    // For now, we'll add common fiqh hadiths for uncovered topics
    const commonHadiths: { c: string; n: number }[] = [
      { c: "bukhari", n: 1 },       // Intention
      { c: "bukhari", n: 8 },       // Pillars
      { c: "muslim", n: 223 },      // Prayer
      { c: "bukhari", n: 5483 },    // Dogs
      { c: "muslim", n: 2244 },     // Dogs
    ];
    for (const h of commonHadiths) {
      const key = `${h.c}-${h.n}`;
      if (!refs.has(key) && refs.size < 12) refs.set(key, h);
    }
  }

  const toFetch = [...refs.values()].slice(0, 12);
  const fetched = await Promise.all(toFetch.map(r => fetchOneHadith(r.c, r.n)));
  const records = fetched.filter((h): h is HadithRecord => h !== null);
  const contextSet = new Set(records.map(h => `${h.collection}-${h.number}`));
  return { records, contextSet };
}

// ──────────────────────────────────────────────────────────────────────────────
// SCHOLARLY RULINGS RETRIEVAL (Phase 4 - Four Schools)
// ──────────────────────────────────────────────────────────────────────────────

async function retrieveScholarlyRulings(supabase: any, analysis: QueryAnalysis): Promise<ScholarlyRuling[]> {
  if (analysis.intent !== "fiqh_ruling") return [];

  try {
    // Determine which schools to fetch based on user preference and query
    let schools = ["hanafi", "maliki", "shafi", "hanbali", "consensus", "difference"];
    if (analysis.schoolContext !== "none" && analysis.schoolContext !== "comparative") {
      schools = [analysis.schoolContext, "consensus", "difference"];
    }

    const topics = analysis.keywords.filter(k => k.length > 3).slice(0, 3);
    const topicConditions = topics.map(t => `topic ILIKE '%${t}%'`).join(" OR ");

    const { data, error } = await supabase
      .from("fiqh_rulings")
      .select("*")
      .filter("school", "in", `(${schools.join(",")})`)
      .or(topicConditions)
      .limit(10);

    if (error || !data) return [];

    return (data as any[]).map(row => ({
      sourceId: `scholar:${row.school}:${row.topic}`,
      school: row.school,
      topic: row.topic,
      ruling: row.ruling,
      evidenceSourceIds: row.evidence_source_ids || [],
      scholarReferences: row.scholar_references || [],
      notes: row.notes || "",
      confidence: row.confidence || 0.8,
    }));
  } catch (e) {
    console.error("[Scholarly] Retrieval error:", e);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ENTITY DETECTION (unchanged but with types)
// ──────────────────────────────────────────────────────────────────────────────

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

    const byName = new Map<string, EntityRecord>();
    const termToCanonical = new Map<string, string>();
    for (const e of entities as EntityRecord[]) {
      byName.set(e.canonicalName.toLowerCase(), e);
      termToCanonical.set(e.canonicalName.toLowerCase(), e.canonicalName);
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
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// EVIDENCE BUNDLE ASSEMBLY
// ──────────────────────────────────────────────────────────────────────────────

async function assembleEvidence(
  supabase: any,
  query: string,
  analysis: QueryAnalysis,
  userSchoolPref: string | null
): Promise<EvidenceBundle> {
  // Generate embedding for semantic search
  const queryEmbedding = await generateEmbedding(query);

  // Parallel retrieval
  const [quran, { records: hadiths }, entities, scholarly] = await Promise.all([
    searchQuranHybrid(supabase, query, queryEmbedding).catch(() => searchQuranFts(supabase, query)),
    retrieveHadiths(query, queryEmbedding),
    detectEntities(supabase, query),
    retrieveScholarlyRulings(supabase, analysis),
  ]);

  return { quran, hadith: hadiths, scholarly, entities };
}

// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT CONSTRUCTION (Structured Evidence + Citation Rules)
// ──────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(evidence: EvidenceBundle, analysis: QueryAnalysis, userSchoolPref: string | null): string {
  const hasPrimarySources = evidence.quran.length > 0 || evidence.hadith.length > 0;
  const hasScholarly = evidence.scholarly.length > 0;

  let srcBlock = "";
  let citationIndex = 0;
  const citationMap = new Map<string, number>();

  // Helper to assign citation numbers
  const getCiteNum = (sourceId: string) => {
    if (!citationMap.has(sourceId)) {
      citationMap.set(sourceId, ++citationIndex);
    }
    return citationMap.get(sourceId)!;
  };

  // Quran sources
  if (evidence.quran.length > 0) {
    srcBlock += "\n--- PRIMARY SOURCE: QURAN VERSES ---\n";
    for (const v of evidence.quran) {
      const num = getCiteNum(v.sourceId);
      srcBlock += `[${num}] Quran ${v.surah}:${v.ayah} (${v.surahName})\n`;
      srcBlock += `Arabic: ${v.arabicText}\n`;
      srcBlock += `Translation: "${v.translationEn}"\n`;
      srcBlock += `SourceID: ${v.sourceId}\n\n`;
    }
  }

  // Hadith sources
  if (evidence.hadith.length > 0) {
    srcBlock += "\n--- PRIMARY SOURCE: HADITH ---\n";
    for (const h of evidence.hadith) {
      const num = getCiteNum(h.sourceId);
      srcBlock += `[${num}] ${h.collectionLabel} #${h.number}\n`;
      if (h.arabicText) srcBlock += `Arabic: ${h.arabicText}\n`;
      srcBlock += `Translation: "${h.translationEn}"\n`;
      if (h.grade) srcBlock += `Grade: ${h.grade}\n`;
      srcBlock += `SourceID: ${h.sourceId}\n\n`;
    }
  }

  // Scholarly rulings
  if (evidence.scholarly.length > 0) {
    srcBlock += "\n--- SCHOLARLY RULINGS (Four Schools) ---\n";
    for (const s of evidence.scholarly) {
      const num = getCiteNum(s.sourceId);
      const schoolLabel = s.school === "consensus" ? "Consensus (Ijma)"
        : s.school === "difference" ? "Scholarly Difference (Ikhtilaf)"
        : s.school.charAt(0).toUpperCase() + s.school.slice(1);
      srcBlock += `[${num}] ${schoolLabel} ruling on "${s.topic}": ${s.ruling}\n`;
      if (s.scholarReferences.length > 0) srcBlock += `Scholars: ${s.scholarReferences.join(", ")}\n`;
      if (s.notes) srcBlock += `Notes: ${s.notes}\n`;
      srcBlock += `SourceID: ${s.sourceId}\n\n`;
    }
  }

  // Entity background
  let entityBlock = "";
  if (evidence.entities.length > 0) {
    entityBlock = "\n--- BACKGROUND ENTITIES (for context only, do not cite) ---\n";
    for (const e of evidence.entities) {
      const arabic = e.arabicName ? ` (${e.arabicName})` : "";
      const era = e.era ? `, ${e.era} era` : "";
      entityBlock += `- ${e.canonicalName}${arabic} — ${e.category}${era}: ${e.description}\n`;
    }
    entityBlock += "\n";
  }

  // School preference context
  let schoolContextBlock = "";
  if (userSchoolPref && userSchoolPref !== "none" && userSchoolPref !== "comparative") {
    schoolContextBlock = `\nUSER PREFERENCE: The user follows the ${userSchoolPref.charAt(0).toUpperCase() + userSchoolPref.slice(1)} school. Prioritize ${userSchoolPref} rulings when presenting scholarly opinions, but still mention other schools if there is meaningful disagreement.\n`;
  } else if (userSchoolPref === "comparative") {
    schoolContextBlock = `\nUSER PREFERENCE: The user wants a comparative view. Present all four schools (Hanafi, Maliki, Shafi'i, Hanbali) clearly when there are differences. Note consensus where it exists.\n`;
  }

  const citationRules = hasPrimarySources
    ? `PRIMARY SOURCES RETRIEVED FOR THIS QUERY:
${srcBlock}
CITATION RULES — MANDATORY:

1. CITE USING BRACKETED NUMBERS [1], [2], etc. corresponding to the SourceID list above.
2. ONLY cite sources listed above. NEVER cite from memory or training data.
3. BEFORE CITING: Re-read the source text and verify it LITERALLY supports your claim.
4. DO NOT STRETCH: A general verse about animals does not support a specific ruling on guard dogs.
5. FORMAT: Quran → [Surah Name Chapter:Verse] e.g. [Al-Baqarah 2:255]; Hadith → [Collection #Number] e.g. [Sahih Bukhari #1]; Scholarly → [School: Topic] e.g. [Hanafi: Dog Ownership].
6. If no retrieved source directly supports a point, write: "Based on the retrieved sources, ..." or "The available evidence does not specify..." — NEVER write "Islamic scholarship generally holds that..." as a substitute for evidence.
7. BETTER TO OMIT A CITATION than to misuse one.
8. NEVER attribute a specific saying to the Prophet ﷺ unless that EXACT hadith is in the retrieved list above with its number.
9. DISTINGUISH: Primary sources (Quran/Hadith) vs. Scholarly interpretation. Label scholarly views with their school.
10. If schools disagree, state the disagreement explicitly: "The Hanafi school holds X, while the Shafi'i school holds Y."
`
    : `NO PRIMARY SOURCES RETRIEVED.

You may use general Islamic knowledge (tafsir, sirah, established history) but:
- NO specific verse/hadith citations (no [Al-Baqarah 2:255], no [Bukhari #1])
- NO "the Prophet ﷺ said..." attributions
- Say "According to Islamic tradition..." or "Classical scholars mention..." instead
- If a specific source would normally support a claim, state that no verified source was retrieved
`;

  return `You are NŪR, a precise Islamic knowledge assistant grounded in the Quran, authentic Sunnah, and recognized scholarship.

${schoolContextBlock}

NAME ACCURACY: Islamic figures have similar transliterated names (Isa ≠ Isaiah, Yahya ≠ other Yahyas). Answer strictly about the exact name the user gave. If uncertain, say so.

COMMON PHRASE ACCURACY: Use EXACT transliterations:
- بِسْمِ اللَّهِ → "Bismillah"
- الحمد لله → "Alhamdulillah"
- سبحان الله → "SubhanAllah"
- الله أكبر → "Allahu Akbar"
- لا إله إلا الله → "La ilaha illallah"
- لا حول ولا قوة إلا بالله → "La hawla wa la quwwata illa billah"
- أستغفر الله → "Astaghfirullah"
- إن شاء الله → "InshaAllah"
- ما شاء الله → "MashaAllah"
- جزاك الله خيرا → "JazakAllahu khayran"
If a phrase isn't listed, use Arabic script or English paraphrase — don't invent transliterations.

${citationRules}
${entityBlock}

RESPONSE STYLE:
- Flowing paragraphs, not bullets.
- Warm, encouraging, spiritually uplifting.
- Distinguish consensus (ijma) from disagreement (ikhtilaf).
- For personal rulings, advise consulting a qualified scholar.
- Match user's language.
- 2-3 focused paragraphs.
- End with: Allahu A'lam.`;
}

// ──────────────────────────────────────────────────────────────────────────────
// MODEL GENERATION
// ──────────────────────────────────────────────────────────────────────────────

async function callGroqOnce(model: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<
  { ok: true; reply: string } | { ok: false; rateLimited: true; retryAfter: number } | { ok: false; rateLimited: false; error: string }
> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model, max_tokens: 1500, temperature: 0.1,
      messages: [{ role: "system", content: systemPrompt }, ...messages.map(m => ({ role: m.role, content: m.content }))],
    }),
  });
  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    return { ok: false, rateLimited: true, retryAfter: retryAfterHeader ? parseInt(retryAfterHeader, 10) : 20 };
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
  return { error: (result as any).error };
}

// ──────────────────────────────────────────────────────────────────────────────
// CLAIM EXTRACTION & VERIFICATION (Phase 3)
// ──────────────────────────────────────────────────────────────────────────────

function extractClaims(response: string, evidence: EvidenceBundle): Claim[] {
  const claims: Claim[] = [];
  const allSourceIds = new Set([
    ...evidence.quran.map(v => v.sourceId),
    ...evidence.hadith.map(h => h.sourceId),
    ...evidence.scholarly.map(s => s.sourceId),
  ]);

  // Extract bracketed citations [1], [2], etc.
  const citePattern = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  const citationToSourceId = new Map<number, string>();

  // Build reverse mapping from citation number to sourceId
  let citeIdx = 0;
  for (const v of evidence.quran) { citeIdx++; citationToSourceId.set(citeIdx, v.sourceId); }
  for (const h of evidence.hadith) { citeIdx++; citationToSourceId.set(citeIdx, h.sourceId); }
  for (const s of evidence.scholarly) { citeIdx++; citationToSourceId.set(citeIdx, s.sourceId); }

  // Split response into sentences and find claims with citations
  const sentences = response.split(/(?<=[.!?])\s+/);
  let claimId = 0;

  for (const sentence of sentences) {
    const cites: string[] = [];
    let m: RegExpExecArray | null;
    const localPattern = /\[(\d+)\]/g;
    while ((m = localPattern.exec(sentence)) !== null) {
      const num = parseInt(m[1], 10);
      const sourceId = citationToSourceId.get(num);
      if (sourceId) cites.push(sourceId);
    }

    // Determine claim type
    let type: Claim["type"] = "fact";
    const lower = sentence.toLowerCase();
    if (/\b(halal|haram|permissible|forbidden|wajib|fard|mandub|makruh|ruling|allowed|prohibited)\b/i.test(lower)) type = "ruling";
    else if (/\b(the prophet|prophet muhammad|rasulullah)\b/i.test(lower)) type = "attribution";
    else if (/\b(means|meaning|define|definition)\b/i.test(lower)) type = "definition";

    if (cites.length > 0 || type === "ruling" || type === "attribution") {
      claims.push({
        id: `claim_${++claimId}`,
        text: sentence.trim(),
        type,
        citedSourceIds: cites,
      });
    }
  }

  return claims;
}

async function verifyClaims(
  claims: Claim[],
  evidence: EvidenceBundle,
  messages: { role: string; content: string }[]
): Promise<VerificationResult[]> {
  if (claims.length === 0) return [];

  // Build evidence text for verification
  const evidenceText = [
    ...evidence.quran.map(v => `SOURCE ${v.sourceId}: Quran ${v.surah}:${v.ayah} — "${v.translationEn}"`),
    ...evidence.hadith.map(h => `SOURCE ${h.sourceId}: ${h.collectionLabel} #${h.number} — "${h.translationEn}"`),
    ...evidence.scholarly.map(s => `SOURCE ${s.sourceId}: ${s.school} ruling on ${s.topic} — ${s.ruling}`),
  ].join("\n\n");

  // Use verification model to check each claim
  const verificationPrompt = `You are a verification engine. For each claim below, determine if the EVIDENCE supports it.

EVIDENCE:
${evidenceText}

CLAIMS TO VERIFY:
${claims.map((c, i) => `${i+1}. "${c.text}" (cites: ${c.citedSourceIds.join(", ") || "none"})`).join("\n")}

Respond with JSON array of objects:
{
  "claimIndex": 1,
  "status": "supported" | "partially_supported" | "contradicted" | "irrelevant" | "insufficient_evidence",
  "evidenceSourceIds": ["quran:2:255", ...],
  "explanation": "Brief explanation",
  "confidence": 0.9
}`;

  try {
    const result = await callGroqOnce(MODEL_VERIFY, verificationPrompt, [
      { role: "user", content: "Verify the claims." }
    ]);

    if (!result.ok) throw new Error(result.error);

    const parsed = JSON.parse(result.reply);
    return parsed.map((v: any, i: number) => ({
      claimId: claims[i].id,
      status: v.status,
      evidenceSourceIds: v.evidenceSourceIds || [],
      explanation: v.explanation,
      confidence: v.confidence || 0.5,
    }));
  } catch (e) {
    console.error("[Verify] Verification failed:", e);
    // Fallback: deterministic check - does cited source exist in evidence?
    return claims.map(c => ({
      claimId: c.id,
      status: c.citedSourceIds.every(id => {
        return evidence.quran.some(v => v.sourceId === id) ||
               evidence.hadith.some(h => h.sourceId === id) ||
               evidence.scholarly.some(s => s.sourceId === id);
      }) ? "supported" : "insufficient_evidence",
      evidenceSourceIds: c.citedSourceIds,
      explanation: "Automated fallback verification",
      confidence: 0.5,
    }));
  }
}

function buildVerifiedAnswer(
  draftResponse: string,
  claims: Claim[],
  verifications: VerificationResult[],
  evidence: EvidenceBundle,
  userSchoolPref: string | null
): VerifiedAnswer {
  const unsupportedClaims = verifications.filter(v =>
    v.status === "contradicted" || v.status === "irrelevant" || v.status === "insufficient_evidence"
  );

  const hasCriticalUnsupported = unsupportedClaims.some(v =>
    v.status === "contradicted" || (v.status === "insufficient_evidence" && claims.find(c => c.id === v.claimId)?.type === "ruling")
  );

  // Build citation objects for frontend
  const citationMap = new Map<string, Citation>();
  let citeNum = 0;
  for (const v of evidence.quran) { citeNum++; citationMap.set(v.sourceId, { sourceId: v.sourceId, sourceType: "quran", label: `${v.surahName} ${v.surah}:${v.ayah}`, textSnippet: v.translationEn.slice(0, 200) }); }
  for (const h of evidence.hadith) { citeNum++; citationMap.set(h.sourceId, { sourceId: h.sourceId, sourceType: "hadith", label: `${h.collectionLabel} #${h.number}`, textSnippet: h.translationEn.slice(0, 200) }); }
  for (const s of evidence.scholarly) { citeNum++; citationMap.set(s.sourceId, { sourceId: s.sourceId, sourceType: "scholarly", label: `${s.school}: ${s.topic}`, school: s.school, textSnippet: `${s.ruling} — ${s.notes}`.slice(0, 200) }); }

  // If critical unsupported claims exist, we should abstain or regenerate
  let finalText = draftResponse;
  let abstained = false;
  let abstentionReason: string | undefined;

  if (hasCriticalUnsupported) {
    // Remove unsupported claims from response (simple approach: flag for frontend)
    const unsupportedText = unsupportedClaims.map(v => {
      const claim = claims.find(c => c.id === v.claimId);
      return claim?.text || "";
    }).join(" ");

    finalText = draftResponse.replace(unsupportedText, "").replace(/\s+/g, " ").trim();
    if (finalText.length < 50) {
      abstained = true;
      abstentionReason = "Insufficient reliable evidence to provide a confident answer. Please consult a qualified scholar for this ruling.";
      finalText = `I cannot provide a reliable answer based on the available verified sources. ${abstentionReason} Allahu A'lam.`;
    }
  }

  // School attribution summary
  const schoolsCited = [...new Set(evidence.scholarly.map(s => s.school).filter(s => s !== "consensus" && s !== "difference"))];
  const schoolAttribution = schoolsCited.length > 0
    ? `Scholarly views: ${schoolsCited.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}`
    : "Based on primary sources (Quran/Hadith)";

  return {
    text: finalText,
    claims,
    verifications,
    citations: Array.from(citationMap.values()),
    schoolAttribution,
    hasUnsupportedClaims: unsupportedClaims.length > 0,
    abstained,
    abstentionReason,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// CITATION VALIDATION (Enhanced)
// ──────────────────────────────────────────────────────────────────────────────

const HADITH_CITE_RE = /\[((?:Sahih\s+)?(?:Bukhari|Muslim|Abu\s+Dawud|Tirmidhi|Jami[^\]]{0,20}?|An-Nasai|Nasai|Ibn\s+Majah))\s*[,#]?\s*(?:Hadith\s+)?#?(\d{1,5})\]/gi;
const LABEL_TO_ID: Record<string,string> = { bukhari:"bukhari","sahih bukhari":"bukhari",muslim:"muslim","sahih muslim":"muslim","abu dawud":"abudawud",tirmidhi:"tirmidhi",jami:"tirmidhi","an-nasai":"nasai",nasai:"nasai","ibn majah":"ibnmajah",ibnmajah:"ibnmajah" };

function resolveCollId(raw: string): string|null {
  const lower = raw.toLowerCase().trim();
  for (const [key, id] of Object.entries(LABEL_TO_ID)) { if (lower.includes(key)) return id; }
  return null;
}

function validateHadithCitations(response: string, contextSet: Set<string>): { text: string; hadInvalid: boolean } {
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

const QURAN_CITE_RE = /\[([A-Za-z][A-Za-z'’.\- ]{1,30}?)\s+(\d{1,3}):(\d{1,3})\]/g;

function validateQuranCitations(response: string, verses: QuranVerse[]): { text: string; hadInvalid: boolean } {
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

// ──────────────────────────────────────────────────────────────────────────────
// LOGGING & METRICS (Enhanced)
// ──────────────────────────────────────────────────────────────────────────────

async function logResponse(supabase: any, opts: {
  deviceId: string; normalizedQuestion: string; topicKeys: string[]; userQuery: string; reply: string;
  sourceRefs: unknown; model: string; generationType: string; hadCitationIssues: boolean;
  verificationResults?: VerificationResult[]; abstained?: boolean; schoolContext?: string;
}) {
  const { deviceId, normalizedQuestion, topicKeys, userQuery, reply, sourceRefs, model, generationType, hadCitationIssues, verificationResults, abstained, schoolContext } = opts;
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
    verification_results: verificationResults || null,
    abstained: abstained || false,
    school_context: schoolContext || null,
    rag_version: RAG_VERSION, prompt_version: PROMPT_VERSION, validation_version: VALIDATION_VERSION,
  });
  if (error) throw error;
}

async function logMetric(supabase: any, deviceId: string, localDate: string, event: string, properties: Record<string, unknown>) {
  try {
    await supabase.from("events").insert({ device_id: deviceId, event, properties, local_date: localDate });
  } catch (err: any) {
    console.error("[nur-proxy] metric log failed:", err?.message ?? err);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Rate limiting, auth, quota functions (unchanged from v63)
const FREE_DAILY_LIMIT = 15;
const UTC_DAY_SAFETY_CAP = 30;
const PRO_DAILY_CAP = 200;
const MAX_DEVICES_PER_LICENCE = 3;
const GLOBAL_DAILY_CAP = parseInt(Deno.env.get("NUR_GLOBAL_DAILY_CAP") ?? "5000", 10);
const REQUIRE_DEVICE_KEY = Deno.env.get("NUR_REQUIRE_DEVICE_KEY") === "1";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY = 12;
const MAX_MSG_CHARS = 4000;

const ALLOWED_ORIGINS = new Set([
  "https://nurislamicai.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsFor(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(o) ? o : "https://nurislamicai.app",
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
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    out.push({ role, content: content.slice(0, MAX_MSG_CHARS) });
  }
  const recent = out.slice(-MAX_HISTORY);
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (recent.length === 0 || recent[recent.length - 1].role !== "user" || !recent[recent.length - 1].content.trim()) return null;
  return recent;
}

function base64urlToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - b64.length % 4) % 4);
  const str = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(str);
  return new Uint8Array(Array.from(bin).map((c) => c.charCodeAt(0)));
}

function base64urlDecode(b64: string): string {
  return new TextDecoder().decode(base64urlToBytes(b64));
}

async function verifyJwt(token: string): Promise<{ sub: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(base64urlDecode(headerB64));
    const payload = JSON.parse(base64urlDecode(payloadB64));
    if (header.alg !== "RS256") return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
    if (typeof payload.iat === "number" && payload.iat > Date.now() / 1000 + 300) return null;
    const jwksRes = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
    if (!jwksRes.ok) return null;
    const jwks = await jwksRes.json();
    const key = (jwks.keys ?? []).find((k: any) => k.kid === header.kid);
    if (!key) return null;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const sigBytes = base64urlToBytes(sigB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = sigBytes.buffer as ArrayBuffer;
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, data);
    return valid ? { sub: payload.sub } : null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const C = corsFor(req);
  const JH = { ...C, "Content-Type": "application/json" };
  const reply = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: JH });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: C });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

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

    const { device_id, local_date, messages, unlock_code, fiqh_preference } = body;
    if (typeof device_id !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(device_id)) {
      return reply({ error: "Missing device_id" }, 400);
    }
    deviceIdForLog = device_id;

    // ── Network + device identity ───────────────────────────────────────
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const ipH = await hmacShort(ip);

    // Hybrid auth
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let authenticatedAs: { sub: string } | null = null;
    if (jwt) {
      authenticatedAs = await verifyJwt(jwt);
      if (!authenticatedAs) return reply({ error: "Authentication failed" }, 401);
    }

    if (authenticatedAs) {
      deviceIdForLog = authenticatedAs.sub;
    } else {
      const deviceKey = req.headers.get("x-device-key") ?? "";
      if (deviceKey) {
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(deviceKey)) return reply({ error: "Device verification failed" }, 403);
        const { data: bind } = await supabase.rpc("bind_device_key", { p_device: device_id, p_key_hash: await sha256Hex(deviceKey) });
        if (bind === "mismatch") return reply({ error: "Device verification failed" }, 403);
      } else if (REQUIRE_DEVICE_KEY) {
        return reply({ error: "Please refresh the app to continue." }, 403);
      }
    }

    const limited = async (key: string, windowS: number, max: number) => {
      const { data, error } = await supabase.rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowS, p_max: max });
      return !error && data === false;
    };

    // ── Licence redemption ─────────────────────────────────────────
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

    // ── Chat path ─────────────────────────────────────
    const msgs = sanitizeMessages(messages);
    if (!msgs) return reply({ error: "Missing messages" }, 400);

    // Rate limits
    if (await limited(`chat:ip:${ipH}`, 60, 20) || await limited(`chat:dev:${device_id}`, 60, 6)) {
      return reply({ error: "You're sending messages too quickly. Please wait a moment.", rate_limited: true, retry_after: 30 }, 429);
    }

    // Pro status
    const quotaIdentity = authenticatedAs ? authenticatedAs.sub : device_id;
    let isUnlocked = false;
    if (!authenticatedAs) {
      const { data: licenseRow } = await supabase.from("licenses").select("id")
        .contains("used_by", [device_id]).is("revoked_at", null).limit(1).maybeSingle();
      isUnlocked = !!licenseRow;
    } else {
      isUnlocked = true;
    }

    const usageDate = resolveUsageDate(local_date);
    let remaining = 999;

    if (!isUnlocked) {
      if (await limited(`chat:ipday:${ipH}`, 86400, 150)) {
        return reply({ error: "Daily limit reached", remaining: 0 }, 429);
      }
      const { data: q, error: qErr } = await supabase.rpc("consume_quota", { p_device: quotaIdentity, p_date: usageDate, p_limit: FREE_DAILY_LIMIT });
      if (qErr) throw qErr;
      const row = Array.isArray(q) ? q[0] : q;
      if (!row?.allowed) return reply({ error: "Daily limit reached", remaining: 0 }, 429);
      reserved.free = [quotaIdentity, usageDate];
      remaining = Math.max(0, FREE_DAILY_LIMIT - (row.used ?? FREE_DAILY_LIMIT));

      const { data: u } = await supabase.rpc("consume_quota", { p_device: quotaIdentity, p_date: `u:${utcDate(0)}`, p_limit: UTC_DAY_SAFETY_CAP });
      const urow = Array.isArray(u) ? u[0] : u;
      if (!urow?.allowed) { await refund(); return reply({ error: "Daily limit reached", remaining: 0 }, 429); }
      reserved.utc = [quotaIdentity, `u:${utcDate(0)}`];
    } else {
      const { data: p } = await supabase.rpc("consume_quotas", { p_device: quotaIdentity, p_date: `p:${utcDate(0)}`, p_limit: PRO_DAILY_CAP });
      const prow = Array.isArray(p) ? p[0] : p;
      if (!prow?.allowed) return reply({ error: "Daily limit reached", remaining: 0 }, 429);
      reserved.pro = [quotaIdentity, `p:${utcDate(0)}`];
    }

    if (await limited("global:day", 86400, GLOBAL_DAILY_CAP)) {
      await refund();
      return reply({ error: "NUR is very busy right now. Please try again later." }, 503);
    }

    // ── RAG + GENERATION PIPELINE ──────────────────────────────────
    const userQuery = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    const normalizedQuestion = normalizeQuestion(userQuery);

    // Get user's fiqh preference
    let userSchoolPref: string | null = fiqh_preference || null;
    if (!userSchoolPref) {
      try {
        const { data: pref } = await supabase.rpc("get_user_fiqh_preference", { p_device_id: device_id });
        userSchoolPref = pref?.[0]?.preferred_school || null;
      } catch {}
    }

    // FAQ check
    const matchedFAQ = matchFAQ(userQuery);
    let faqId = null;
    if (matchedFAQ) {
      faqId = matchedFAQ.id;
      console.log(`[FAQ] matched: ${faqId}`);
      const isSafeToLog = true; // FAQs are always safe
      if (isSafeToLog) {
        try {
          await logResponse(supabase, {
            deviceId: device_id, normalizedQuestion, topicKeys: [], userQuery, reply: matchedFAQ.answer,
            sourceRefs: { faq: faqId }, model: "faq-dataset", generationType: "faq", hadCitationIssues: false,
          });
        } catch (err: any) {
          console.error("[nur-proxy] response log write failed (non-fatal):", err?.message ?? err);
        }
      }
      await logMetric(supabase, device_id, usageDate, "ai_request", {
        model: "faq-dataset", generation_type: "faq", faq_id: faqId, safe_to_log: true,
      });
      return reply({ reply: matchedFAQ.answer, remaining, unlocked: isUnlocked, model: "faq-dataset", faq_id: faqId });
    }

    // Query analysis
    const analysis = await analyzeQuery(userQuery, supabase);
    const topicKeys = matchTopics(userQuery.toLowerCase()).map((t) => t.key);
    const routeLevel = analysis.confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD ? analysis.complexity : "complex";
    const isSafeToLog = routeLevel !== "complex" && !analysis.isPersonal && !analysis.isTimeSensitive;

    // Query expansion
    const ragQuery = stripContextPreamble(expandQuery(userQuery));
    console.log(`[RAG] expanded query: ${ragQuery.slice(0, 120)}...`);

    // Evidence assembly
    const evidence = await assembleEvidence(supabase, ragQuery, analysis, userSchoolPref);
    console.log(`[RAG] quran=${evidence.quran.length} hadith=${evidence.hadith.length} scholarly=${evidence.scholarly.length} entities=${evidence.entities.length}`);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(evidence, analysis, userSchoolPref);
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

    // Claim extraction & verification
    const claims = extractClaims(genResult.reply, evidence);
    const verifications = await verifyClaims(claims, evidence, msgs);

    // Citation validation (legacy bracket format cleanup)
    const hadithResult = validateHadithCitations(genResult.reply, new Set(evidence.hadith.map(h => `${h.collection}-${h.number}`)));
    const quranResult = validateQuranCitations(hadithResult.text, evidence.quran);

    // Build verified answer
    const verified = buildVerifiedAnswer(quranResult.text, claims, verifications, evidence, userSchoolPref);

    const hadCitationIssues = hadithResult.hadInvalid || quranResult.hadInvalid;

    // Logging
    if (isSafeToLog) {
      try {
        await logResponse(supabase, {
          deviceId: device_id, normalizedQuestion, topicKeys, userQuery, reply: verified.text,
          sourceRefs: {
            quran: evidence.quran.map(v => v.sourceId),
            hadith: evidence.hadith.map(h => h.sourceId),
            scholarly: evidence.scholarly.map(s => s.sourceId),
          },
          model: modelUsed, generationType: routeLevel, hadCitationIssues,
          verificationResults: verifications, abstained: verified.abstained, schoolContext: userSchoolPref,
        });
      } catch (err: any) {
        console.error("[nur-proxy] response log write failed (non-fatal):", err?.message ?? err);
      }
    }

    await logMetric(supabase, device_id, usageDate, "ai_request", {
      model: modelUsed, generation_type: routeLevel,
      classification_confidence: analysis.confidence, citation_issues: hadCitationIssues,
      safe_to_log: isSafeToLog, topic_keys: topicKeys,
      verification_passed: verifications.filter(v => v.status === "supported").length,
      verification_total: verifications.length,
      abstained: verified.abstained,
      school_context: userSchoolPref,
    });

    // Return enhanced response
    return reply({
      reply: verified.text,
      remaining,
      unlocked: isUnlocked,
      model: modelUsed,
      citations: verified.citations,
      schoolAttribution: verified.schoolAttribution,
      hasUnsupportedClaims: verified.hasUnsupportedClaims,
      abstained: verified.abstained,
      abstentionReason: verified.abstentionReason,
    });

  } catch (err: any) {
    await refund();
    console.error("[nur-proxy] Fatal:", err?.message ?? err);
    await logMetric(supabase, deviceIdForLog, utcDate(0), "ai_provider_failure", { message: String(err?.message ?? err).slice(0, 300) });
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
});