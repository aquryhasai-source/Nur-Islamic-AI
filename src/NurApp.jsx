import { useState, useEffect, useRef } from "react";
import { getAnonymousId, getCachedRemaining, getProfile, getBookmarks, toggleBookmark, KEYS } from "./utils.js";
import ChatTab            from "./ChatTab.jsx";
import QuranTab           from "./QuranTab.jsx";
import HadithTab          from "./HadithTab.jsx";
import Sidebar            from "./Sidebar.jsx";
import WelcomeScreen, { WELCOME_KEY } from "./WelcomeScreen.jsx";
import GetProPage         from "./GetProPage.jsx";
import ProfilePage        from "./ProfilePage.jsx";
import BookmarksPage      from "./BookmarksPage.jsx";
import QiblaPage          from "./QiblaPage.jsx";
import IslamicCalendarPage from "./IslamicCalendarPage.jsx";
import RecentPage         from "./RecentPage.jsx";
import AboutPage          from "./AboutPage.jsx";
import PrayerTimesPage    from "./PrayerTimesPage.jsx";

// ─── Floating patterns ────────────────────────────────────────────────────────
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
const HexSVG      = ({ s }) => <svg width={s} height={s} viewBox="0 0 100 100" fill="none"><polygon points="50,4 93,27 93,73 50,96 7,73 7,27" stroke="#c9a84c" strokeWidth="1.5"/><polygon points="50,18 80,35 80,65 50,82 20,65 20,35" stroke="#c9a84c" strokeWidth="0.8" opacity="0.5"/><circle cx="50" cy="50" r="4" stroke="#c9a84c" strokeWidth="1"/></svg>;
const StarSVG     = ({ s }) => <svg width={s} height={s} viewBox="0 0 100 100" fill="none"><polygon points="50,5 61,35 95,35 68,57 79,91 50,72 21,91 32,57 5,35 39,35" stroke="#c9a84c" strokeWidth="1.5"/></svg>;
const CrescentSVG = ({ s }) => <svg width={s} height={s} viewBox="0 0 100 100" fill="none"><path d="M65 15 A38 38 0 1 0 65 85 A28 28 0 1 1 65 15" stroke="#c9a84c" strokeWidth="1.5"/><circle cx="72" cy="30" r="4" stroke="#c9a84c" strokeWidth="1"/></svg>;

const FloatingPatterns = () => (
  <>
    <style>{`
      @keyframes fl0{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-18px)rotate(6deg)}}
      @keyframes fl1{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-12px)rotate(-4deg)}}
      @keyframes fl2{0%,100%{transform:translateY(0)rotate(0deg)}50%{transform:translateY(-22px)rotate(9deg)}}
    `}</style>
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {SHAPES.map((sh, i) => (
        <div key={i} style={{ position:"absolute", left:`${sh.x}%`, top:`${sh.y}%`, opacity:0.042, animation:`fl${i%3} ${sh.dur}s ease-in-out ${sh.d}s infinite` }}>
          {sh.t==="hex"      && <HexSVG s={sh.s}/>}
          {sh.t==="star"     && <StarSVG s={sh.s}/>}
          {sh.t==="crescent" && <CrescentSVG s={sh.s}/>}
        </div>
      ))}
    </div>
  </>
);

const InstallModal = ({ onClose, isIOS }) => {
  const steps = isIOS
    ? [["1","Open this page in","Safari browser"],["2","Tap the Share button","□↑  at the bottom"],["3","Scroll down and tap",'"Add to Home Screen"'],["4","Tap",'"Add" to confirm']]
    : [["1","Tap the","⋮  menu in your browser"],["2","Look for",'"Add to Home Screen"'],["3","Tap",'"Add" to confirm'],["4","Find NŪR","on your home screen"]];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"flex-end", padding:"20px" }}>
      <div style={{ background:"linear-gradient(160deg,#0d1f14,#081510)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"400px", margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <span style={{ color:"#c9a84c", fontSize:"17px", fontWeight:700 }}>Add to Home Screen</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(201,168,76,0.4)", fontSize:"22px", cursor:"pointer" }}>✕</button>
        </div>
        {steps.map(([n,a,b]) => (
          <div key={n} style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"16px" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c9a84c", fontSize:"13px", fontWeight:700, flexShrink:0 }}>{n}</div>
            <span style={{ color:"rgba(255,255,255,0.65)", fontSize:"14px" }}>{a} <strong style={{ color:"#c9a84c" }}>{b}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = ["chat", "quran", "hadith"];
const TAB_LABELS = { chat:"NŪR", quran:"Quran", hadith:"Hadith" };

export default function NurApp() {
  const deviceId = useRef(getAnonymousId());

  const [tab,          setTab]          = useState("chat");
  const [activePage,   setActivePage]   = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [remaining,    setRemaining]    = useState(() => getCachedRemaining());
  const [unlocked,     setUnlocked]     = useState(() => localStorage.getItem(KEYS.UNLOCKED) === "true");
  const [profile,      setProfile]      = useState(() => getProfile());
  const [showInstall,  setShowInstall]  = useState(false);
  const [isIOS,        setIsIOS]        = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [quranNav,     setQuranNav]     = useState(null); // { surah, ayah }
  const [hadithNav,    setHadithNav]    = useState(null); // { collectionId, number }
  const [hadithSearch, setHadithSearch] = useState(null);
  const [showWelcome,  setShowWelcome]  = useState(() => !localStorage.getItem(WELCOME_KEY));
  const [bookmarks,    setBookmarks]    = useState(() => getBookmarks());
  const [lightMode,    setLightMode]    = useState(() => localStorage.getItem(KEYS.THEME) === "light");
  const [textSize,     setTextSize]     = useState(() => parseFloat(localStorage.getItem(KEYS.TEXT_SIZE) || "1"));
  const installPrompt = useRef(null);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("nur-light", lightMode);
    localStorage.setItem(KEYS.THEME, lightMode ? "light" : "dark");
  }, [lightMode]);

  // PWA install
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone || localStorage.getItem(KEYS.INSTALLED)) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
    if (ios) { setShowInstall(true); return; }
    const handler = (e) => { e.preventDefault(); installPrompt.current = e; setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    const fallback = setTimeout(() => { if (!installPrompt.current) setShowInstall(true); }, 3000);
    return () => { window.removeEventListener("beforeinstallprompt", handler); clearTimeout(fallback); };
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSModal(true); return; }
    if (installPrompt.current) {
      await installPrompt.current.prompt();
      const { outcome } = await installPrompt.current.userChoice;
      if (outcome === "accepted") { localStorage.setItem(KEYS.INSTALLED, "true"); setShowInstall(false); }
      return;
    }
    setShowIOSModal(true);
  };

  // ── Page navigation ────────────────────────────────────────────────────────
  const navigateTo   = (page) => { setSidebarOpen(false); setActivePage(page); };
  const goBack       = () => setActivePage(null);

  // ── Swipe to change tabs ───────────────────────────────────────────────────
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null || activePage) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      const idx = TABS.indexOf(tab);
      if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1]);
      if (dx > 0 && idx > 0)               setTab(TABS[idx - 1]);
    }
    touchStartX.current = null; touchStartY.current = null;
  };

  const handleToggleBookmark = (item) => setBookmarks(prev => toggleBookmark(item, prev));

  // Citation navigation from ChatTab
  const handleSwitchTab    = (t)           => { setTab(t); };
  const handleQuranSurah   = (surah, ayah) => { setQuranNav({ surah, ayah }); setTimeout(() => setQuranNav(null), 800); };
  const handleHadithNav    = (nav)         => { setHadithNav(nav); setTimeout(() => setHadithNav(null), 800); };
  const handleHadithSearch = (q)           => { setHadithSearch(q); setTimeout(() => setHadithSearch(null), 500); };

  // ── Android back button — intercept so it navigates within app ─────────────
  useEffect(() => {
    // Push initial guard state so back button always has something to pop
    window.history.pushState({ nur: true }, "");
  }, []);

  useEffect(() => {
    const handler = () => {
      if (activePage) {
        setActivePage(null);
      }
      // Re-push guard so next back press is also intercepted
      window.history.pushState({ nur: true }, "");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [activePage]);

  // Theme vars
  const appBg    = lightMode ? "linear-gradient(160deg,#fdf8ed 0%,#f4e9cf 50%,#faf3e2 100%)" : "linear-gradient(160deg,#0d1f14 0%,#081510 50%,#0a1a10 100%)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.92)";
  const tabBarBg = lightMode ? "rgba(250,244,230,0.98)" : "rgba(8,21,16,0.9)";
  const tabBdr   = lightMode ? "rgba(122,88,16,0.15)"   : "rgba(201,168,76,0.1)";
  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.4)" : "rgba(201,168,76,0.33)";

  if (showWelcome) return <WelcomeScreen onDone={() => setShowWelcome(false)}/>;

  // Common page props
  const pageProps = { onBack:goBack, lightMode, textSize, unlocked, navigateTo };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:appBg, fontFamily:"'Nunito',sans-serif", position:"relative", overflow:"hidden", color:lightMode?"rgba(26,15,0,0.88)":"rgba(255,255,240,0.88)" }}>
      <FloatingPatterns/>

      {showIOSModal && <InstallModal isIOS={isIOS} onClose={() => { setShowIOSModal(false); localStorage.setItem(KEYS.INSTALLED,"true"); setShowInstall(false); }}/>}

      <Sidebar
        isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        unlocked={unlocked} lightMode={lightMode} setLightMode={setLightMode}
        onNavigate={navigateTo}
      />

      {/* ── HEADER ── */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderBottom:`1px solid ${tabBdr}`, background:headerBg, backdropFilter:"blur(14px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:"6px", display:"flex", flexDirection:"column", gap:"4.5px" }}>
          <div style={{ width:"20px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"15px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"20px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:gold, fontSize:"20px", letterSpacing:"3px", fontVariant:"small-caps", fontWeight:700, lineHeight:1 }}>NŪR</div>
          <div style={{ color:goldDim, fontSize:"9px", letterSpacing:"2.5px", textTransform:"uppercase", marginTop:"2px" }}>Islamic Knowledge</div>
        </div>
        <div style={{ minWidth:"60px", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"8px" }}>
          {showInstall && (
            <button onClick={handleInstall} style={{ background:`rgba(${lightMode?"122,88,16":"201,168,76"},0.1)`, border:`1px solid ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.3)"}`, borderRadius:"10px", color:gold, fontSize:"11px", padding:"6px 10px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:700 }}>
              + Home
            </button>
          )}
          {!showInstall && unlocked && <div style={{ fontSize:"10px", color:"rgba(76,175,132,0.75)", letterSpacing:"1px", fontWeight:600 }}>✦ Pro</div>}
        </div>
      </header>

      {/* ── TAB NAV ── */}
      <div style={{ display:"flex", flexShrink:0, background:tabBarBg, backdropFilter:"blur(14px)", borderBottom:`1px solid ${tabBdr}`, position:"sticky", top:"53px", zIndex:9 }}>
        {Object.entries(TAB_LABELS).map(([key, label]) => {
          const isActive = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{ flex:1, padding:"10px 4px", background:"none", border:"none", borderBottom:isActive?`2px solid ${gold}`:"2px solid transparent", color:isActive?gold:goldDim, fontSize:"11px", letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:isActive?700:400, transition:"all 0.2s" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", zIndex:1, minHeight:0 }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{ display:tab==="chat"?"flex":"none", flex:1, flexDirection:"column", minHeight:0 }}>
          <ChatTab
            remaining={remaining} setRemaining={setRemaining}
            unlocked={unlocked}   setUnlocked={setUnlocked}
            profile={profile}     deviceId={deviceId.current}
            lightMode={lightMode} textSize={textSize}
            navigateTo={navigateTo}
            onSwitchTab={handleSwitchTab}
            onQuranSurah={handleQuranSurah}
            onHadithNav={handleHadithNav}
          />
        </div>
        <div style={{ display:tab==="quran"?"flex":"none", flex:1, flexDirection:"column", minHeight:0 }}>
          <QuranTab
            initialNav={quranNav} bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            unlocked={unlocked} navigateTo={navigateTo}
            lightMode={lightMode} textSize={textSize}
          />
        </div>
        <div style={{ display:tab==="hadith"?"flex":"none", flex:1, flexDirection:"column", minHeight:0 }}>
          <HadithTab
            initialTopic={hadithSearch} initialNav={hadithNav}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            unlocked={unlocked} navigateTo={navigateTo}
            lightMode={lightMode} textSize={textSize}
          />
        </div>
      </div>

      {/* ── PAGE OVERLAY ── */}
      {activePage && (
        <div style={{ position:"fixed", inset:0, zIndex:30, background:appBg, animation:"slideInRight 0.28s ease", display:"flex", flexDirection:"column" }}>
          {activePage === "profile"  && <ProfilePage   {...pageProps} profile={profile} setProfile={setProfile} remaining={remaining} setTextSize={setTextSize}/>}
          {activePage === "bookmarks"&& <BookmarksPage {...pageProps} bookmarks={bookmarks} onToggle={handleToggleBookmark}/>}
          {activePage === "qibla"    && <QiblaPage     {...pageProps}/>}
          {activePage === "calendar" && <IslamicCalendarPage {...pageProps}/>}
          {activePage === "recent"   && <RecentPage    {...pageProps}/>}
          {activePage === "getpro"   && <GetProPage    {...pageProps} setUnlocked={setUnlocked} setRemaining={setRemaining} deviceId={deviceId.current}/>}
          {activePage === "about"    && <AboutPage     {...pageProps}/>}
          {activePage === "prayers"  && <PrayerTimesPage {...pageProps}/>}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{overscroll-behavior:none;}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        textarea::placeholder,input::placeholder{color:rgba(201,168,76,0.28)!important}
        textarea:disabled{opacity:0.5}
        select option{background:#0d1f14;color:rgba(255,255,240,0.88);}
        button,input,select,textarea{font-family:'Nunito',sans-serif;}
        html.nur-light select option{background:#fdf8ed;color:rgba(26,15,0,0.88);}
        html.nur-light ::-webkit-scrollbar-thumb{background:rgba(122,88,16,0.2);}
        html.nur-light textarea::placeholder,html.nur-light input::placeholder{color:rgba(122,88,16,0.35)!important}
        @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}
      `}</style>
    </div>
  );
}
