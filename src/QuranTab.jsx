import { useState, useEffect, useRef } from "react";
import { QURAN_TRANSLATIONS } from "./utils.js";

const BASE = "https://api.alquran.cloud/v1";

// Module-level cache
const surahCache  = {};
const searchCache = {};

const BackIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;

function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 20px", gap: "6px" }}>
      {[0, 1, 2].map(d => <div key={d} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c9a84c", animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${d * 0.2}s`, opacity: 0.7 }}/>)}
    </div>
  );
}

// ─── Surah List ───────────────────────────────────────────────────────────────
function SurahList({ onSelect }) {
  const [surahs,  setSurahs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");

  useEffect(() => {
    if (surahCache.list) { setSurahs(surahCache.list); setLoading(false); return; }
    fetch(`${BASE}/surah`)
      .then(r => r.json())
      .then(d => { surahCache.list = d.data; setSurahs(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = surahs.filter(s =>
    s.englishName.toLowerCase().includes(filter.toLowerCase()) ||
    s.englishNameTranslation.toLowerCase().includes(filter.toLowerCase()) ||
    String(s.number).includes(filter)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(201,168,76,0.1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "12px", padding: "9px 14px" }}>
          <SearchIcon/>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search Surah by name or number…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(255,255,240,0.88)", fontSize: "14px", fontFamily: "Nunito,sans-serif" }}/>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
        {loading ? <Loader/> : filtered.map(s => (
          <button key={s.number} onClick={() => onSelect(s.number)}
            style={{ display: "flex", alignItems: "center", gap: "14px", width: "100%", padding: "12px 14px", marginBottom: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: "12px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(201,168,76,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#c9a84c", fontSize: "12px", fontWeight: 700 }}>{s.number}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "rgba(255,255,240,0.88)", fontSize: "14px", fontWeight: 600 }}>{s.englishName}</div>
              <div style={{ color: "rgba(201,168,76,0.5)", fontSize: "12px", marginTop: "2px" }}>{s.englishNameTranslation} · {s.numberOfAyahs} ayahs · {s.revelationType}</div>
            </div>
            <div style={{ color: "#c9a84c", fontSize: "18px", fontFamily: "Georgia,serif", opacity: 0.8 }}>{s.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Surah Reader ─────────────────────────────────────────────────────────────
function SurahReader({ surahNumber, translation, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const cacheKey = `${surahNumber}-${translation}`;

  useEffect(() => {
    setLoading(true); setError(null);
    if (surahCache[cacheKey]) { setData(surahCache[cacheKey]); setLoading(false); return; }
    fetch(`${BASE}/surah/${surahNumber}/editions/quran-uthmani,${translation}`)
      .then(r => r.json())
      .then(d => {
        if (!d.data) throw new Error("No data");
        surahCache[cacheKey] = d.data;
        setData(d.data);
      })
      .catch(() => setError("Could not load Surah. Please check your connection."))
      .finally(() => setLoading(false));
  }, [surahNumber, translation]);

  if (loading) return <Loader/>;
  if (error)   return <div style={{ color: "#e07b54", textAlign: "center", padding: "40px 20px", fontSize: "14px" }}>{error}</div>;
  if (!data)   return null;

  const arabic = data[0];
  const trans  = data[1];
  const meta   = arabic;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Surah header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(201,168,76,0.1)", background: "rgba(8,21,16,0.8)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#c9a84c", cursor: "pointer", padding: "4px" }}><BackIcon/></button>
          <div>
            <div style={{ color: "#c9a84c", fontSize: "16px", fontWeight: 700 }}>{meta.englishName} · {meta.name}</div>
            <div style={{ color: "rgba(201,168,76,0.5)", fontSize: "12px" }}>{meta.englishNameTranslation} · {meta.numberOfAyahs} Ayahs · {meta.revelationType}</div>
          </div>
        </div>
        {surahNumber !== 9 && (
          <div style={{ textAlign: "center", color: "#c9a84c", fontSize: "18px", fontFamily: "Georgia,serif", marginTop: "8px", letterSpacing: "1px" }}>
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </div>
        )}
      </div>

      {/* Ayahs */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {arabic.ayahs.map((ayah, i) => (
          <div key={ayah.number} style={{ marginBottom: "20px", padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#c9a84c", fontSize: "11px", fontWeight: 700 }}>{ayah.numberInSurah}</span>
              </div>
              <span style={{ color: "rgba(201,168,76,0.3)", fontSize: "11px" }}>{meta.number}:{ayah.numberInSurah}</span>
            </div>
            <div style={{ color: "#c9a84c", fontSize: "20px", fontFamily: "Georgia,serif", textAlign: "right", lineHeight: 2.2, marginBottom: "12px", direction: "rtl" }}>
              {ayah.text}
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", lineHeight: 1.8, borderTop: "1px solid rgba(201,168,76,0.08)", paddingTop: "10px" }}>
              {trans.ayahs[i]?.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────
function SearchResults({ query, translation, onSurahSelect, onBack }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const lang = QURAN_TRANSLATIONS.find(t => t.code === translation)?.lang || "en";
  const cacheKey = `${query}-${lang}`;

  useEffect(() => {
    if (!query.trim()) return;
    if (searchCache[cacheKey]) { setResults(searchCache[cacheKey]); setLoading(false); return; }
    setLoading(true);
    fetch(`${BASE}/search/${encodeURIComponent(query.trim())}/all/${lang}`)
      .then(r => r.json())
      .then(d => {
        const items = d.data?.matches || [];
        searchCache[cacheKey] = items;
        setResults(items);
      })
      .catch(() => setError("Search failed. Please try again."))
      .finally(() => setLoading(false));
  }, [query, lang]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(201,168,76,0.1)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#c9a84c", cursor: "pointer" }}><BackIcon/></button>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
          {loading ? "Searching…" : `${results.length} results for "${query}"`}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {loading && <Loader/>}
        {error && <div style={{ color: "#e07b54", textAlign: "center", padding: "40px", fontSize: "14px" }}>{error}</div>}
        {!loading && results.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px", fontSize: "14px" }}>No results found for "{query}"</div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{ marginBottom: "12px", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: "12px" }}>
            <button onClick={() => onSurahSelect(r.surah.number)}
              style={{ background: "none", border: "none", color: "#c9a84c", fontSize: "12px", fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "Nunito,sans-serif", marginBottom: "8px", display: "block" }}>
              {r.surah.englishName} {r.surah.number}:{r.numberInSurah} →
            </button>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.8 }}>{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main QuranTab ────────────────────────────────────────────────────────────
export default function QuranTab({ initialSurah }) {
  const [view,        setView]        = useState("list"); // list | surah | search
  const [selectedSurah, setSelectedSurah] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [translation, setTranslation] = useState("en.sahih");
  const searchRef = useRef(null);

  useEffect(() => {
    if (initialSurah) { setSelectedSurah(initialSurah); setView("surah"); }
  }, [initialSurah]);

  const doSearch = () => {
    if (!searchQuery.trim()) return;
    setActiveQuery(searchQuery.trim());
    setView("search");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Tab toolbar */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(201,168,76,0.1)", background: "rgba(8,21,16,0.9)", flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }}>
        {view !== "list" && (
          <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "#c9a84c", cursor: "pointer", padding: "4px", flexShrink: 0 }}><BackIcon/></button>
        )}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.18)", borderRadius: "10px", padding: "7px 12px" }}>
          <SearchIcon/>
          <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Search by keyword, e.g. 'water', 'patience'…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(255,255,240,0.88)", fontSize: "13px", fontFamily: "Nunito,sans-serif" }}/>
          {searchQuery && (
            <button onClick={doSearch} style={{ background: "rgba(201,168,76,0.15)", border: "none", borderRadius: "6px", padding: "3px 10px", color: "#c9a84c", fontSize: "12px", cursor: "pointer", fontFamily: "Nunito,sans-serif", fontWeight: 600 }}>Go</button>
          )}
        </div>
        <select value={translation} onChange={e => setTranslation(e.target.value)}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "8px", color: "#c9a84c", padding: "6px 8px", fontSize: "12px", outline: "none", fontFamily: "Nunito,sans-serif", cursor: "pointer", flexShrink: 0 }}>
          {QURAN_TRANSLATIONS.map(t => <option key={t.code} value={t.code} style={{ background: "#0d1f14" }}>{t.label}</option>)}
        </select>
      </div>

      {/* View */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {view === "list" && (
          <SurahList onSelect={n => { setSelectedSurah(n); setView("surah"); }}/>
        )}
        {view === "surah" && (
          <SurahReader surahNumber={selectedSurah} translation={translation} onBack={() => setView("list")}/>
        )}
        {view === "search" && (
          <SearchResults query={activeQuery} translation={translation} onSurahSelect={n => { setSelectedSurah(n); setView("surah"); }} onBack={() => setView("list")}/>
        )}
      </div>

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
