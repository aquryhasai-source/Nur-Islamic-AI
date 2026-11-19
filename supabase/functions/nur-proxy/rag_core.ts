// rag_core.ts — pure, dependency-free RAG helpers for nur-proxy.
// Everything here is deterministic and unit-tested offline (see evals/ and tests/).
// Nothing in this file touches the network, the DB, or Deno APIs.

// ──────────────────────────────────────────────────────────────────────────────
// Minimal structural types (index.ts passes its richer types; these are compatible)
// ──────────────────────────────────────────────────────────────────────────────

export interface QuranLike { sourceId: string; surah: number; ayah: number; surahName: string; translationEn: string; }
export interface HadithLike { sourceId: string; collection: string; collectionLabel: string; number: number; translationEn: string; }
export interface ScholarLike { sourceId: string; school: string; topic: string; ruling: string; notes: string; }
export interface EvidenceLike { quran: QuranLike[]; hadith: HadithLike[]; scholarly: ScholarLike[]; }

export interface CitationEntry {
  num: number;
  sourceId: string;
  sourceType: "quran" | "hadith" | "scholarly";
  label: string;
  school?: string;
  textSnippet: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON extraction (models wrap JSON in ```json fences or add prose)
// ──────────────────────────────────────────────────────────────────────────────

export function extractJson(text: string): unknown | null {
  if (typeof text !== "string") return null;
  let t = text.trim();
  if (!t) return null;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* fall through */ }

  // Balanced scan from the first '[' or '{'
  const start = t.search(/[\[{]/);
  if (start < 0) return null;
  const open = t[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Input hygiene
// ──────────────────────────────────────────────────────────────────────────────

const SCHOOL_WHITELIST = new Set(["hanafi", "maliki", "shafi", "hanbali", "comparative", "none"]);

/** Only whitelisted values may reach the prompt. Anything else → null. */
export function sanitizeSchoolPref(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.toLowerCase().trim().replace(/[’'`]/g, "");
  if (s === "shafii" || s === "shafi i" || s === "shafie") s = "shafi";
  return SCHOOL_WHITELIST.has(s) ? s : null;
}

/** Keep only [a-z0-9] so a term can never inject PostgREST filter syntax. */
export function safeTerm(k: string): string {
  return String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ──────────────────────────────────────────────────────────────────────────────
// Topic matching with word boundaries ("sin" must not match "business")
// ──────────────────────────────────────────────────────────────────────────────

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

const kwCache = new Map<string, RegExp>();
function kwRegex(kw: string): RegExp {
  let re = kwCache.get(kw);
  if (!re) {
    re = new RegExp(`(?<![a-z0-9])${escapeRe(kw)}(?:s|es|ed|ing)?(?![a-z0-9])`, "i");
    kwCache.set(kw, re);
  }
  return re;
}

/** Topics whose keywords appear as whole words, most keyword hits first (stable for ties). */
export function matchTopicsWB<T extends { kw: string[] }>(query: string, topics: T[]): T[] {
  const q = query.toLowerCase();
  return topics
    .map((t, i) => ({ t, i, hits: t.kw.filter(kw => kwRegex(kw.toLowerCase()).test(q)).length }))
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .map(x => x.t);
}

// ──────────────────────────────────────────────────────────────────────────────
// Citation index — ONE definition of numbering, used by prompt, claims and conversion
// Order: quran → hadith → scholarly. Numbers are 1-based.
// ──────────────────────────────────────────────────────────────────────────────

export function prettifyTopic(topic: string): string {
  return String(topic).replace(/[_\-]+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}

export function schoolLabel(school: string): string {
  if (school === "consensus") return "Consensus";
  if (school === "difference") return "Scholarly Difference";
  if (school === "shafi") return "Shafi'i";
  return school.charAt(0).toUpperCase() + school.slice(1);
}

export function buildCitationIndex(ev: EvidenceLike): CitationEntry[] {
  const out: CitationEntry[] = [];
  let n = 0;
  for (const v of ev.quran) {
    out.push({ num: ++n, sourceId: v.sourceId, sourceType: "quran", label: `${v.surahName} ${v.surah}:${v.ayah}`, textSnippet: v.translationEn.slice(0, 200) });
  }
  for (const h of ev.hadith) {
    out.push({ num: ++n, sourceId: h.sourceId, sourceType: "hadith", label: `${h.collectionLabel} #${h.number}`, textSnippet: h.translationEn.slice(0, 200) });
  }
  for (const s of ev.scholarly) {
    out.push({ num: ++n, sourceId: s.sourceId, sourceType: "scholarly", label: `${schoolLabel(s.school)}: ${prettifyTopic(s.topic)}`, school: s.school, textSnippet: `${s.ruling} — ${s.notes}`.slice(0, 200) });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Relevance grader (CRAG-style): decide which retrieved items directly answer the question
// ──────────────────────────────────────────────────────────────────────────────

export interface GraderCandidate { id: string; header: string; text: string; }

export function buildGraderCandidates(ev: EvidenceLike, caps = { quran: 12, hadith: 12, scholarly: 10 }): GraderCandidate[] {
  const c: GraderCandidate[] = [];
  ev.quran.slice(0, caps.quran).forEach((v, i) => c.push({ id: `Q${i + 1}`, header: `Quran ${v.surah}:${v.ayah}`, text: v.translationEn.slice(0, 400) }));
  ev.hadith.slice(0, caps.hadith).forEach((h, i) => c.push({ id: `H${i + 1}`, header: `${h.collectionLabel} #${h.number}`, text: h.translationEn.slice(0, 400) }));
  ev.scholarly.slice(0, caps.scholarly).forEach((s, i) => c.push({ id: `S${i + 1}`, header: `${schoolLabel(s.school)} on ${s.topic}`, text: `${s.ruling}. ${s.notes}`.slice(0, 400) }));
  return c;
}

export function buildGraderPrompt(question: string, cands: GraderCandidate[]): string {
  return `You are a strict relevance judge for an Islamic Q&A system. A user asked a question; a search engine returned candidate passages. Many candidates are keyword accidents.

QUESTION: "${question.slice(0, 600)}"

Keep a candidate ONLY if its text DIRECTLY addresses the specific subject of the question (the same thing, the same action, or the same ruling). Reject candidates that merely share a word, are about a different topic, or are only loosely related by theme. Example: a verse about orphans' guardians does NOT answer a question about guard dogs. When unsure, reject.

CANDIDATES:
${cands.map(c => `${c.id} — ${c.header}: "${c.text}"`).join("\n")}

Respond with ONLY this JSON and nothing else: {"relevant": ["Q1", "H2"]}
Use an empty list if none qualify.`;
}

/** Returns the set of approved ids, or null if the output is unusable (caller must fail closed). */
export function parseGraderOutput(text: string, validIds: Set<string>): Set<string> | null {
  const j = extractJson(text);
  let arr: unknown = null;
  if (Array.isArray(j)) arr = j;
  else if (j && typeof j === "object" && Array.isArray((j as any).relevant)) arr = (j as any).relevant;
  if (!arr) return null;
  const out = new Set<string>();
  for (const x of arr as unknown[]) {
    const id = String(x).toUpperCase().trim();
    if (validIds.has(id)) out.add(id);
  }
  return out;
}

export function applyGrade(ev: EvidenceLike, approved: Set<string>, caps = { quran: 12, hadith: 12, scholarly: 10 }): EvidenceLike {
  return {
    quran: ev.quran.slice(0, caps.quran).filter((_, i) => approved.has(`Q${i + 1}`)),
    hadith: ev.hadith.slice(0, caps.hadith).filter((_, i) => approved.has(`H${i + 1}`)),
    scholarly: ev.scholarly.slice(0, caps.scholarly).filter((_, i) => approved.has(`S${i + 1}`)),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sentences (shared by claim extraction and removal so indexes always agree)
// ──────────────────────────────────────────────────────────────────────────────

export function splitSentences(text: string): { sentences: string[]; seps: string[] } {
  const parts = text.split(/(?<=[.!?])(\s+)/);
  const sentences: string[] = [];
  const seps: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    sentences.push(parts[i]);
    seps.push(parts[i + 1] ?? "");
  }
  return { sentences, seps };
}

export function removeSentences(text: string, drop: Set<number>): string {
  if (drop.size === 0) return text;
  const { sentences, seps } = splitSentences(text);
  let out = "";
  let pendingSep = "";
  for (let i = 0; i < sentences.length; i++) {
    if (drop.has(i)) {
      // keep paragraph breaks when a whole sentence disappears
      if (/\n/.test(seps[i]) && !/\n/.test(pendingSep)) pendingSep = seps[i];
      continue;
    }
    if (out) out += pendingSep || " ";
    out += sentences[i];
    pendingSep = seps[i];
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

// ──────────────────────────────────────────────────────────────────────────────
// Numeric → named citation conversion
// "[4]" "[4][6]" "[4, 6]" → "[Sahih Bukhari #5483][Al-Baqarah 2:45]".  Unknown numbers are dropped.
// ──────────────────────────────────────────────────────────────────────────────

export function convertNumericCitations(text: string, index: CitationEntry[]): { text: string; used: Set<number>; dropped: number } {
  const byNum = new Map(index.map(e => [e.num, e]));
  const used = new Set<number>();
  let dropped = 0;
  // [12] or [1, 2] or [1,2,3]; NOT [2:255] (has a colon) and NOT [1-3]
  const re = /\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]/g;
  let out = text.replace(re, (_m, group: string) => {
    const nums = group.split(/[,;]/).map(s => parseInt(s.trim(), 10));
    const labels: string[] = [];
    for (const n of nums) {
      const e = byNum.get(n);
      if (!e) { dropped++; continue; }
      used.add(n);
      const lab = `[${e.label}]`;
      if (!labels.includes(lab)) labels.push(lab);
    }
    return labels.join("");
  });
  out = out.replace(/[ \t]{2,}/g, " ").replace(/ ([.,;:!?])/g, "$1").trim();
  return { text: out, used, dropped };
}

// ──────────────────────────────────────────────────────────────────────────────
// School claims: never state a school's position unless a retrieved ruling backs it
// ──────────────────────────────────────────────────────────────────────────────

const SCHOOL_NAME_RE: Record<string, RegExp> = {
  hanafi: /\bhanafi(?:s|yyah|yah)?\b/i,
  maliki: /\bmaliki(?:s|yyah|yah)?\b/i,
  shafi: /\bshafi['’`]?i(?:s|yyah|yah)?\b/i,
  hanbali: /\bhanbali(?:s|yyah|yah)?\b/i,
};
const FOUR_SCHOOLS_RE = /\b(?:four|4)\s+(?:schools?|madhhabs?|madhabs?)\b|\b(?:all|the)\s+(?:four\s+)?(?:schools|madhhabs|madhabs)\s+(?:agree|differ|hold|permit|prohibit)/i;

export const SCHOOL_NOTE =
  "Note: school-specific rulings (Hanafi, Maliki, Shafi'i, Hanbali) are not yet in NUR's verified sources, so none are stated here. For your school's position, please consult a qualified scholar.";

/** Remove sentences that attribute a position to a school not present in `allowed`. */
export function stripUnsupportedSchoolClaims(text: string, allowed: Set<string>): { text: string; removed: number } {
  const { sentences } = splitSentences(text);
  const drop = new Set<number>();
  sentences.forEach((s, i) => {
    // Scholarly labels produced by our own conversion, e.g. "[Hanafi: Dog Ownership]", are only
    // present when real evidence exists; the allowed-set check below handles them too.
    let mentionsUnsupported = false;
    for (const [school, re] of Object.entries(SCHOOL_NAME_RE)) {
      if (re.test(s) && !allowed.has(school)) mentionsUnsupported = true;
    }
    if (!mentionsUnsupported && allowed.size === 0 && FOUR_SCHOOLS_RE.test(s)) mentionsUnsupported = true;
    if (mentionsUnsupported) drop.add(i);
  });
  if (drop.size === 0) return { text, removed: 0 };
  return { text: appendSchoolNote(removeSentences(text, drop)), removed: drop.size };
}

/** Append the "no school rulings available" note, keeping the closing blessing last. */
export function appendSchoolNote(text: string): string {
  if (text.includes(SCHOOL_NOTE)) return text;
  const closing = /\s*Allahu A['’]lam\.?\s*$/i;
  const hadClosing = closing.test(text);
  let out = hadClosing ? text.replace(closing, "").trim() : text;
  out = `${out}${out ? "\n\n" : ""}${SCHOOL_NOTE}`;
  if (hadClosing) out += " Allahu A'lam.";
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Claim verification output
// ──────────────────────────────────────────────────────────────────────────────

export type VerdictStatus = "supported" | "partially_supported" | "contradicted" | "irrelevant" | "insufficient_evidence";
const STATUSES = new Set<VerdictStatus>(["supported", "partially_supported", "contradicted", "irrelevant", "insufficient_evidence"]);

export interface Verdict { claimIndex: number; status: VerdictStatus; explanation: string; }

/** Returns verdicts keyed by 1-based claimIndex, or null when the output is unusable. */
export function parseVerifierOutput(text: string, nClaims: number): Map<number, Verdict> | null {
  const j = extractJson(text);
  let arr: unknown = null;
  if (Array.isArray(j)) arr = j;
  else if (j && typeof j === "object") {
    const o = j as any;
    arr = o.results ?? o.verdicts ?? o.claims ?? null;
  }
  if (!Array.isArray(arr)) return null;
  const out = new Map<number, Verdict>();
  for (const item of arr as any[]) {
    const idx = Number(item?.claimIndex);
    const status = String(item?.status ?? "") as VerdictStatus;
    if (!Number.isInteger(idx) || idx < 1 || idx > nClaims || !STATUSES.has(status)) continue;
    out.set(idx, { claimIndex: idx, status, explanation: String(item?.explanation ?? "").slice(0, 300) });
  }
  return out.size > 0 ? out : null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Claims (sentence-level) and final answer assembly
// ──────────────────────────────────────────────────────────────────────────────

export interface ClaimLike {
  id: string;
  text: string;
  type: "ruling" | "fact" | "attribution" | "definition";
  citedSourceIds: string[];
  sentenceIdx: number;
}

/**
 * A sentence becomes a claim to verify if it carries a valid numeric citation, or if it puts words
 * in the Prophet's ﷺ mouth (a quotation or "said/narrated"). Uncited general statements are left alone.
 */
export function extractClaimsCore(response: string, index: CitationEntry[]): ClaimLike[] {
  const byNum = new Map(index.map(e => [e.num, e.sourceId]));
  const { sentences } = splitSentences(response);
  const claims: ClaimLike[] = [];
  sentences.forEach((sentence, i) => {
    const cites: string[] = [];
    const re = /\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sentence)) !== null) {
      for (const part of m[1].split(/[,;]/)) {
        const id = byNum.get(parseInt(part.trim(), 10));
        if (id && !cites.includes(id)) cites.push(id);
      }
    }
    const lower = sentence.toLowerCase();
    let type: ClaimLike["type"] = "fact";
    if (/\b(halal|haram|permissible|forbidden|wajib|fard|mandub|makruh|ruling|allowed|prohibited|impermissible|disliked|obligatory)\b/.test(lower)) type = "ruling";
    const quotedSaying = /\b(prophet|messenger|rasul\w*|muhammad)\b/.test(lower) && /["“”]|\b(said|says|narrated|reported|stated|commanded|forbade)\b/.test(lower);
    if (quotedSaying) type = "attribution";
    else if (type === "fact" && /\b(means|meaning|defined|definition)\b/.test(lower)) type = "definition";
    if (cites.length > 0 || type === "attribution") {
      claims.push({ id: `claim_${claims.length + 1}`, text: sentence.trim(), type, citedSourceIds: cites, sentenceIdx: i });
    }
  });
  return claims;
}

/**
 * Which claim sentences to remove.
 * - An uncited quoted saying of the Prophet ﷺ can never be backed by an approved source when there is
 *   no evidence at all, or when the verifier is unavailable → removed deterministically.
 * - Otherwise the verifier's verdicts decide.
 */
export function sentencesToDrop(claims: ClaimLike[], verdicts: Map<number, Verdict> | null, hasEvidence = true): { drop: Set<number>; unsupported: number } {
  const drop = new Set<number>();
  claims.forEach((c, i) => {
    if (c.type === "attribution" && c.citedSourceIds.length === 0 && (!hasEvidence || !verdicts)) { drop.add(c.sentenceIdx); return; }
    if (!verdicts) return;
    const v = verdicts.get(i + 1);
    if (!v) return;
    const strict = c.type === "ruling" || c.type === "attribution";
    if (v.status === "contradicted" || v.status === "irrelevant" || (strict && v.status === "insufficient_evidence")) drop.add(c.sentenceIdx);
  });
  return { drop, unsupported: drop.size };
}

const SCHOOL_LABEL_RE = /\[((?:Hanafi|Maliki|Shafi'i|Shafi|Hanbali|Consensus|Scholarly Difference):\s*[^\]]+)\]/gi;

/** Remove any "[School: Topic]" bracket that does not match an approved scholarly citation. */
export function validateSchoolLabels(text: string, index: CitationEntry[]): { text: string; removed: number } {
  const ok = new Set(index.filter(e => e.sourceType === "scholarly").map(e => e.label.toLowerCase()));
  let removed = 0;
  const out = text.replace(SCHOOL_LABEL_RE, (m, label: string) => {
    if (ok.has(label.trim().toLowerCase())) return m;
    removed++;
    return "";
  });
  return { text: out.replace(/[ \t]{2,}/g, " ").replace(/ ([.,;:!?])/g, "$1").trim(), removed };
}

export const ABSTAIN_TEXT =
  "I couldn't produce a reliable answer from NUR's verified sources for this question. Please consult a qualified scholar. Allahu A'lam.";

export interface FinalizeResult {
  text: string;
  citations: (CitationEntry & { citationNum: number })[];
  removedSentences: number;
  schoolSentencesRemoved: number;
  badLabelsRemoved: number;
  droppedUnknownNumbers: number;
  abstained: boolean;
}

/**
 * Deterministic post-generation pipeline. `evidence` must already be the grader-approved set.
 * Order: drop unsupported sentences → numbers→names → drop invented school labels →
 * strip school claims without evidence → abstain if nothing is left.
 * Callers still run the legacy named-citation validators between conversion and school stripping
 * via the `namedValidators` hook.
 */
export function finalizeAnswer(opts: {
  raw: string;
  evidence: EvidenceLike;
  claims: ClaimLike[];
  verdicts: Map<number, Verdict> | null;
  namedValidators?: (text: string) => { text: string; changed: boolean };
}): FinalizeResult {
  const index = buildCitationIndex(opts.evidence);
  const { drop } = sentencesToDrop(opts.claims, opts.verdicts, index.length > 0);

  // A sentence that leans on a citation we cannot back is removed whole — stripping just the bracket
  // would leave the unsupported assertion standing. Covers: numbers outside the approved set,
  // verse/hadith references the model wrote itself, and invented "[School: Topic]" labels.
  const validNums = new Set(index.map(e => e.num));
  const hasScholarlyEvidence = index.some(e => e.sourceType === "scholarly");
  let schoolLabelDropped = false;
  const { sentences: rawSentences } = splitSentences(opts.raw);
  rawSentences.forEach((sent, i) => {
    const numGroups = [...sent.matchAll(/\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]/g)];
    if (numGroups.length > 0) {
      const nums = numGroups.flatMap(g => g[1].split(/[,;]/).map(x => parseInt(x.trim(), 10)));
      if (!nums.some(n => validNums.has(n))) drop.add(i);
    }
    if (opts.namedValidators && opts.namedValidators(sent).changed) drop.add(i);
    if (validateSchoolLabels(sent, index).removed > 0) { drop.add(i); if (!hasScholarlyEvidence) schoolLabelDropped = true; }
  });

  let text = removeSentences(opts.raw, drop);

  const conv = convertNumericCitations(text, index);
  text = conv.text;

  if (opts.namedValidators) text = opts.namedValidators(text).text;

  const lab = validateSchoolLabels(text, index);
  text = lab.text;

  const allowedSchools = new Set(index.filter(e => e.sourceType === "scholarly" && e.school && !["consensus", "difference"].includes(e.school)).map(e => e.school!));
  const sch = stripUnsupportedSchoolClaims(text, allowedSchools);
  text = sch.text;
  if (schoolLabelDropped && sch.removed === 0) text = appendSchoolNote(text);

  let abstained = false;
  const bare = text.replace(SCHOOL_NOTE, "").replace(/Allahu A['’]lam\.?/gi, "").replace(/\[[^\]]*\]/g, "").trim();
  if (bare.length < 50) {
    abstained = true;
    text = ABSTAIN_TEXT;
  }

  // Citations actually present in the final text, numbered in order of first appearance.
  const present = index
    .map(e => ({ e, pos: text.indexOf(`[${e.label}]`) }))
    .filter(x => x.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
    .map((x, i) => ({ ...x.e, citationNum: i + 1 }));

  return {
    text,
    citations: abstained ? [] : present,
    removedSentences: drop.size,
    schoolSentencesRemoved: sch.removed + (schoolLabelDropped ? 1 : 0),
    badLabelsRemoved: lab.removed,
    droppedUnknownNumbers: conv.dropped,
    abstained,
  };
}
