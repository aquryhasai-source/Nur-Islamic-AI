import { useState, useEffect, useRef } from "react";
import { getAnonymousId, getCachedRemaining, getProfile, getBookmarks, toggleBookmark, isBookmarked, KEYS } from "./utils.js";
import ChatTab   from "./ChatTab.jsx";
import QuranTab  from "./QuranTab.jsx";
import HadithTab from "./HadithTab.jsx";
import Sidebar        from "./Sidebar.jsx";
import WelcomeScreen, { WELCOME_KEY } from "./WelcomeScreen.jsx";

// ─── Floating background shapes ───────────────────────────────────────────────
const SHAPES = [
  { t:"hex",      x:6,  y:8,  s:65, d:0,  dur:22 },
  { t:"star",     x:76, y:6,  s:32, d:4,  dur:27 },
  { t:"crescent", x:88, y:40, s:48, d:7,  dur:20 },
  { t:"hex",      x:52, y:62, s:44, d:11, dur:18 },
  { t:"star",     x:14, y:72, s:26, d:15, dur:24 },
  { t:"hex",      x:85, y:78, s:38, d:3,  dur:30 },
  { t:"crescent", x:32, y:18, s:42, d:9,  dur:25 },
  { t:"star",     x:62, y:88, s:20, d:6,  dur:16 },
];

const HexSVG = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
    <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" stroke="#c9a84c" strokeWidth="1.5"/>
    <polygon points="50,18 80,35 80,65 50,82 20,65 20,35" stroke="#c9a84c" strokeWidth="0.8" opacity="0.5"/>
    <circle cx="50" cy="50" r="4" stroke="#c9a84c" strokeWidth="1"/>
  </svg>
);
const StarSVG = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
    <polygon points="50,5 61,35 95,35 68,57 79,91 50,72 21,91 32,57 5,35 39,35" stroke="#c9a84c" strokeWidth="1.5"/>
  </svg>
);
const CrescentSVG = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
    <path d="M65 15 A38 38 0 1 0 65 85 A28 28 0 1 1 65 15" stroke="#c9a84c" strokeWidth="1.5"/>
    <circle cx="72" cy="30" r="4" stroke="#c9a84c" strokeWidth="1"/>
  </svg>
);

const FloatingPatterns = () => (
  <>
    <style>{`
      @keyframes fl0{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-18px)rotate(6deg)}}
      @keyframes fl1{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-12px)rotate(-4deg)}}
      @keyframes fl2{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-22px)rotate(9deg)}}
    `}</style>
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {SHAPES.map((sh, i) => (
        <div key={i} style={{
          position:"absolute", left:`${sh.x}%`, top:`${sh.y}%`, opacity:0.042,
          animation:`fl${i % 3} ${sh.dur}s ease-in-out ${sh.d}s infinite`,
        }}>
          {sh.t === "hex"      && <HexSVG s={sh.s}/>}
          {sh.t === "star"     && <StarSVG s={sh.s}/>}
          {sh.t === "crescent" && <CrescentSVG s={sh.s}/>}
        </div>
      ))}
    </div>
  </>
);

// ─── iOS Install Modal ────────────────────────────────────────────────────────
const InstallModal = ({ onClose, isIOS }) => {
  const steps = isIOS ? [
    ["1", "Open this page in", "Safari browser"],
    ["2", "Tap the Share button", "□↑  at the bottom"],
    ["3", "Scroll down and tap", '"Add to Home Screen"'],
    ["4", "Tap", '"Add" to confirm'],
  ] : [
    ["1", "Tap the", "⋮  menu in your browser"],
    ["2", "Look for", '"Add to Home Screen"'],
    ["3", "Tap", '"Add" to confirm'],
    ["4", "Find NŪR", "on your home screen"],
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"flex-end", padding:"20px" }}>
      <div style={{ background:"linear-gradient(160deg,#0d1f14,#081510)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"400px", margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <span style={{ color:"#c9a84c", fontSize:"17px", fontWeight:700 }}>Add to Home Screen</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(201,168,76,0.4)", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>
        {steps.map(([n, a, b]) => (
          <div key={n} style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"16px" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c9a84c", fontSize:"13px", fontWeight:700, flexShrink:0 }}>{n}</div>
            <span style={{ color:"rgba(255,255,255,0.65)", fontSize:"14px", lineHeight:1.5 }}>
              {a} <strong style={{ color:"#c9a84c" }}>{b}</strong>
            </span>
          </div>
        ))}
        <div style={{ color:"rgba(201,168,76,0.3)", fontSize:"11px", textAlign:"center", marginTop:"8px" }}>
          {isIOS ? "Works best in Safari" : "Works in Chrome & Edge"} · Already installed? Close this
        </div>
      </div>
    </div>
  );
};

// ─── Saved Tab ────────────────────────────────────────────────────────────────
function SavedTab({ bookmarks, onToggle, lightMode }) {
  const gold    = lightMode ? "#7a5810" : "#c9a84c";
  const cardBg  = lightMode ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.03)";
  const cardBdr = lightMode ? "rgba(122,88,16,0.15)" : "rgba(201,168,76,0.12)";
  const textClr = lightMode ? "rgba(26,15,0,0.72)" : "rgba(255,255,255,0.7)";
  const dimClr  = lightMode ? "rgba(122,88,16,0.5)"  : "rgba(201,168,76,0.45)";

  if (bookmarks.length === 0) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center" }}>
        <div style={{ fontSize:"36px", marginBottom:"14px", opacity:0.5 }}>🔖</div>
        <div style={{ color:gold, fontSize:"17px", fontWeight:700, marginBottom:"10px" }}>No Bookmarks Yet</div>
        <div style={{ color:textClr, fontSize:"13px", lineHeight:1.8, maxWidth:"280px" }}>
          Tap the bookmark icon on any Quran ayah or Hadith to save it here.
        </div>
      </div>
    );
  }

  const quranBm  = bookmarks.filter(b => b.type === "quran");
  const hadithBm = bookmarks.filter(b => b.type === "hadith");

  const Section = ({ title, items }) => (
    <>
      <div style={{ color:dimClr, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"10px", marginTop:"4px" }}>{title}</div>
      {items.map(bm => (
        <div key={bm.id} style={{ marginBottom:"10px", background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:"14px", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", background:lightMode?"rgba(122,88,16,0.05)":"rgba(201,168,76,0.04)", borderBottom:`1px solid ${cardBdr}` }}>
            <span style={{ color:gold, fontSize:"12px", fontWeight:700 }}>{bm.title}</span>
            <button onClick={() => onToggle(bm)}
              style={{ background:"none", border:"none", fontSize:"16px", cursor:"pointer", lineHeight:1, padding:"0 2px", color:gold }}>
              🔖
            </button>
          </div>
          {bm.arabic && (
            <div style={{ padding:"10px 14px 6px", color:gold, fontSize:"19px", fontFamily:"Georgia,serif", textAlign:"right", direction:"rtl", lineHeight:2 }}>
              {bm.arabic}
            </div>
          )}
          <div style={{ padding: bm.arabic ? "0 14px 12px" : "12px 14px", color:textClr, fontSize:"13px", lineHeight:1.8 }}>
            {bm.text}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px 16px 20px" }}>
      <div style={{ color:dimClr, fontSize:"11px", letterSpacing:"1px", marginBottom:"14px" }}>
        {bookmarks.length} saved item{bookmarks.length !== 1 ? "s" : ""}
      </div>
      {quranBm.length  > 0 && <Section title="Quran Ayahs"  items={quranBm}/>}
      {hadithBm.length > 0 && <Section title="Hadiths"      items={hadithBm}/>}
    </div>
  );
}

// ─── Main App Shell ───────────────────────────────────────────────────────────
const TABS = ["chat", "quran", "hadith", "saved"];
const TAB_LABELS = { chat:"NŪR", quran:"Quran", hadith:"Hadith", saved:"Saved" };

export default function NurApp() {
  const deviceId = useRef(getAnonymousId());

  const [tab,          setTab]          = useState("chat");
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [remaining,    setRemaining]    = useState(() => getCachedRemaining());
  const [unlocked,     setUnlocked]     = useState(() => localStorage.getItem(KEYS.UNLOCKED) === "true");
  const [profile,      setProfile]      = useState(() => getProfile());
  const [showInstall,  setShowInstall]  = useState(false);
  const [isIOS,        setIsIOS]        = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [quranSurah,   setQuranSurah]   = useState(null);
  const [showWelcome,  setShowWelcome]  = useState(() => !localStorage.getItem(WELCOME_KEY));
  const [hadithTopic,  setHadithTopic]  = useState(null);
  const [bookmarks,    setBookmarks]    = useState(() => getBookmarks());
  const [lightMode,    setLightMode]    = useState(() => localStorage.getItem(KEYS.THEME) === "light");
  const installPrompt = useRef(null);

  // ── Apply theme class on <html> ────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("nur-light", lightMode);
    localStorage.setItem(KEYS.THEME, lightMode ? "light" : "dark");
  }, [lightMode]);

  // ── PWA install detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (window.navigator.standalone) return;
    if (localStorage.getItem(KEYS.INSTALLED)) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
    if (ios) { setShowInstall(true); return; }

    const handler = (e) => {
      e.preventDefault();
      installPrompt.current = e;
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const fallback = setTimeout(() => {
      if (!installPrompt.current) setShowInstall(true);
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallback);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSModal(true); return; }
    if (installPrompt.current) {
      await installPrompt.current.prompt();
      const { outcome } = await installPrompt.current.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(KEYS.INSTALLED, "true");
        setShowInstall(false);
      }
      return;
    }
    setShowIOSModal(true);
  };

  // ── Swipe to change tabs ───────────────────────────────────────────────────
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Only trigger if horizontal movement dominates (not a scroll)
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      const idx = TABS.indexOf(tab);
      if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1]); // swipe left → next
      if (dx > 0 && idx > 0)               setTab(TABS[idx - 1]); // swipe right → prev
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // ── Bookmark toggle ────────────────────────────────────────────────────────
  const handleToggleBookmark = (item) => {
    setBookmarks(prev => toggleBookmark(item, prev));
  };

  // ── Sidebar callbacks ──────────────────────────────────────────────────────
  const handleQuranSurah = (n) => {
    setQuranSurah(n);
    setTimeout(() => setQuranSurah(null), 500);
  };

  const handleHadithTopic = (topic) => {
    setHadithTopic(topic);
    setTimeout(() => setHadithTopic(null), 500);
  };

  const savedCount = bookmarks.length;

  // ── Theme-aware colours (structural elements only) ─────────────────────────
  const appBg   = lightMode
    ? "linear-gradient(160deg,#fdf8ed 0%,#f4e9cf 50%,#faf3e2 100%)"
    : "linear-gradient(160deg,#0d1f14 0%,#081510 50%,#0a1a10 100%)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.92)";
  const tabBarBg = lightMode ? "rgba(250,244,230,0.98)" : "rgba(8,21,16,0.9)";
  const tabBorderB = lightMode ? "rgba(122,88,16,0.15)" : "rgba(201,168,76,0.1)";
  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.4)" : "rgba(201,168,76,0.33)";

  if (showWelcome) {
    return <WelcomeScreen onDone={() => setShowWelcome(false)}/>;
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", flexDirection:"column",
      background: appBg,
      fontFamily:"'Nunito',sans-serif", position:"relative", overflow:"hidden",
      color: lightMode ? "rgba(26,15,0,0.88)" : "rgba(255,255,240,0.88)",
    }}>
      <FloatingPatterns/>

      {showIOSModal && (
        <InstallModal isIOS={isIOS} onClose={() => {
          setShowIOSModal(false);
          localStorage.setItem(KEYS.INSTALLED, "true");
          setShowInstall(false);
        }}/>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        remaining={remaining}
        unlocked={unlocked}
        setUnlocked={setUnlocked}
        setRemaining={setRemaining}
        profile={profile}
        setProfile={setProfile}
        deviceId={deviceId.current}
        onNavigate={(t) => { setTab(t); setSidebarOpen(false); }}
        onQuranSurah={handleQuranSurah}
        onHadithTopic={handleHadithTopic}
        lightMode={lightMode}
        setLightMode={setLightMode}
      />

      {/* ── HEADER ── */}
      <header style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px",
        borderBottom:`1px solid ${lightMode ? "rgba(122,88,16,0.15)" : "rgba(201,168,76,0.13)"}`,
        background: headerBg, backdropFilter:"blur(14px)",
        position:"sticky", top:0, zIndex:10, flexShrink:0,
      }}>
        {/* Hamburger */}
        <button onClick={() => setSidebarOpen(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:"6px", display:"flex", flexDirection:"column", gap:"4.5px" }}>
          <div style={{ width:"20px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"15px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"20px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>

        {/* Logo */}
        <div style={{ textAlign:"center" }}>
          <div style={{ color:gold, fontSize:"20px", letterSpacing:"3px", fontVariant:"small-caps", fontWeight:700, lineHeight:1 }}>NŪR</div>
          <div style={{ color:goldDim, fontSize:"9px", letterSpacing:"2.5px", textTransform:"uppercase", marginTop:"2px" }}>Islamic Knowledge</div>
        </div>

        {/* Right side */}
        <div style={{ minWidth:"60px", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"8px" }}>
          {showInstall && (
            <button onClick={handleInstall} style={{
              background:`rgba(${lightMode?"122,88,16":"201,168,76"},0.1)`, border:`1px solid ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.3)"}`,
              borderRadius:"10px", color:gold, fontSize:"11px", padding:"6px 10px",
              cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:700,
              whiteSpace:"nowrap", lineHeight:1.3,
            }}>
              + Home
            </button>
          )}
          {!showInstall && unlocked && (
            <div style={{ fontSize:"10px", color:"rgba(76,175,132,0.75)", letterSpacing:"1px", fontWeight:600 }}>✦ Pro</div>
          )}
        </div>
      </header>

      {/* ── TAB NAV ── */}
      <div style={{
        display:"flex", flexShrink:0,
        background: tabBarBg, backdropFilter:"blur(14px)",
        borderBottom:`1px solid ${tabBorderB}`,
        position:"sticky", top:"53px", zIndex:9,
      }}>
        {Object.entries(TAB_LABELS).map(([key, label]) => {
          const isActive = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              flex:1, padding:"10px 4px",
              background:"none", border:"none",
              borderBottom: isActive ? `2px solid ${gold}` : "2px solid transparent",
              color: isActive ? gold : goldDim,
              fontSize:"11px", letterSpacing:"1.5px", textTransform:"uppercase",
              cursor:"pointer", fontFamily:"Nunito,sans-serif",
              fontWeight: isActive ? 700 : 400,
              transition:"all 0.2s",
              position:"relative",
            }}>
              {label}
              {key === "saved" && savedCount > 0 && (
                <span style={{ position:"absolute", top:"6px", right:"calc(50% - 22px)", background:gold, color: lightMode ? "#fff" : "#0d1f14", fontSize:"9px", fontWeight:800, borderRadius:"10px", padding:"1px 5px", lineHeight:1.4 }}>
                  {savedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div
        style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", zIndex:1, minHeight:0 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ display: tab === "chat"   ? "flex" : "none", flex:1, flexDirection:"column", minHeight:0 }}>
          <ChatTab
            remaining={remaining} setRemaining={setRemaining}
            unlocked={unlocked}   setUnlocked={setUnlocked}
            profile={profile}     deviceId={deviceId.current}
            lightMode={lightMode}
          />
        </div>
        <div style={{ display: tab === "quran"  ? "flex" : "none", flex:1, flexDirection:"column", minHeight:0 }}>
          <QuranTab
            initialSurah={quranSurah}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            lightMode={lightMode}
          />
        </div>
        <div style={{ display: tab === "hadith" ? "flex" : "none", flex:1, flexDirection:"column", minHeight:0 }}>
          <HadithTab
            initialTopic={hadithTopic}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            lightMode={lightMode}
          />
        </div>
        <div style={{ display: tab === "saved"  ? "flex" : "none", flex:1, flexDirection:"column", minHeight:0 }}>
          <SavedTab
            bookmarks={bookmarks}
            onToggle={handleToggleBookmark}
            lightMode={lightMode}
          />
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{overscroll-behavior:none;}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        textarea::placeholder{color:rgba(201,168,76,0.28)!important}
        textarea:disabled{opacity:0.5}
        input::placeholder{color:rgba(201,168,76,0.28)!important}
        select option{background:#0d1f14;color:rgba(255,255,240,0.88);}
        button,input,select,textarea{font-family:'Nunito',sans-serif;}
        html.nur-light select option{background:#fdf8ed;color:rgba(26,15,0,0.88);}
        html.nur-light ::-webkit-scrollbar-thumb{background:rgba(122,88,16,0.2);}
        html.nur-light textarea::placeholder{color:rgba(122,88,16,0.35)!important}
        html.nur-light input::placeholder{color:rgba(122,88,16,0.35)!important}
      `}</style>
    </div>
  );
}
