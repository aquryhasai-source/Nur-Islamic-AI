import { useSyncExternalStore } from "react";

// Display-only reading preferences shared by the Quran and Hadith tabs.
// Stored locally under its own key; applied purely as CSS variables / classes
// on <html>. Nothing here touches data, APIs or app state.
const KEY = "nur_reading_prefs";
export const READING_DEFAULTS = { arFont:"amiri", enFont:"nunito", arSize:32, enSize:16, arLh:2.1, enLh:1.8, gap:18, width:760, showAr:true, showTr:true, showNum:true };
export const AR_FONTS = { amiri:"'Amiri', serif", scheherazade:"'Scheherazade New', serif", naskh:"'Noto Naskh Arabic', serif" };
export const EN_FONTS = { nunito:"'Nunito', system-ui, sans-serif", lora:"'Lora', Georgia, serif" };

const load = () => { try { return { ...READING_DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { ...READING_DEFAULTS }; } };
let state = load();
const subs = new Set();

function apply(o) {
  const r = document.documentElement;
  r.style.setProperty("--rd-ar-font", AR_FONTS[o.arFont] || AR_FONTS.amiri);
  r.style.setProperty("--rd-en-font", EN_FONTS[o.enFont] || EN_FONTS.nunito);
  r.style.setProperty("--rd-ar-size", o.arSize + "px");
  r.style.setProperty("--rd-en-size", o.enSize + "px");
  r.style.setProperty("--rd-ar-lh", String(o.arLh));
  r.style.setProperty("--rd-en-lh", String(o.enLh));
  r.style.setProperty("--rd-gap", o.gap + "px");
  r.style.setProperty("--rd-width", o.width + "px");
  r.classList.toggle("rd-hide-ar", !o.showAr);
  r.classList.toggle("rd-hide-tr", !o.showTr);
  r.classList.toggle("rd-hide-num", !o.showNum);
}
if (typeof document !== "undefined") apply(state);

const emit = () => { apply(state); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} subs.forEach(f => f()); };
export const setReadingOpt = (k, v) => {
  // keep at least one of Arabic / translation visible
  if ((k === "showAr" && !v && !state.showTr) || (k === "showTr" && !v && !state.showAr)) return;
  state = { ...state, [k]: v }; emit();
};
export const resetReading = () => { state = { ...READING_DEFAULTS }; emit(); };
export const useReadingPrefs = () => useSyncExternalStore(
  (f) => { subs.add(f); return () => subs.delete(f); },
  () => state
);
