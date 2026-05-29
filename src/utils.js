export const PROXY_URL   = "https://dvcuisgpptxhjgiasqlp.supabase.co/functions/v1/nur-proxy";
export const DAILY_LIMIT = 15;

export const KEYS = {
  ID:           "nur_device_id",
  REMAINING:    "nur_remaining",
  DATE:         "nur_date",
  UNLOCKED:     "nur_unlocked",
  PROFILE:      "nur_profile",
  INSTALLED:    "nur_pwa_installed",
  CITY:         "nur_ramadan_city",
  BOOKMARKS:    "nur_bookmarks",
  THEME:        "nur_theme",
  TEXT_SIZE:    "nur_text_size",
  CHAT_HISTORY: "nur_chat_history",
};

export function getAnonymousId() {
  let id = localStorage.getItem(KEYS.ID);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEYS.ID, id); }
  return id;
}

// Returns "YYYY-MM-DD" in the user's LOCAL timezone — not UTC.
// This ensures the daily reset happens at the user's local midnight,
// not at a fixed UTC time that may be morning/afternoon in their region.
function getLocalDateString() {
  return new Date().toLocaleDateString("en-CA"); // "en-CA" locale gives YYYY-MM-DD format
}

export function getCachedRemaining() {
  if (localStorage.getItem(KEYS.UNLOCKED) === "true") return 999;
  const today = getLocalDateString();
  if (localStorage.getItem(KEYS.DATE) !== today) {
    localStorage.setItem(KEYS.DATE, today);
    localStorage.setItem(KEYS.REMAINING, String(DAILY_LIMIT));
    return DAILY_LIMIT;
  }
  return parseInt(localStorage.getItem(KEYS.REMAINING) ?? String(DAILY_LIMIT), 10);
}

export function setCachedRemaining(val) {
  localStorage.setItem(KEYS.DATE, getLocalDateString());
  localStorage.setItem(KEYS.REMAINING, String(val));
}

export function getLocalDate() {
  return getLocalDateString();
}

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(KEYS.PROFILE) || "{}"); }
  catch { return {}; }
}

export function saveProfile(p) {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
}

export function getAgePrefix(yearOfBirth) {
  if (!yearOfBirth) return "";
  const age = new Date().getFullYear() - parseInt(yearOfBirth, 10);
  if (isNaN(age) || age <= 0 || age > 120) return "";
  if (age < 13) return "The person asking is a child around 10 years old. Use very simple words, short sentences, and relatable everyday examples. Avoid complex Arabic terminology without full explanation. Be warm, encouraging, and patient. ";
  if (age < 18) return "The person asking is a teenager. Keep explanations clear, engaging, and relatable without being patronizing or overly academic. ";
  return "";
}

export function getMidnightCountdown() {
  const now = new Date(), midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight - now;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

export function getCountdownTo(timeStr) {
  const now    = new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const diff = target - now;
  return {
    hours: Math.floor(diff / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
    secs:  Math.floor((diff % 60000) / 1000),
  };
}

export async function checkIfRamadan() {
  const today = new Date();
  const dd    = String(today.getDate()).padStart(2, "0");
  const mm    = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy  = today.getFullYear();
  const res   = await fetch(`https://api.aladhan.com/v1/gToH?date=${dd}-${mm}-${yyyy}`);
  const data  = await res.json();
  const h     = data.data.hijri;
  return { isRamadan: h.month.number === 9, hijriDay: h.day, hijriMonth: h.month.en, hijriYear: h.year };
}

export async function getPrayerTimes(lat, lon) {
  const ts  = Math.floor(Date.now() / 1000);
  const res = await fetch(`https://api.aladhan.com/v1/timings/${ts}?latitude=${lat}&longitude=${lon}&method=2`);
  const data = await res.json();
  if (data.code !== 200) throw new Error("Could not get prayer times");
  return data.data.timings;
}

export async function getPrayerTimesByCity(city) {
  const res  = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&method=2`);
  const data = await res.json();
  if (data.code !== 200) throw new Error("City not found");
  return data.data.timings;
}

export const QURAN_TRANSLATIONS = [
  { code: "en.sahih",      label: "English",    lang: "en" },
  { code: "ur.maududi",    label: "Urdu",       lang: "ur" },
  { code: "fr.hamidullah", label: "French",     lang: "fr" },
  { code: "tr.diyanet",    label: "Turkish",    lang: "tr" },
  { code: "id.indonesian", label: "Indonesian", lang: "id" },
  { code: "bn.bengali",    label: "Bangla",     lang: "bn" },
];

export const HADITH_COLLECTIONS = [
  { id: "bukhari",  label: "Sahih Bukhari",  arabic: "صحيح البخاري", hadiths: 7563 },
  { id: "muslim",   label: "Sahih Muslim",   arabic: "صحيح مسلم",   hadiths: 7453 },
  { id: "abudawud", label: "Abu Dawud",      arabic: "سنن أبي داود", hadiths: 5274 },
  { id: "tirmidhi", label: "Tirmidhi",       arabic: "جامع الترمذي", hadiths: 3956 },
  { id: "nasai",    label: "An-Nasai",       arabic: "سنن النسائي",  hadiths: 5758 },
  { id: "ibnmajah", label: "Ibn Majah",      arabic: "سنن ابن ماجه", hadiths: 4341 },
];

export function hadithUrl(id) {
  return `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${id}.min.json`;
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────
export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(KEYS.BOOKMARKS) || "[]"); }
  catch { return []; }
}

export function toggleBookmark(item, current) {
  const idx = current.findIndex(b => b.id === item.id);
  const updated = idx >= 0
    ? current.filter(b => b.id !== item.id)
    : [{ ...item, savedAt: Date.now() }, ...current];
  localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(updated));
  return updated;
}

export function isBookmarked(id, bookmarks) {
  return bookmarks.some(b => b.id === id);
}

// ─── Chat History ─────────────────────────────────────────────────────────────
export function getChatHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.CHAT_HISTORY) || "[]"); }
  catch { return []; }
}

export function addChatEntry(question, answer) {
  const history = getChatHistory();
  const entry = {
    id: crypto.randomUUID(),
    question: question.slice(0, 200),
    answer: answer.slice(0, 500),
    timestamp: Date.now(),
  };
  const updated = [entry, ...history].slice(0, 100);
  localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(updated));
  return updated;
}

// ─── Qibla calculation ────────────────────────────────────────────────────────
export function calculateQibla(lat, lon) {
  const makkahLat = 21.4225 * Math.PI / 180;
  const makkahLon = 39.8262 * Math.PI / 180;
  const userLat   = lat * Math.PI / 180;
  const dLon      = makkahLon - lon * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(makkahLat);
  const x = Math.cos(userLat) * Math.sin(makkahLat) - Math.sin(userLat) * Math.cos(makkahLat) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── Hijri calendar helpers ───────────────────────────────────────────────────
export const HIJRI_MONTHS = [
  "Muharram","Safar","Rabi al-Awwal","Rabi al-Thani",
  "Jumada al-Awwal","Jumada al-Thani","Rajab","Sha'ban",
  "Ramadan","Shawwal","Dhul Qa'dah","Dhul Hijjah",
];

export const ISLAMIC_EVENTS = {
  "1-1":  "Islamic New Year",
  "1-10": "Day of Ashura",
  "3-12": "Mawlid al-Nabi ﷺ",
  "7-27": "Isra wal Miraj",
  "8-15": "Shab-e-Barat",
  "9-1":  "Ramadan Begins",
  "9-27": "Laylat al-Qadr",
  "10-1": "Eid al-Fitr",
  "12-10":"Eid al-Adha",
  "12-8": "Day of Arafah",
};
