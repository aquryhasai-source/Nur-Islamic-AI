import { useState, useEffect, useRef } from "react";
import { QURAN_TRANSLATIONS, isBookmarked } from "./utils.js";

const BASE = "https://api.alquran.cloud/v1";
const surahCache  = {};
const searchCache = {};

const BackIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;

function Loader() {
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:"60px 20px", gap:"6px" }}>
      {[0,1,2].map(d => <div key={d} style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#c9a84c", animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
    </div>
  );
}

// ─── Surah List ───────────────────────────────────────────────────────────────
function SurahList({ onSelect, lightMode, textSize }) {
  const [surahs,  setSurahs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");

  const gold    = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim = lightMode ? "rgba(122,88,16,0.5)"  : "rgba(201,168,76,0.5)";
  const goldBdr = lightMode ? "rgba(122,88,16,0.2)"  : "rgba(201,168,76,0.2)";
  const cardBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.03)";
  const cardBdr = lightMode ? "rgba(122,88,16,0.12)" : "rgba(201,168,76,0.1)";
  const textClr = lightMode ? "rgba(26,15,0,0.88)"   : "rgba(255,255,240,0.88)";
  const inputBg = lightMode ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.04)";

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
            style={{ flex:1, background:"none", border:"none", outline:"none", color:textClr, fontSize:`${14 * textSize}px`, fontFamily:"Nunito,sans-serif" }}/>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"8px 16px 16px" }}>
        {loading ? <Loader/> : filtered.map(s => (
          <button key={s.number} onClick={() => onSelect(s.number)}
            style={{ display:"flex", alignItems:"center", gap:"14px", width:"100%", padding:"11px 14px", marginBottom:"6px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"12px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = lightMode?"rgba(122,88,16,0.08)":"rgba(201,168,76,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = cardBg}>
            <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:lightMode?"rgba(122,88,16,0.1)":"rgba(201,168,76,0.1)", border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ color:gold, fontSize:"11px", fontWeight:700 }}>{s.number}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:textClr, fontSize:`${14 * textSize}px`, fontWeight:600 }}>{s.englishName}</div>
              <div style={{ color:goldDim, fontSize:`${11 * textSize}px`, marginTop:"2px" }}>{s.englishNameTranslation} · {s.numberOfAyahs} ayahs · {s.revelationType}</div>
            </div>
            <div style={{ color:gold, fontSize:"17px", fontFamily:"Georgia,serif", opacity:0.8 }}>{s.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Surah Reader ─────────────────────────────────────────────────────────────
function SurahReader({ surahNumber, translation, onBack, bookmarks, onToggleBookmark, unlocked, navigateTo, lightMode, textSize }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.5)"  : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"  : "rgba(201,168,76,0.1)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.03)";
  const textClr  = lightMode ? "rgba(26,15,0,0.65)"   : "rgba(255,255,255,0.65)";
  const headerBg = lightMode ? "rgba(253,248,237,0.9)" : "rgba(8,21,16,0.8)";

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

  if (loading) return <Loader/>;
  if (error)   return <div style={{ color:"#e07b54", textAlign:"center", padding:"40px 20px", fontSize:`${14 * textSize}px` }}>{error}</div>;
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
            <div style={{ color:gold, fontSize:`${15 * textSize}px`, fontWeight:700 }}>{meta.englishName} · {meta.name}</div>
            <div style={{ color:goldDim, fontSize:`${11 * textSize}px` }}>{meta.englishNameTranslation} · {meta.numberOfAyahs} Ayahs · {meta.revelationType}</div>
          </div>
        </div>
        {surahNumber !== 9 && (
          <div style={{ textAlign:"center", color:gold, fontSize:`${17 * textSize}px`, fontFamily:"Georgia,serif", marginTop:"6px", letterSpacing:"1px" }}>
            بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
          </div>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
        {arabic.ayahs.map((ayah, i) => {
          const bmId   = `quran-${meta.number}-${ayah.numberInSurah}`;
          const bmItem = {
            id: bmId, type:"quran",
            title: `${meta.englishName} ${meta.number}:${ayah.numberInSurah}`,
            arabic: ayah.text,
            text: trans.ayahs[i]?.text || "",
          };
          const saved = isBookmarked(bmId, bookmarks);

          return (
            <div key={ayah.number} style={{ marginBottom:"18px", padding:"14px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ width:"26px", height:"26px", borderRadius:"50%", background:lightMode?"rgba(122,88,16,0.1)":"rgba(201,168,76,0.1)", border:`1px solid ${lightMode?"rgba(122,88,16,0.25)":"rgba(201,168,76,0.25)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ color:gold, fontSize:"11px", fontWeight:700 }}>{ayah.numberInSurah}</span>
                  </div>
                  <span style={{ color:goldDim, fontSize:`${11 * textSize}px` }}>{meta.number}:{ayah.numberInSurah}</span>
                </div>
                {/* Bookmark — pro gated */}
                <button
                  onClick={() => {
                    if (!unlocked) { navigateTo("getpro"); return; }
                    onToggleBookmark(bmItem);
                  }}
                  title={unlocked ? (saved ? "Remove bookmark" : "Bookmark this ayah") : "Pro feature — tap to unlock"}
                  style={{ background:"none", border:"none", fontSize:"16px", cursor:"pointer", padding:"2px 6px", lineHeight:1, opacity: saved ? 1 : 0.4, transition:"opacity 0.2s", position:"relative" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = saved ? "1" : "0.4"}>
                  🔖{!unlocked && <span style={{ position:"absolute", top:"-2px", right:"0px", fontSize:"8px", color:gold }}>★</span>}
                </button>
              </div>
              <div style={{ color:gold, fontSize:`${20 * textSize}px`, fontFamily:"Georgia,serif", textAlign:"right", lineHeight:2.2, marginBottom:"10px", direction:"rtl" }}>
                {ayah.text}
              </div>
              <div style={{ color:textClr, fontSize:`${13 * textSize}px`, lineHeight:1.8, borderTop:`1px solid ${goldBdr}`, paddingTop:"8px" }}>
                {trans.ayahs[i]?.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────
function SearchResults({ query, translation, onSurahSelect, onBack, lightMode, textSize }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const gold    = lightMode ? "#7a5810" : "#c9a84c";
  const cardBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.03)";
  const cardBdr = lightMode ? "rgba(122,88,16,0.12)"   : "rgba(201,168,76,0.1)";
  const textClr = lightMode ? "rgba(26,15,0,0.7)"      : "rgba(255,255,255,0.7)";

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
        {error && <div style={{ color:"#e07b54", textAlign:"center", padding:"40px", fontSize:`${14 * textSize}px` }}>{error}</div>}
        {!loading && results.length === 0 && !error && (
          <div style={{ textAlign:"center", color:textClr, padding:"40px", fontSize:`${14 * textSize}px`, opacity:0.5 }}>No results for "{query}"</div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{ marginBottom:"12px", padding:"14px 16px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"12px" }}>
            <button onClick={() => onSurahSelect(r.surah.number)}
              style={{ background:"none", border:"none", color:gold, fontSize:`${12 * textSize}px`, fontWeight:700, cursor:"pointer", padding:0, fontFamily:"Nunito,sans-serif", marginBottom:"8px", display:"block" }}>
              {r.surah.englishName} {r.surah.number}:{r.numberInSurah} →
            </button>
            <div style={{ color:textClr, fontSize:`${13 * textSize}px`, lineHeight:1.8 }}>{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main QuranTab ────────────────────────────────────────────────────────────
export default function QuranTab({ initialSurah, bookmarks = [], onToggleBookmark, unlocked, navigateTo, lightMode, textSize = 1 }) {
  const [view,          setView]          = useState("list");
  const [selectedSurah, setSelectedSurah] = useState(null);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [activeQuery,   setActiveQuery]   = useState("");
  const [translation,   setTranslation]   = useState("en.sahih");

  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.18)" : "rgba(201,168,76,0.18)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.04)";
  const textClr  = lightMode ? "rgba(26,15,0,0.88)"   : "rgba(255,255,240,0.88)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.9)";
  const barBdr   = lightMode ? "rgba(122,88,16,0.12)" : "rgba(201,168,76,0.1)";

  useEffect(() => {
    if (initialSurah) { setSelectedSurah(initialSurah); setView("surah"); }
  }, [initialSurah]);

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
            style={{ flex:1, background:"none", border:"none", outline:"none", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif" }}/>
          {searchQuery && (
            <button onClick={doSearch} style={{ background:lightMode?"rgba(122,88,16,0.15)":"rgba(201,168,76,0.15)", border:"none", borderRadius:"6px", padding:"3px 10px", color:gold, fontSize:"12px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:600 }}>Go</button>
          )}
        </div>
        <select value={translation} onChange={e => setTranslation(e.target.value)}
          style={{ background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"8px", color:gold, padding:"6px 8px", fontSize:"12px", outline:"none", fontFamily:"Nunito,sans-serif", cursor:"pointer", flexShrink:0 }}>
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

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
