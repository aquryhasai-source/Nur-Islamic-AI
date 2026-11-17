// Text for the Citations panel: handles structured citations from backend
const cache = new Map();

async function getJson(url, ms = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

export function getCitationText(c) {
  const key = c.key;
  if (!cache.has(key)) {
    const p = (c.type === "quran" ? loadVerse(c.surah, c.ayah) : loadHadith(c.collection, c.number))
      .catch(e => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return cache.get(key);
}

async function loadVerse(surah, ayah) {
  const d = await getJson(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/quran-uthmani,en.sahih`);
  const [ar, en] = d.data || [];
  if (!ar || !en) throw new Error("no verse");
  return { arabic: ar.text, text: en.text, label: `${en.surah?.englishName || "Surah " + surah} ${surah}:${ayah}` };
}

async function loadHadith(collection, number) {
  if (!collection) throw new Error("unknown collection");
  const d = await getJson(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${collection}/${number}.min.json`);
  const h = d.hadiths?.[0];
  if (!h?.text) throw new Error("no hadith");
  const grade = h.grades?.[0]?.grade;
  return { text: h.text.trim(), grade: grade || "" };
}

// New: fetch scholarly ruling text (placeholder for future API)
export async function loadScholarlyRuling(sourceId) {
  // sourceId format: "scholar:school:topic"
  // For now, return the cached text from the citation
  return { text: "Scholarly ruling text would be loaded here", grade: "" };
}