import { useState, useEffect, useRef } from "react";
import { QURAN_TRANSLATIONS, isBookmarked } from "./utils.js";
import ReadingOptions from "./ReadingOptions.jsx";
import { Icon } from "./Icons.jsx";

const BASE = "https://api.alquran.cloud/v1";
const surahCache  = {};
const searchCache = {};

const BackIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;

function Loader() {
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:"60px 20px", gap:"6px" }}>
      {[0,1,2].map(d => <div key={d} style={{ width:"8px", height:"8px", borderRadius:"50%", background:"var(--gold)", animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
    </div>
  );
}

// ─── Surah List ───────────────────────────────────────────────────────────────
function SurahList({ onSelect, lightMode, textSize }) {
  const [surahs,  setSurahs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");

  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const cardBg = "var(--panel)";
  const cardBdr = "var(--lineSoft)";
  const textClr = "var(--text)";
  const inputBg = "var(--panel2)";

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
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${cardBdr}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"12px", padding:"9px 14px" }}>
          <SearchIcon/>
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search Surah by name or number…"
            style={{ flex:1, background:"none", border:"none", outline:"none", color:textClr, fontSize:`${14 * textSize}px`, fontFamily:"inherit" }}/>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"8px 16px 16px" }}>
        {loading ? <Loader/> : filtered.map(s => (
          <button key={s.number} onClick={() => onSelect(s.number)}
            style={{ display:"flex", alignItems:"center", gap:"14px", width:"100%", padding:"11px 14px", marginBottom:"6px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"12px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--chip)"}
            onMouseLeave={e => e.currentTarget.style.background = cardBg}>
            <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"var(--chip)", border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ color:gold, fontSize:"calc(11px * var(--ts, 1))", fontWeight:700 }}>{s.number}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:textClr, fontSize:`${14 * textSize}px`, fontWeight:600 }}>{s.englishName}</div>
              <div style={{ color:goldDim, fontSize:`${11 * textSize}px`, marginTop:"2px" }}>{s.englishNameTranslation} · {s.numberOfAyahs} ayahs · {s.revelationType}</div>
            </div>
            <div style={{ color:gold, fontSize:"calc(17px * var(--ts, 1))", fontFamily:"var(--font-ar)", opacity:0.8 }}>{s.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Surah Reader ─────────────────────────────────────────────────────────────
function SurahReader({ surahNumber, translation, onBack, initialAyah, bookmarks, onToggleBookmark, unlocked, navigateTo, lightMode, textSize }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const targetAyahRef         = useRef(null);

  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const cardBg = "var(--panel)";
  const textClr = "var(--text)";
  const headerBg = "var(--head)";

  const cacheKey = `${surahNumber}-${translation}`;

  useEffect(() => {
    setLoading(true); setError(null);
    if (surahCache[cacheKey]) { setData(surahCache[cacheKey]); setLoading(false); return; }
    fetch(`${BASE}/surah/${surahNumber}/editions/quran-uthmani,${translation}`)
      .then(r => r.json())
      .then(d => { if (!d.data) throw new Error(); surahCache[cacheKey] = d.data; setData(d.data); })
      .catch(() => setError("Could not load Surah. Please check your connection."))
      .finally(() => setLoading(false));
  }, [surahNumber, translation]);

  useEffect(() => {
    if (!loading && data && initialAyah && targetAyahRef.current) {
      setTimeout(() => targetAyahRef.current?.scrollIntoView({ behavior:"smooth", block:"center" }), 200);
    }
  }, [loading, data, initialAyah]);

  if (loading) return <Loader/>;
  if (error)   return <div style={{ color:"var(--warn)", textAlign:"center", padding:"40px 20px", fontSize:`${14 * textSize}px` }}>{error}</div>;
  if (!data)   return null;

  const arabic = data[0];
  const trans  = data[1];
  const meta   = arabic;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"4px" }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:gold, cursor:"pointer", padding:"4px" }}><BackIcon/></button>
          <div>
            <div style={{ color:gold, fontFamily:"var(--font-head)", fontSize:`${17.5 * textSize}px`, fontWeight:700 }}>{meta.englishName} · <span style={{ fontFamily:"var(--font-ar)" }}>{meta.name}</span></div>
            <div style={{ color:goldDim, fontSize:`${11 * textSize}px` }}>{meta.englishNameTranslation} · {meta.numberOfAyahs} Ayahs · {meta.revelationType}</div>
          </div>
        </div>
        {surahNumber !== 9 && (
          <div style={{ textAlign:"center", color:gold, fontSize:`${17 * textSize}px`, fontFamily:"var(--font-ar)", marginTop:"6px", letterSpacing:"1px" }}>
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </div>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
        <div className="rd-wrap">
        {arabic.ayahs.map((ayah, i) => {
          const bmId   = `quran-${meta.number}-${ayah.numberInSurah}`;
          const bmItem = {
            id: bmId, type:"quran",
            title: `${meta.englishName} ${meta.number}:${ayah.numberInSurah}`,
            arabic: ayah.text,
            text: trans.ayahs[i]?.text || "",
          };
          const saved = isBookmarked(bmId, bookmarks);

          const isTarget = initialAyah && ayah.numberInSurah === initialAyah;

          return (
            <div key={ayah.number}
              ref={isTarget ? targetAyahRef : null}
              className="rd-card"
              style={{ marginBottom:"18px", padding:"14px", background: isTarget ? `color-mix(in srgb,${gold} 9%,transparent)` : cardBg, border:`1px solid ${isTarget ? gold : goldBdr}`, borderRadius:"14px", transition:"all 0.3s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div className="rd-num" style={{ width:"26px", height:"26px", borderRadius:"50%", background:"var(--chip)", border:`1px solid ${"var(--line)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ color:gold, fontSize:"calc(11px * var(--ts, 1))", fontWeight:700 }}>{ayah.numberInSurah}</span>
                  </div>
                  <span className="rd-num" style={{ color:goldDim, fontSize:`${11 * textSize}px` }}>{meta.number}:{ayah.numberInSurah}</span>
                </div>
                <button
                  onClick={() => onToggleBookmark(bmItem)}
                  title={saved ? "Remove bookmark" : "Bookmark this ayah"}
                  style={{ background:"none", border:"none", fontSize:"calc(16px * var(--ts, 1))", cursor:"pointer", padding:"2px 6px", lineHeight:1, opacity: saved ? 1 : 0.4, transition:"opacity 0.2s", position:"relative" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = saved ? "1" : "0.4"}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color:"var(--gold)" }}><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z"/></svg>
                </button>
              </div>
              <div className="rd-ar" lang="ar" style={{ textAlign:"right", marginBottom:"10px", direction:"rtl" }}>
                {ayah.text}
              </div>
              <div className="rd-tr" style={{ color:textClr, borderTop:`1px solid ${goldBdr}`, paddingTop:"8px" }}>
                {trans.ayahs[i]?.text}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────
function SearchResults({ query, translation, onSurahSelect, onBack, lightMode, textSize }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const gold = "var(--gold)";
  const cardBg = "var(--panel)";
  const cardBdr = "var(--lineSoft)";
  const textClr = "var(--text)";

  const lang     = QURAN_TRANSLATIONS.find(t => t.code === translation)?.lang || "en";
  const cacheKey = `${query}-${lang}`;

  useEffect(() => {
    if (!query.trim()) return;
    if (searchCache[cacheKey]) { setResults(searchCache[cacheKey]); setLoading(false); return; }
    setLoading(true);
    fetch(`${BASE}/search/${encodeURIComponent(query.trim())}/all/${lang}`)
      .then(r => r.json())
      .then(d => { const items = d.data?.matches || []; searchCache[cacheKey] = items; setResults(items); })
      .catch(() => setError("Search failed. Please try again."))
      .finally(() => setLoading(false));
  }, [query, lang]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${cardBdr}`, display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, cursor:"pointer" }}><BackIcon/></button>
        <span style={{ color:textClr, fontSize:`${14 * textSize}px` }}>
          {loading ? "Searching…" : `${results.length} results for "${query}"`}
        </span>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
        {loading && <Loader/>}
        {error && <div style={{ color:"var(--warn)", textAlign:"center", padding:"40px", fontSize:`${14 * textSize}px` }}>{error}</div>}
        {!loading && results.length === 0 && !error && (
          <div style={{ textAlign:"center", color:textClr, padding:"40px", fontSize:`${14 * textSize}px`, opacity:0.5 }}>No results for "{query}"</div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{ marginBottom:"12px", padding:"14px 16px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"12px" }}>
            <button onClick={() => onSurahSelect(r.surah.number)}
              style={{ background:"none", border:"none", color:gold, fontSize:`${12 * textSize}px`, fontWeight:700, cursor:"pointer", padding:0, fontFamily:"inherit", marginBottom:"8px", display:"flex", alignItems:"center", gap:"4px" }}>
              {r.surah.englishName} {r.surah.number}:{r.numberInSurah} <Icon n="forward" size={13}/>
            </button>
            <div style={{ color:textClr, fontSize:`${13 * textSize}px`, lineHeight:1.8 }}>{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main QuranTab ────────────────────────────────────────────────────────────
function QuranTabBody({ initialNav, bookmarks = [], onToggleBookmark, unlocked, navigateTo, lightMode, textSize = 1 }) {
  const [view,          setView]          = useState("list");
  const [selectedSurah, setSelectedSurah] = useState(null);
  const [initialAyah,   setInitialAyah]   = useState(null);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [activeQuery,   setActiveQuery]   = useState("");
  const [translation,   setTranslation]   = useState("en.sahih");

  const gold = "var(--gold)";
  const goldBdr = "var(--line)";
  const inputBg = "var(--panel2)";
  const textClr = "var(--text)";
  const headerBg = "var(--head)";
  const barBdr   = "var(--chip)";

  useEffect(() => {
    if (initialNav?.surah) {
      setSelectedSurah(initialNav.surah);
      setInitialAyah(initialNav.ayah || null);
      setView("surah");
    }
  }, [initialNav]);

  useEffect(() => {
    if (view !== "list") {
      window.history.pushState({ nurQuran: view }, "");
    }
    const handler = () => {
      if (view === "surah" || view === "search") {
        setView("list");
        window.history.pushState({ nurQuran: "list" }, "");
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [view]);

  const doSearch = () => {
    if (!searchQuery.trim()) return;
    setActiveQuery(searchQuery.trim());
    setView("search");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
      {/* Toolbar */}
      <div style={{ padding:"10px 16px", borderBottom:`1px solid ${barBdr}`, background:headerBg, flexShrink:0, display:"flex", gap:"8px", alignItems:"center" }}>
        {view !== "list" && (
          <button onClick={() => setView("list")} style={{ background:"none", border:"none", color:gold, cursor:"pointer", padding:"4px", flexShrink:0 }}><BackIcon/></button>
        )}
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:"8px", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"10px", padding:"7px 12px" }}>
          <SearchIcon/>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && doSearch()}
            placeholder="Search by keyword…"
            style={{ flex:1, background:"none", border:"none", outline:"none", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"inherit" }}/>
          {searchQuery && (
            <button onClick={doSearch} style={{ background:"var(--active)", border:"none", borderRadius:"6px", padding:"3px 10px", color:gold, fontSize:"calc(12px * var(--ts, 1))", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Go</button>
          )}
        </div>
        <select value={translation} onChange={e => setTranslation(e.target.value)}
          style={{ background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"8px", color:gold, padding:"6px 8px", fontSize:"calc(12px * var(--ts, 1))", outline:"none", fontFamily:"inherit", cursor:"pointer", flexShrink:0 }}>
          {QURAN_TRANSLATIONS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
        </select>
      </div>

      <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
        {view === "list" && (
          <SurahList onSelect={n => { setSelectedSurah(n); setView("surah"); }} lightMode={lightMode} textSize={textSize}/>
        )}
        {view === "surah" && (
          <SurahReader
            surahNumber={selectedSurah} translation={translation}
            onBack={() => setView("list")}
            initialAyah={initialAyah}
            bookmarks={bookmarks} onToggleBookmark={onToggleBookmark}
            unlocked={unlocked} navigateTo={navigateTo}
            lightMode={lightMode} textSize={textSize}
          />
        )}
        {view === "search" && (
          <SearchResults
            query={activeQuery} translation={translation}
            onSurahSelect={n => { setSelectedSurah(n); setView("surah"); }}
            onBack={() => setView("list")}
            lightMode={lightMode} textSize={textSize}
          />
        )}
      </div>
    </div>
  );
}

export default function QuranTab(props) {
  return (
    <div style={{ display:"flex", flex:1, minHeight:0 }}>
      <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0, minHeight:0 }}><QuranTabBody {...props}/></div>
      <ReadingOptions/>
    </div>
  );
}
