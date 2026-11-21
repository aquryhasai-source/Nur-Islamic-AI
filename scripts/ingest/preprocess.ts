// preprocess.ts — pure functions: grading, narrator/isnad splitting, embedding text, content hash.
// No I/O except loadHadithCollection(), which reads the fawazahmed0/hadith-api edition files.
// Written to run under `node --experimental-strip-types` (no enums / parameter properties).

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Grade = "Sahih" | "Hasan";

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------
export interface CollectionInfo {
  slug: string;        // islamic_texts.collection and the Qdrant `book` payload
  bookName: string;    // islamic_texts.book_name
  /** true = every hadith in the book is accepted as Sahih by collection-level consensus (the two Sahihs). */
  allSahih: boolean;
}

export const COLLECTIONS: readonly CollectionInfo[] = [
  { slug: "bukhari", bookName: "Sahih al-Bukhari", allSahih: true },
  { slug: "muslim", bookName: "Sahih Muslim", allSahih: true },
  { slug: "abudawud", bookName: "Sunan Abi Dawud", allSahih: false },
  { slug: "tirmidhi", bookName: "Jami` at-Tirmidhi", allSahih: false },
  { slug: "nasai", bookName: "Sunan an-Nasa'i", allSahih: false },
  { slug: "ibnmajah", bookName: "Sunan Ibn Majah", allSahih: false },
  { slug: "malik", bookName: "Muwatta Malik", allSahih: false },
];

// ---------------------------------------------------------------------------------------------
// Grading — strict. Only an explicit verdict on the hadith itself counts.
// ---------------------------------------------------------------------------------------------
export interface GraderGrade { name: string; grade: string }

/** Words that make a verdict something other than "this hadith is Sahih/Hasan". */
const NOT_A_VERDICT_ON_THE_HADITH =
  /da.?if|weak|mawdu|fabricat|munkar|shadh|batil|matruk|mudtarib|majhul|isnaa?d|sanad|mauquf|muquf|mawquf|maqtu|maqtoo|mursal|mu.?allaq|mudallas/i;

/** Tokens allowed in a positive verdict, e.g. "Sahih", "Hasan Sahih", "Sahih - Agreed Upon", "Sahih Lighairihi". */
const POSITIVE_TOKENS = new Set([
  "sahih", "hasan", "lighairihi", "lighayrihi", "hadith", "mutawatir", "agreed", "upon", "bukhari", "muslim", "and", "-", "witness",
]);

/**
 * Normalises ONE grader's string to 'Sahih' | 'Hasan', or null when it is not a clear positive verdict.
 * Rejected on purpose: "Sahih Isnaad"/"Isnaad Hasan" (chain only), "Mauquf Sahih"/"Maqtu Sahih" (Companion/Successor
 * report, not a Prophetic hadith), anything with a weakness term, "-" (no verdict), and anything unrecognised.
 * "Hasan Sahih" (Tirmidhi) counts as Hasan — the lower of the two, never rounded up.
 */
export function classifyGrade(raw: string | null | undefined): Grade | null {
  // "Sahih Bukhari (98) Sahih Muslim (884)" = Sahih, and it also appears in the Sahihayn at those numbers.
  // Drop bracketed reference numbers (and stray digits/slashes) before checking the words.
  const s = (raw ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[\d/]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s || NOT_A_VERDICT_ON_THE_HADITH.test(s)) return null;
  const tokens = s.split(/\s+/);
  if (!tokens.every((t) => POSITIVE_TOKENS.has(t))) return null;
  if (tokens.includes("hasan")) return "Hasan";
  if (tokens.includes("sahih")) return "Sahih";
  return null;
}

export interface GradeDecision {
  grade: Grade;
  gradeSources: string;
}

export type RejectReason = "no_grades" | "not_all_graders_authentic";

/**
 * A hadith in a non-Sahih collection qualifies only when at least one grader gave a verdict AND every grader
 * who gave a verdict said a clear Sahih/Hasan (graders recording "-" abstain). The result is the LOWEST grade given (any Hasan → Hasan).
 * Bukhari and Muslim: collection-level Sahih.
 */
export function decideGrade(
  c: CollectionInfo, graders: GraderGrade[] | undefined,
): { ok: true; decision: GradeDecision } | { ok: false; reason: RejectReason } {
  if (c.allSahih) {
    return { ok: true, decision: { grade: "Sahih", gradeSources: `collection: ${c.bookName} (agreed-upon Sahih collection)` } };
  }
  // A grader who recorded no verdict ("-" or empty) abstains: it is neither a vote for nor against.
  // At least one real verdict is still required, and every real verdict must be Sahih/Hasan.
  const list = (graders ?? []).filter((g) => g && typeof g.grade === "string" && g.grade.trim() !== "" && g.grade.trim() !== "-");
  if (list.length === 0) return { ok: false, reason: "no_grades" };
  const classes = list.map((g) => classifyGrade(g.grade));
  if (classes.some((x) => x === null)) return { ok: false, reason: "not_all_graders_authentic" };
  const grade: Grade = classes.includes("Hasan") ? "Hasan" : "Sahih";
  const names = list.map((g) => `${g.name}: ${g.grade}`).join("; ");
  return { ok: true, decision: { grade, gradeSources: `all graders agree — ${names}`.slice(0, 500) } };
}

// ---------------------------------------------------------------------------------------------
// English narrator lead-in
// ---------------------------------------------------------------------------------------------
const LEAD_IN = /^(?:(?:narrated|it was narrated)\b[^:]*|[^:]{1,120}?\b(?:narrated|reported|said|related|told us|informed us)\b(?: that)?\s*,?)$/i;

/**
 * Splits "Narrated Ibn Abbas: The Prophet said..." into the lead-in and the matn. Only splits when the text before the
 * first colon (within 140 chars) looks like a narrator lead-in AND a non-trivial remainder exists. Otherwise the full
 * text is the matn and the narrator is null. Never drops content that isn't the lead-in.
 */
export function splitNarrator(textEn: string): { narrator: string | null; matn: string } {
  const text = textEn.trim();
  const i = text.indexOf(":");
  if (i <= 0 || i > 140) return { narrator: null, matn: text };
  const lead = text.slice(0, i).replace(/[\s,]+$/, "").trim();
  const rest = text.slice(i + 1).trim().replace(/^[\s"“”]+/, "");
  // "The Prophet said: ..." / "The Messenger of Allah said: ..." is the speaker, not a narrator lead-in.
  if (/^(?:the (?:prophet|messenger)|allah'?s messenger)\b/i.test(lead)) return { narrator: null, matn: text };
  if (!LEAD_IN.test(lead) || rest.length < 20) return { narrator: null, matn: text };
  return { narrator: lead, matn: rest };
}

// ---------------------------------------------------------------------------------------------
// Arabic isnad / matn split (conservative; null when unsure — full text always stays in text_ar)
// ---------------------------------------------------------------------------------------------
const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;

function stripWithMap(s: string): { plain: string; map: number[] } {
  let plain = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (DIACRITIC.test(ch)) continue;
    // fold common letter variants so markers match regardless of orthography
    const f = ch === "أ" || ch === "إ" || ch === "آ" ? "ا" : ch === "ى" ? "ي" : ch === "ة" ? "ه" : ch;
    plain += f;
    map.push(i);
  }
  return { plain, map };
}

// Where the Prophetic/narrated content begins, or the companion honorific that closes the chain.
// Markers must start at a word boundary ("كان رسول الله" must NOT match "ان رسول الله").
const MATN_STARTS = ["قال رسول الله", "ان رسول الله", "سمعت رسول الله", "قال النبي", "ان النبي", "سمعت النبي"];
const HONORIFIC_END = /(?:^|\s)رضي الله عن(?:ه|ها|هما|هم)(?=\s|$)/;
const CHAIN_WORDS = new Set(["حدثنا", "اخبرنا", "حدثني", "اخبرني", "انبانا", "عن", "سمعت"]);

function indexAtWordStart(plain: string, marker: string): number {
  let from = 0;
  for (;;) {
    const k = plain.indexOf(marker, from);
    if (k < 0) return -1;
    if (k === 0 || plain[k - 1] === " ") return k;
    from = k + 1;
  }
}

/** Returns the isnad prefix, or null when there is no safe split point. */
export function extractIsnadAr(textAr: string | null | undefined): string | null {
  if (!textAr) return null;
  const { plain, map } = stripWithMap(textAr);
  let cutPlain = -1;
  for (const m of MATN_STARTS) {
    const k = indexAtWordStart(plain, m);
    if (k > 0 && (cutPlain < 0 || k < cutPlain)) cutPlain = k;
  }
  const h = HONORIFIC_END.exec(plain);
  if (h) {
    const end = h.index + h[0].length;
    if (cutPlain < 0 || end < cutPlain) cutPlain = end;
  }
  if (cutPlain <= 0 || cutPlain >= plain.length) return null;
  const cut = map[cutPlain] ?? textAr.length;
  const isnad = textAr.slice(0, cut).replace(/[\s،,:]+$/, "").trim();
  const matn = textAr.slice(cut).trim();
  const links = plain.slice(0, cutPlain).split(/[\s،,]+/).filter((w) => CHAIN_WORDS.has(w)).length;
  if (isnad.length < 15 || matn.length < 15 || links < 2) return null;
  // A real chain is a small head of the text. If the "chain" is most of the text, the marker we hit sits inside the
  // narrative (e.g. "...Ibn Umar (may Allah be pleased with him) used to do it"): refuse rather than mis-split.
  if (isnad.length > 0.6 * textAr.length || isnad.length > 800) return null;
  return isnad;
}

// ---------------------------------------------------------------------------------------------
// Embedding input + content hash
// ---------------------------------------------------------------------------------------------
export const MAX_EMBED_CHARS = 6000;

export interface EmbeddableRow {
  sourceType: "quran" | "hadith";
  textEn: string;
  // quran
  surahName?: string | null;
  surahNumber?: number | null;
  ayahNumber?: number | null;
  topicSummary?: string | null;
  // hadith
  bookName?: string | null;
  chapterTitle?: string | null;
}

/**
 * Hadith: Book + Chapter title + Matn (no isnad, no narrator lead-in, no grade, no number).
 * Quran:  Surah name + verse number + English translation + optional one-line topic.
 * Deterministic in the row's stored fields, so ingestion and re-embedding agree on the content hash.
 */
export function embedText(r: EmbeddableRow): string {
  let out: string;
  if (r.sourceType === "quran") {
    const head = `Surah ${r.surahName ?? r.surahNumber} ${r.surahNumber}:${r.ayahNumber}`;
    const topic = r.topicSummary?.trim();
    const body = r.textEn.trim();
    out = topic ? `${head}. ${body.replace(/[.\s]+$/, "")}. Topic: ${topic}` : `${head}. ${body}`;
  } else {
    const { matn } = splitNarrator(r.textEn);
    out = [r.bookName, r.chapterTitle, matn].filter((x) => x && String(x).trim()).join(". ");
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MAX_EMBED_CHARS);
}

/** md5 of the embedding input, formatted as a uuid (matches the `content_hash uuid` column). */
export function contentHash(input: string): string {
  const h = createHash("md5").update(input, "utf8").digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------------------------------------------------------------------------------------------
// Loading hadith files (fawazahmed0/hadith-api edition format)
// ---------------------------------------------------------------------------------------------
export interface HadithRow {
  sourceType: "hadith";
  collection: string;
  ref: string;
  refLabel: string;
  bookName: string;
  bookNo: number | null;
  chapterTitle: string | null;
  grade: Grade;
  gradeSources: string;
  textAr: string | null;
  textEn: string;
  isnadAr: string | null;
  narratorEn: string | null;
  contentHash: string;
}

export interface LoadStats {
  collection: string;
  total: number;
  accepted: number;
  skippedEmptyEnglish: number;
  skippedNoGrades: number;
  skippedNotAllAuthentic: number;
  skippedDuplicateRef: number;
  isnadSplit: number;
  narratorSplit: number;
  noArabic: number;
}

interface RawHadith {
  hadithnumber: number | string;
  text?: string;
  grades?: GraderGrade[];
  reference?: { book?: number; hadith?: number };
}
interface RawEdition {
  metadata?: { sections?: Record<string, string> };
  hadiths: RawHadith[];
}

export function buildHadithRows(c: CollectionInfo, eng: RawEdition, ara: RawEdition | null): { rows: HadithRow[]; stats: LoadStats } {
  const stats: LoadStats = {
    collection: c.slug, total: eng.hadiths.length, accepted: 0, skippedEmptyEnglish: 0, skippedNoGrades: 0,
    skippedNotAllAuthentic: 0, skippedDuplicateRef: 0, isnadSplit: 0, narratorSplit: 0, noArabic: 0,
  };
  const arabic = new Map<string, string>();
  for (const h of ara?.hadiths ?? []) {
    if (typeof h.text === "string" && h.text.trim()) arabic.set(String(h.hadithnumber), h.text.trim());
  }
  const sections = eng.metadata?.sections ?? {};
  const seen = new Set<string>();
  const rows: HadithRow[] = [];

  for (const h of eng.hadiths) {
    const ref = String(h.hadithnumber);
    const textEn = (h.text ?? "").trim();
    if (!textEn) { stats.skippedEmptyEnglish++; continue; }
    const g = decideGrade(c, h.grades);
    if (!g.ok) {
      if (g.reason === "no_grades") stats.skippedNoGrades++; else stats.skippedNotAllAuthentic++;
      continue;
    }
    if (seen.has(ref)) { stats.skippedDuplicateRef++; continue; }
    seen.add(ref);

    const bookNo = typeof h.reference?.book === "number" ? h.reference.book : null;
    const title = bookNo !== null ? (sections[String(bookNo)] ?? "").trim() : "";
    const textAr = arabic.get(ref) ?? null;
    if (!textAr) stats.noArabic++;
    const isnadAr = extractIsnadAr(textAr);
    if (isnadAr) stats.isnadSplit++;
    const { narrator } = splitNarrator(textEn);
    if (narrator) stats.narratorSplit++;

    const row: HadithRow = {
      sourceType: "hadith", collection: c.slug, ref, refLabel: `${c.bookName} ${ref}`,
      bookName: c.bookName, bookNo, chapterTitle: title || null,
      grade: g.decision.grade, gradeSources: g.decision.gradeSources,
      textAr, textEn, isnadAr, narratorEn: narrator, contentHash: "",
    };
    row.contentHash = contentHash(embedText({ sourceType: "hadith", textEn, bookName: row.bookName, chapterTitle: row.chapterTitle }));
    rows.push(row);
    stats.accepted++;
  }
  return { rows, stats };
}

export function loadHadithCollection(dir: string, c: CollectionInfo): { rows: HadithRow[]; stats: LoadStats } {
  const engPath = join(dir, `eng-${c.slug}.min.json`);
  const araPath = join(dir, `ara-${c.slug}.min.json`);
  if (!existsSync(engPath)) throw new Error(`missing ${engPath}`);
  const eng = JSON.parse(readFileSync(engPath, "utf8")) as RawEdition;
  const ara = existsSync(araPath) ? (JSON.parse(readFileSync(araPath, "utf8")) as RawEdition) : null;
  if (!Array.isArray(eng.hadiths)) throw new Error(`${engPath}: no hadiths array`);
  return buildHadithRows(c, eng, ara);
}
