import { useState, useEffect, useRef } from "react";
import { HADITH_COLLECTIONS, hadithUrl, isBookmarked } from "./utils.js";

const hadithCache = {};

const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;
const BackIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;

function Loader({ label }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"50px 20px", gap:"14px" }}>
      <div style={{ display:"flex", gap:"6px" }}>
        {[0,1,2].map(d => <div key={d} style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#c9a84c", animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
      </div>
      {label && <div style={{ color:"rgba(201,168,76,0.45)", fontSize:"12px", letterSpacing:"1px" }}>{label}</div>}
    </div>
  );
}

async function fetchCollection(id) {
  if (hadithCache[id]) return hadithCache[id];
  const res  = await fetch(hadithUrl(id));
  const data = await res.json();
  hadithCache[id] = data.hadiths || [];
  return hadithCache[id];
}

// ─── Hadith Result Card ───────────────────────────────────────────────────────
function HadithCard({ h, i, expanded, setExpanded, bookmarks, onToggleBookmark, unlocked, navigateTo, gold, goldDim, goldBdr, cardBg, cardHdr, textClr, isTarget, targetRef }) {
  const bmId   = `hadith-${h.collectionId}-${h.hadithnumber}`;
  const bmItem = { id:bmId, type:"hadith", title:`${h.collectionLabel} · #${h.hadithnumber}`, text:h.text };
  const saved  = isBookmarked(bmId, bookmarks);

  return (
    <div ref={isTarget ? targetRef : null}
      style={{ marginBottom:"10px", background:isTarget ? `${gold}15` : cardBg, border:`1px solid ${isTarget ? gold : goldBdr}`, borderRadius:"12px", overflow:"hidden", transition:"all 0.3s" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", borderBottom:`1px solid ${goldBdr}`, background:cardHdr }}>
        <span style={{ color:gold, fontSize:"12px", fontWeight:700 }}>{h.collectionLabel} · #{h.hadithnumber}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
          <button
            onClick={() => { if (!unlocked) { navigateTo("getpro"); return; } onToggleBookmark(bmItem); }}
            style={{ background:"none", border:"none", fontSize:"15px", cursor:"pointer", lineHeight:1, padding:"2px 6px", opacity: saved ? 1 : 0.35, transition:"opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = saved ? "1" : "0.35"}>
            🔖
          </button>
          <button onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ background:"none", border:"none", color:goldDim, fontSize:"18px", cursor:"pointer", lineHeight:1 }}>
            {expanded === i ? "−" : "+"}
          </button>
        </div>
      </div>
      <div style={{ padding:"12px 14px", color:textClr, fontSize:"13px", lineHeight:1.85 }}>
        {expanded === i || h.text.length <= 200 ? h.text : `${h.text.slice(0, 200)}…`}
        {h.text.length > 200 && expanded !== i && (
          <button onClick={() => setExpanded(i)} style={{ background:"none", border:"none", color:gold, fontSize:"12px", cursor:"pointer", padding:"0 0 0 6px", fontFamily:"Nunito,sans-serif" }}>Read more</button>
        )}
      </div>
    </div>
  );
}

export default function HadithTab({ initialTopic, initialNav, bookmarks = [], onToggleBookmark, unlocked, navigateTo, lightMode, textSize = 1 }) {
  const [view,         setView]         = useState("books");
  const [activeBook,   setActiveBook]   = useState(null);
  const [bookHadiths,  setBookHadiths]  = useState([]);
  const [loadingBook,  setLoadingBook]  = useState(false);
  const [targetHadith, setTargetHadith] = useState(null);
  const [searchQuery,  setSearchQuery]  = useState(initialTopic || "");
  const [activeQuery,  setActiveQuery]  = useState("");
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error,        setError]        = useState(null);
  const [expanded,     setExpanded]     = useState(null);
  const [page,         setPage]         = useState(1);
  const targetRef = useRef(null);
  const PER_PAGE = 20;

  // Auto-open book + navigate to specific hadith when citation tapped
  useEffect(() => {
    if (!initialNav?.collectionId) return;
    const coll = HADITH_COLLECTIONS.find(c => c.id === initialNav.collectionId);
    if (coll) openBook(coll, initialNav.number);
  }, [initialNav]);

  // Scroll to target hadith once loaded
  useEffect(() => {
    if (targetRef.current) {
      setTimeout(() => targetRef.current?.scrollIntoView({ behavior:"smooth", block:"center" }), 150);
    }
  }, [bookHadiths, targetHadith]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const gold      = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim   = lightMode ? "rgba(122,88,16,0.5)"   : "rgba(201,168,76,0.45)";
  const goldBdr   = lightMode ? "rgba(122,88,16,0.2)"   : "rgba(201,168,76,0.2)";
  const goldFnt   = lightMode ? "rgba(122,88,16,0.18)"  : "rgba(201,168,76,0.18)";
  const cardBg    = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.03)";
  const cardBdr   = lightMode ? "rgba(122,88,16,0.12)"  : "rgba(201,168,76,0.1)";
  const cardHdr   = lightMode ? "rgba(122,88,16,0.05)"  : "rgba(201,168,76,0.04)";
  const textClr   = lightMode ? "rgba(26,15,0,0.72)"    : "rgba(255,255,255,0.72)";
  const textDim   = lightMode ? "rgba(26,15,0,0.35)"    : "rgba(255,255,255,0.35)";
  const headerBg  = lightMode ? "rgba(253,248,237,0.97)": "rgba(8,21,16,0.9)";
  const inputBg   = lightMode ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.04)";

  const openBook = async (coll, targetNumber = null) => {
    setActiveBook(coll);
    setView("reader");
    setLoadingBook(true);
    setExpanded(null);
    setTargetHadith(targetNumber);
    try {
      const hadiths  = await fetchCollection(coll.id);
      const withMeta = hadiths.map(h => ({ ...h, collectionId: coll.id, collectionLabel: coll.label }));
      setBookHadiths(withMeta);
      if (targetNumber) {
        // Jump to the page containing this hadith number
        const idx = withMeta.findIndex(h => h.hadithnumber === targetNumber);
        if (idx >= 0) setPage(Math.ceil((idx + 1) / PER_PAGE));
        else setPage(1);
      } else {
        setPage(1);
      }
    } catch { setBookHadiths([]); }
    finally { setLoadingBook(false); }
  };

  const doSearch = async (q = searchQuery) => {
    const query = q.trim();
    if (!query) return;
    setActiveQuery(query);
    setResults([]);
    setLoading(true);
    setError(null);
    setExpanded(null);
    setPage(1);
    setView("search");
    try {
      let all = [];
      for (const c of HADITH_COLLECTIONS) {
        setLoadingLabel(`Searching ${c.label}…`);
        const hadiths = await fetchCollection(c.id);
        const q2 = query.toLowerCase();
        const found = hadiths.filter(h => h.text?.toLowerCase().includes(q2)).slice(0, 40)
          .map(h => ({ ...h, collectionId: c.id, collectionLabel: c.label }));
        all = [...all, ...found];
        setResults([...all]);
      }
      if (all.length === 0) setError(`No hadiths found for "${query}".`);
    } catch { setError("Failed to load. Check your connection."); }
    finally { setLoading(false); setLoadingLabel(""); }
  };

  const paged    = (view === "reader" ? bookHadiths : results).slice(0, page * PER_PAGE);
  const total    = (view === "reader" ? bookHadiths : results).length;
  const hasMore  = total > paged.length;

  const cardProps = { bookmarks, onToggleBookmark, unlocked, navigateTo, gold, goldDim, goldBdr, cardBg, cardHdr, textClr, targetRef };

  // ── SEARCH BAR (always at top) ─────────────────────────────────────────────
  const SearchBar = () => (
    <div style={{ padding:"10px 16px", borderBottom:`1px solid ${cardBdr}`, background:headerBg, flexShrink:0 }}>
      <div style={{ display:"flex", gap:"8px" }}>
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:"8px", background:inputBg, border:`1px solid ${goldFnt}`, borderRadius:"10px", padding:"8px 12px" }}>
          <SearchIcon/>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && doSearch()}
            placeholder="Search across all collections…"
            style={{ flex:1, background:"none", border:"none", outline:"none", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif" }}/>
        </div>
        <button onClick={() => doSearch()} disabled={!searchQuery.trim() || loading}
          style={{ padding:"8px 14px", borderRadius:"10px",
            background: searchQuery.trim() && !loading ? `linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})` : "transparent",
            border:`1px solid ${goldBdr}`,
            color: searchQuery.trim() && !loading ? (lightMode?"#fff":"#0d1f14") : goldDim,
            fontSize:`${13 * textSize}px`, fontWeight:700, cursor: searchQuery.trim() && !loading ? "pointer" : "not-allowed", fontFamily:"Nunito,sans-serif", flexShrink:0 }}>
          Search
        </button>
      </div>
    </div>
  );

  // ── BOOK LIST VIEW ─────────────────────────────────────────────────────────
  if (view === "books") {
    return (
      <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
        <SearchBar/>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px 20px" }}>
          <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>Collections</div>
          {HADITH_COLLECTIONS.map(coll => (
            <button key={coll.id} onClick={() => openBook(coll)}
              style={{ display:"flex", alignItems:"center", gap:"14px", width:"100%", padding:"14px 16px", marginBottom:"8px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"14px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = lightMode?"rgba(122,88,16,0.08)":"rgba(201,168,76,0.07)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = cardBg; }}>
              <div style={{ width:"42px", height:"42px", borderRadius:"12px", background:lightMode?"rgba(122,88,16,0.1)":"rgba(201,168,76,0.1)", border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"20px" }}>
                📜
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:textClr, fontSize:`${14 * textSize}px`, fontWeight:700 }}>{coll.label}</div>
                <div style={{ color:gold, fontSize:`${12 * textSize}px`, fontFamily:"Georgia,serif", marginTop:"2px" }}>{coll.arabic}</div>
                <div style={{ color:textDim, fontSize:`${11 * textSize}px`, marginTop:"2px" }}>{coll.hadiths?.toLocaleString()} hadiths</div>
              </div>
              <div style={{ color:goldDim, fontSize:"20px" }}>›</div>
            </button>
          ))}
        </div>
        <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  // ── BOOK READER VIEW ───────────────────────────────────────────────────────
  if (view === "reader") {
    return (
      <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
        <SearchBar/>
        <div style={{ padding:"10px 16px", borderBottom:`1px solid ${cardBdr}`, background:headerBg, flexShrink:0, display:"flex", alignItems:"center", gap:"10px" }}>
          <button onClick={() => setView("books")} style={{ background:"none", border:"none", color:gold, cursor:"pointer", padding:"2px" }}><BackIcon/></button>
          <div>
            <div style={{ color:gold, fontSize:`${14 * textSize}px`, fontWeight:700 }}>{activeBook?.label}</div>
            <div style={{ color:goldDim, fontSize:"11px" }}>{total} hadiths</div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px 20px" }}>
          {loadingBook ? <Loader label={`Loading ${activeBook?.label}…`}/> : (
            <>
              {paged.map((h, i) => <HadithCard key={i} h={h} i={i} expanded={expanded} setExpanded={setExpanded} isTarget={targetHadith && h.hadithnumber === targetHadith} {...cardProps}/>)}
              {hasMore && (
                <button onClick={() => setPage(p => p + 1)}
                  style={{ width:"100%", padding:"12px", borderRadius:"10px", background:lightMode?"rgba(122,88,16,0.07)":"rgba(201,168,76,0.07)", border:`1px solid ${goldBdr}`, color:goldDim, fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif", marginTop:"6px" }}>
                  Load more ({total - paged.length} remaining)
                </button>
              )}
            </>
          )}
        </div>
        <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  // ── SEARCH RESULTS VIEW ────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
      <SearchBar/>
      <div style={{ padding:"8px 16px", borderBottom:`1px solid ${cardBdr}`, background:headerBg, flexShrink:0, display:"flex", alignItems:"center", gap:"10px" }}>
        <button onClick={() => setView("books")} style={{ background:"none", border:"none", color:gold, cursor:"pointer" }}><BackIcon/></button>
        <span style={{ color:textDim, fontSize:`${13 * textSize}px` }}>
          {loading ? `Searching… ${results.length} found` : `${results.length} results for "${activeQuery}"`}
        </span>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px 20px" }}>
        {loading && <Loader label={loadingLabel}/>}
        {!loading && error && <div style={{ textAlign:"center", color:textDim, padding:"40px 20px", fontSize:`${14 * textSize}px` }}>{error}</div>}
        {paged.map((h, i) => <HadithCard key={i} h={h} i={i} expanded={expanded} setExpanded={setExpanded} isTarget={false} {...cardProps}/>)}
        {hasMore && !loading && (
          <button onClick={() => setPage(p => p + 1)}
            style={{ width:"100%", padding:"12px", borderRadius:"10px", background:lightMode?"rgba(122,88,16,0.07)":"rgba(201,168,76,0.07)", border:`1px solid ${goldBdr}`, color:goldDim, fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
            Load more ({total - paged.length} remaining)
          </button>
        )}
      </div>
      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
