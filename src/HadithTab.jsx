import { useState, useRef } from "react";
import { HADITH_COLLECTIONS, hadithUrl } from "./utils.js";

// Module-level cache — persists across tab switches
const hadithCache = {};

const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;

function Loader({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px", gap: "14px" }}>
      <div style={{ display: "flex", gap: "6px" }}>
        {[0, 1, 2].map(d => <div key={d} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c9a84c", animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${d * 0.2}s`, opacity: 0.7 }}/>)}
      </div>
      {label && <div style={{ color: "rgba(201,168,76,0.45)", fontSize: "12px", letterSpacing: "1px" }}>{label}</div>}
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

function searchCollection(hadiths, query, coll) {
  const q = query.toLowerCase();
  return hadiths
    .filter(h => h.text && h.text.toLowerCase().includes(q))
    .slice(0, 40)
    .map(h => ({ ...h, collectionId: coll.id, collectionLabel: coll.label }));
}

export default function HadithTab({ initialTopic }) {
  const [searchQuery,   setSearchQuery]   = useState(initialTopic || "");
  const [activeQuery,   setActiveQuery]   = useState("");
  const [results,       setResults]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [loadingLabel,  setLoadingLabel]  = useState("");
  const [searched,      setSearched]      = useState(false);
  const [error,         setError]         = useState(null);
  const [selectedColl,  setSelectedColl]  = useState("all");
  const [expanded,      setExpanded]      = useState(null);
  const [page,          setPage]          = useState(1);
  const PER_PAGE = 20;

  const doSearch = async (q = searchQuery, coll = selectedColl) => {
    const query = q.trim();
    if (!query) return;
    setActiveQuery(query);
    setResults([]);
    setLoading(true);
    setSearched(true);
    setError(null);
    setExpanded(null);
    setPage(1);

    try {
      const collections = coll === "all" ? HADITH_COLLECTIONS : HADITH_COLLECTIONS.filter(c => c.id === coll);
      let all = [];

      for (const c of collections) {
        setLoadingLabel(`Searching ${c.label}…`);
        const hadiths = await fetchCollection(c.id);
        const found   = searchCollection(hadiths, query, c);
        all = [...all, ...found];
        setResults([...all]); // Progressive display
      }

      if (all.length === 0) setError(`No hadiths found for "${query}". Try a different keyword.`);
    } catch (err) {
      setError("Failed to load hadith data. Please check your connection.");
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter") doSearch();
  };

  const paged    = results.slice(0, page * PER_PAGE);
  const hasMore  = results.length > paged.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Search bar */}
      <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid rgba(201,168,76,0.1)", background: "rgba(8,21,16,0.9)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.18)", borderRadius: "10px", padding: "8px 12px" }}>
            <SearchIcon/>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search hadiths, e.g. 'intention', 'prayer'…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(255,255,240,0.88)", fontSize: "13px", fontFamily: "Nunito,sans-serif" }}
            />
          </div>
          <button onClick={() => doSearch()} disabled={!searchQuery.trim() || loading}
            style={{ padding: "8px 16px", borderRadius: "10px", background: searchQuery.trim() && !loading ? "linear-gradient(135deg,#c9a84c,#a8862e)" : "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", color: searchQuery.trim() && !loading ? "#0d1f14" : "rgba(201,168,76,0.3)", fontSize: "13px", fontWeight: 700, cursor: searchQuery.trim() && !loading ? "pointer" : "not-allowed", fontFamily: "Nunito,sans-serif", flexShrink: 0 }}>
            Search
          </button>
        </div>

        {/* Collection filter */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
          <button onClick={() => { setSelectedColl("all"); if (searched) doSearch(searchQuery, "all"); }}
            style={{ padding: "5px 14px", borderRadius: "20px", border: "1px solid rgba(201,168,76,0.2)", background: selectedColl === "all" ? "rgba(201,168,76,0.18)" : "transparent", color: selectedColl === "all" ? "#c9a84c" : "rgba(201,168,76,0.45)", fontSize: "12px", cursor: "pointer", fontFamily: "Nunito,sans-serif", flexShrink: 0, transition: "all 0.15s" }}>
            All
          </button>
          {HADITH_COLLECTIONS.map(c => (
            <button key={c.id} onClick={() => { setSelectedColl(c.id); if (searched) doSearch(searchQuery, c.id); }}
              style={{ padding: "5px 14px", borderRadius: "20px", border: "1px solid rgba(201,168,76,0.2)", background: selectedColl === c.id ? "rgba(201,168,76,0.18)" : "transparent", color: selectedColl === c.id ? "#c9a84c" : "rgba(201,168,76,0.45)", fontSize: "12px", cursor: "pointer", fontFamily: "Nunito,sans-serif", flexShrink: 0, transition: "all 0.15s" }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 20px" }}>

        {/* Default / not yet searched */}
        {!searched && !loading && (
          <div style={{ textAlign: "center", paddingTop: "48px" }}>
            <div style={{ fontSize: "28px", color: "#c9a84c", marginBottom: "8px", fontFamily: "Georgia,serif" }}>الْحَدِيث</div>
            <div style={{ color: "rgba(201,168,76,0.4)", fontSize: "11px", letterSpacing: "2px", marginBottom: "32px" }}>Sayings & Traditions of the Prophet ﷺ</div>
            <div style={{ width: "40px", height: "1px", background: "linear-gradient(90deg,transparent,#c9a84c,transparent)", margin: "0 auto 28px" }}/>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", lineHeight: 1.9, maxWidth: "320px", margin: "0 auto 28px" }}>
              Search across Sahih Bukhari, Sahih Muslim, Abu Dawud, Tirmidhi, Nasai, and Ibn Majah. Results include full citation.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {["Intention","Prayer","Fasting","Charity","Patience","Kindness","Honesty","Gratitude"].map(t => (
                <button key={t} onClick={() => { setSearchQuery(t); doSearch(t, selectedColl); }}
                  style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "20px", padding: "7px 16px", color: "rgba(201,168,76,0.7)", fontSize: "13px", cursor: "pointer", fontFamily: "Nunito,sans-serif" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <Loader label={loadingLabel}/>}

        {/* Progressive results */}
        {results.length > 0 && (
          <>
            <div style={{ color: "rgba(201,168,76,0.45)", fontSize: "11px", letterSpacing: "1px", marginBottom: "12px" }}>
              {loading ? `Searching… ${results.length} found so far` : `${results.length} results for "${activeQuery}"`}
            </div>
            {paged.map((h, i) => (
              <div key={i} style={{ marginBottom: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: "12px", overflow: "hidden" }}>
                {/* Citation bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(201,168,76,0.08)", background: "rgba(201,168,76,0.04)" }}>
                  <span style={{ color: "#c9a84c", fontSize: "12px", fontWeight: 700 }}>{h.collectionLabel} · #{h.hadithnumber}</span>
                  <button onClick={() => setExpanded(expanded === i ? null : i)}
                    style={{ background: "none", border: "none", color: "rgba(201,168,76,0.5)", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}>
                    {expanded === i ? "−" : "+"}
                  </button>
                </div>
                {/* Text - collapsed shows first 200 chars */}
                <div style={{ padding: "12px 14px", color: "rgba(255,255,255,0.72)", fontSize: "13px", lineHeight: 1.85 }}>
                  {expanded === i || h.text.length <= 200
                    ? h.text
                    : `${h.text.slice(0, 200)}…`}
                  {h.text.length > 200 && expanded !== i && (
                    <button onClick={() => setExpanded(i)} style={{ background: "none", border: "none", color: "#c9a84c", fontSize: "12px", cursor: "pointer", padding: "0 0 0 6px", fontFamily: "Nunito,sans-serif" }}>Read more</button>
                  )}
                </div>
              </div>
            ))}

            {hasMore && !loading && (
              <button onClick={() => setPage(p => p + 1)}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)", color: "rgba(201,168,76,0.7)", fontSize: "13px", cursor: "pointer", fontFamily: "Nunito,sans-serif", marginTop: "6px" }}>
                Load more ({results.length - paged.length} remaining)
              </button>
            )}
          </>
        )}

        {/* No results */}
        {searched && !loading && results.length === 0 && error && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", padding: "40px 20px", fontSize: "14px" }}>{error}</div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
