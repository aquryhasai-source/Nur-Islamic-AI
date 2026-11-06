import { useState, useEffect, useRef } from "react";
import { getAnonymousId, getCachedRemaining, getProfile, getBookmarks, toggleBookmark, KEYS,
         getSessions, getSession, createNewSession, saveSession, updateSessionMessages, deleteSession } from "./utils.js";
import { trackEvent, trackError } from "./analytics.js";
import ChatTab            from "./ChatTab.jsx";
import QuranTab           from "./QuranTab.jsx";
import HadithTab          from "./HadithTab.jsx";
import Sidebar, { snapTextSize } from "./Sidebar.jsx";
import { useMedia, DOCK_QUERY } from "./useMedia.js";
import GetProPage         from "./GetProPage.jsx";
import SupportPage        from "./SupportPage.jsx";
import FridayCard         from "./FridayCard.jsx";
import { shouldShowFridayCard } from "./sadaqah.js";
import ProfilePage        from "./ProfilePage.jsx";
import BookmarksPage      from "./BookmarksPage.jsx";
import QiblaPage          from "./QiblaPage.jsx";
import IslamicCalendarPage from "./IslamicCalendarPage.jsx";
import RecentPage         from "./RecentPage.jsx";
import AboutPage          from "./AboutPage.jsx";
import PrayerTimesPage    from "./PrayerTimesPage.jsx";
import FeedbackPage       from "./FeedbackPage.jsx";
import PrivacyPage        from "./PrivacyPage.jsx";
import TermsPage          from "./TermsPage.jsx";
import AdBanner           from "./AdBanner.jsx";
import NotificationPrompt from "./NotificationPrompt.jsx";

// ─── Background geometric pattern (khatam) ───────────────────────────────────
const Khatam = () => (
  <svg aria-hidden="true" style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", maxHeight:"1000px", pointerEvents:"none", zIndex:0 }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="khatam" width="120" height="120" patternUnits="userSpaceOnUse">
        <rect x="30" y="30" width="60" height="60" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1"/>
        <rect x="30" y="30" width="60" height="60" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1" transform="rotate(45 60 60)"/>
        <circle cx="60" cy="60" r="12" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1"/>
        <path d="M0 0 L30 30 M120 0 L90 30 M0 120 L30 90 M120 120 L90 90" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1"/>
      </pattern>
      <linearGradient id="khatamFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stopColor="#000"/><stop offset="1" stopColor="#fff"/></linearGradient>
      <mask id="khatamEdge"><rect width="100%" height="100%" fill="url(#khatamFade)"/></mask>
    </defs>
    <rect width="100%" height="100%" fill="url(#khatam)" mask="url(#khatamEdge)" style={{ opacity:"var(--patOp)" }}/>
  </svg>
);

const InstallModal = ({ onClose, isIOS }) => {
  const steps = isIOS
    ? [["1","Open this page in","Safari browser"],["2","Tap the Share button","□↑  at the bottom"],["3","Scroll down and tap",'"Add to Home Screen"'],["4","Tap",'"Add" to confirm']]
    : [["1","Tap the","⋮  menu in your browser"],["2","Look for",'"Add to Home Screen"'],["3","Tap",'"Add" to confirm'],["4","Find NŪR","on your home screen"]];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"flex-end", padding:"20px" }}>
      <div style={{ background:"var(--pop)", border:"1px solid var(--line)", borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"400px", margin:"0 auto", color:"var(--text)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <span style={{ color:"var(--gold)", fontSize:"calc(17px * var(--ts, 1))", fontWeight:700 }}>Add to Home Screen</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--dim)", fontSize:"calc(22px * var(--ts, 1))", cursor:"pointer" }}>✕</button>
        </div>
        {steps.map(([n,a,b]) => (
          <div key={n} style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"16px" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gold)", fontSize:"calc(13px * var(--ts, 1))", fontWeight:700, flexShrink:0 }}>{n}</div>
            <span style={{ color:"rgba(255,255,255,0.65)", fontSize:"calc(14px * var(--ts, 1))" }}>{a} <strong style={{ color:"var(--gold)" }}>{b}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = ["chat", "quran", "hadith"];
const TAB_LABELS = { chat:"Chat", quran:"Quran", hadith:"Hadith" };

export default function NurApp() {
  const deviceId = useRef(getAnonymousId());

  const [tab,          setTab]          = useState("chat");
  const [activePage,   setActivePage]   = useState(() => {
    const hash = window.location.hash.replace("#", "");
    const validPages = ["profile","bookmarks","qibla","calendar","recent","getpro","support","about","prayers","feedback","privacy","terms"];
    return validPages.includes(hash) ? hash : null;
  });
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [remaining,    setRemaining]    = useState(() => getCachedRemaining());
  const [unlocked,     setUnlocked]     = useState(() => localStorage.getItem(KEYS.UNLOCKED) === "true");
  const [profile,      setProfile]      = useState(() => getProfile());
  const [showInstall,  setShowInstall]  = useState(false);
  const [isIOS,        setIsIOS]        = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [quranNav,     setQuranNav]     = useState(null);
  const [hadithNav,    setHadithNav]    = useState(null);
  const [hadithSearch, setHadithSearch] = useState(null);
  const [showFriday,   setShowFriday]   = useState(false);
  const [bookmarks,    setBookmarks]    = useState(() => getBookmarks());
  const [lightMode,    setLightMode]    = useState(() => localStorage.getItem(KEYS.THEME) === "light");
  const [textSize,     setTextSize]     = useState(() => snapTextSize(localStorage.getItem(KEYS.TEXT_SIZE) || "1"));
  // One CSS variable carries the text scale so class-based text (sidebar, labels, tabs, reader) follows it too
  useEffect(() => {
    document.documentElement.style.setProperty("--ts", String(textSize));
    try { localStorage.setItem(KEYS.TEXT_SIZE, String(textSize)); } catch {}
  }, [textSize]);
  const installPrompt   = useRef(null);
  const sessionTracked  = useRef(false);
  // Swipe-from-left-edge to open sidebar (works on page overlays too)
  const pageSwipeStartX = useRef(null);

  // ── Session management ─────────────────────────────────────────────────────
  const [activeSession, setActiveSession] = useState(() => {
    const lastId = localStorage.getItem(KEYS.ACTIVE_SESSION);
    if (lastId) { const s = getSession(lastId); if (s) return s; }
    const s = createNewSession();
    saveSession(s);
    return s;
  });

  useEffect(() => {
    localStorage.setItem(KEYS.ACTIVE_SESSION, activeSession.id);
  }, [activeSession.id]);

  const handleSessionUpdate = (messages) => {
    const updated = updateSessionMessages(activeSession.id, messages);
    if (updated) setActiveSession(updated);
  };

  const handleNewChat = () => {
    const s = createNewSession();
    saveSession(s);
    setActiveSession(s);
  };

  const handleContinueSession = (session) => {
    setActiveSession(session);
    setTab("chat");
    setActivePage(null);
  };

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("nur-light", lightMode);
    localStorage.setItem(KEYS.THEME, lightMode ? "light" : "dark");
  }, [lightMode]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionTracked.current) return;
    sessionTracked.current = true;
    trackEvent("session_start", {
      unlocked: localStorage.getItem(KEYS.UNLOCKED) === "true",
      theme:    localStorage.getItem(KEYS.THEME) || "dark",
    });
    const onErr    = (e) => trackError(e.message    || "JS error",   "global");
    const onReject = (e) => trackError(e.reason?.message || "unhandled", "promise");
    window.addEventListener("error",              onErr);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error",              onErr);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  useEffect(() => { trackEvent("tab_view", { tab }); }, [tab]);

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
    if (isIOS) { setShowIOSModal(true); trackEvent("install_prompted", { type:"ios" }); return; }
    if (installPrompt.current) {
      await installPrompt.current.prompt();
      const { outcome } = await installPrompt.current.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(KEYS.INSTALLED, "true");
        setShowInstall(false);
        trackEvent("install_accepted");
      } else {
        trackEvent("install_dismissed");
      }
      return;
    }
    setShowIOSModal(true);
    trackEvent("install_prompted", { type:"manual" });
  };

  // ── Page navigation ────────────────────────────────────────────────────────
  const navigateTo = (page) => {
    setSidebarOpen(false);
    if (page === "home") {
      setActivePage(null);
      return;
    }
    setActivePage(page);
    trackEvent("page_view", { page });
  };
  const goBack = () => setActivePage(null);

  // ── Friday (Jumu'ah) card — once per device per Friday ────────────────────
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (["privacy", "terms"].includes(hash)) return;
    const t = setTimeout(() => {
      if (shouldShowFridayCard()) {
        setShowFriday(true);
        trackEvent("friday_card_shown");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Swipe to change tabs (main view) ──────────────────────────────────────
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

  // ── Swipe-from-left-edge on page overlays to open sidebar ─────────────────
  const onPageTouchStart = (e) => {
    pageSwipeStartX.current = e.touches[0].clientX < 44 ? e.touches[0].clientX : null;
  };
  const onPageTouchEnd = (e) => {
    if (pageSwipeStartX.current !== null) {
      if (e.changedTouches[0].clientX - pageSwipeStartX.current > 52) {
        setSidebarOpen(true);
      }
      pageSwipeStartX.current = null;
    }
  };

  const handleToggleBookmark = (item) => setBookmarks(prev => toggleBookmark(item, prev));

  // Citation navigation from ChatTab
  const handleSwitchTab    = (t)           => { setTab(t); };
  const handleQuranSurah   = (surah, ayah) => { setQuranNav({ surah, ayah }); setTimeout(() => setQuranNav(null), 800); };
  const handleHadithNav    = (nav)         => { setHadithNav(nav); setTimeout(() => setHadithNav(null), 800); };
  const handleHadithSearch = (q)           => { setHadithSearch(q); setTimeout(() => setHadithSearch(null), 500); };

  // ── Android back button ───────────────────────────────────────────────────
  useEffect(() => {
    window.history.pushState({ nur: true }, "");
  }, []);

  useEffect(() => {
    const handler = () => {
      if (sidebarOpen) { setSidebarOpen(false); }
      else if (activePage) { setActivePage(null); }
      window.history.pushState({ nur: true }, "");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [activePage, sidebarOpen]);

  // ── Keep URL hash in sync with activePage (so links like /#privacy work) ──
  useEffect(() => {
    if (activePage) {
      window.history.replaceState(null, "", `#${activePage}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [activePage]);

  const docked = useMedia(DOCK_QUERY);   // website view: sidebar stays on screen

  // Common page props — includes onOpenSidebar for every page
  const pageProps = {
    onBack:         goBack,
    onOpenSidebar:  () => setSidebarOpen(true),
    lightMode,
    textSize,
    unlocked,
    navigateTo,
  };

  const TAB_ICONS = {
    chat:   <path d="M5 5h14v10H10l-4 3.5V15H5V5Z"/>,
    quran:  <g><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z"/><path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19"/></g>,
    hadith: <g><path d="M7 3.5h8l3.5 3.5v13.5H7V3.5Z"/><path d="M9.5 11h6M9.5 14.5h6M9.5 18h3.5"/></g>,
  };

  // Install button + Pro badge (sits in the header on phones, in the tab strip on the website)
  const rightSlot = (
    <div style={{ minWidth:"60px", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"8px" }}>
      {showInstall && (
        <button className="cb" onClick={handleInstall} style={{ background:"var(--chip)", border:"1px solid var(--line)", borderRadius:"20px", color:"var(--gold)", fontSize:`${12*textSize}px`, padding:"6px 12px", cursor:"pointer", fontWeight:700 }}>
          + Home
        </button>
      )}
      {!showInstall && unlocked && <div style={{ fontSize:`${11*textSize}px`, color:"var(--green)", letterSpacing:"1px", fontWeight:700 }}>✦ Pro</div>}
    </div>
  );

  const tabStrip = (
    <div className="tabstrip" role="tablist" aria-label="Home sections">
      <div style={{ display:"flex", alignItems:"flex-end", gap:"12px", flex: docked ? "none" : 1 }}>
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className="tab" onClick={() => setTab(key)}
            >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_ICONS[key]}</svg>
            {label}
          </button>
        ))}
      </div>
      {docked && <div style={{ flex:1 }}/>}
      {docked && <div style={{ paddingBottom:"8px" }}>{rightSlot}</div>}
    </div>
  );

  return (
    <div className={"nur-shell" + (docked ? " nur-docked" : "")} style={{ fontFamily:"var(--font-body)" }}>
      <Khatam/>

      {showFriday && (
        <FridayCard
          lightMode={lightMode}
          textSize={textSize}
          name={profile.name}
          onClose={() => setShowFriday(false)}
          onReadKahf={() => { setShowFriday(false); setActivePage(null); setTab("quran"); handleQuranSurah(18, 1); }}
        />
      )}

      {showIOSModal && <InstallModal isIOS={isIOS} onClose={() => { setShowIOSModal(false); localStorage.setItem(KEYS.INSTALLED,"true"); setShowInstall(false); }}/>}

      <Sidebar
        isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        unlocked={unlocked} lightMode={lightMode} setLightMode={setLightMode}
        onNavigate={navigateTo}
        textSize={textSize} setTextSize={setTextSize}
        docked={docked} activePage={activePage}
      />

      <div className="nur-main">

        {/* ── HEADER (phone only — the website view has the sidebar instead) ── */}
        {!docked && (
          <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderBottom:"1px solid var(--lineSoft)", background:"var(--head)", backdropFilter:"blur(14px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
            <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" style={{ background:"none", border:"none", cursor:"pointer", padding:"6px", display:"flex", flexDirection:"column", gap:"4.5px" }}>
              <div style={{ width:"20px", height:"2px", background:"var(--gold)", borderRadius:"2px" }}/>
              <div style={{ width:"15px", height:"2px", background:"var(--gold)", borderRadius:"2px" }}/>
              <div style={{ width:"20px", height:"2px", background:"var(--gold)", borderRadius:"2px" }}/>
            </button>
            <div style={{ textAlign:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"7px", justifyContent:"center" }}>
                <div style={{ fontFamily:"var(--font-head)", color:"var(--gold)", fontSize:`${26*textSize}px`, letterSpacing:"4px", fontWeight:700, lineHeight:1 }}>NŪR</div>
                <span style={{ background:"var(--chip)", border:"1px solid var(--line)", borderRadius:"6px", color:"var(--gold)", fontSize:`${9*textSize}px`, fontWeight:700, letterSpacing:"1.5px", padding:"2px 6px", lineHeight:1.4 }}>BETA</span>
              </div>
              <div style={{ color:"var(--faint)", fontSize:`${9*textSize}px`, fontWeight:600, letterSpacing:"2.2px", textTransform:"uppercase", marginTop:"3px" }}>Free while we grow</div>
            </div>
            {rightSlot}
          </header>
        )}

        {/* ── TAB STRIP ── */}
        {tabStrip}

        {/* ── AD BANNER (phone strip; on the website the ad lives in the sidebar) ── */}
        {!docked && <AdBanner unlocked={unlocked} lightMode={lightMode}/>}

        {/* ── NOTIFICATION PROMPT ── */}
        <NotificationPrompt hasEngaged={activeSession.messages.length > 0} lightMode={lightMode} textSize={textSize}/>

        {/* ── TAB CONTENT ── */}
        <div className="nur-tabbody" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div style={{ display:tab==="chat"?"flex":"none", flex:1, flexDirection:"column", minHeight:0 }}>
            <ChatTab
              session={activeSession}
              onSessionUpdate={handleSessionUpdate}
              onNewChat={handleNewChat}
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

        {/* ── PAGE OVERLAY — covers the main area (website) or the screen (phone); swipe-from-left opens the drawer ── */}
        {activePage && (
          <div
            style={{ position:docked ? "absolute" : "fixed", inset:0, zIndex:30, background:"var(--bg)", backgroundColor:"var(--bgSolid)", animation:docked ? "fadeIn 0.2s ease" : "slideInRight 0.28s ease", display:"flex", flexDirection:"column" }}
            onTouchStart={onPageTouchStart}
            onTouchEnd={onPageTouchEnd}
          >
            <div className="nur-page" style={{ width:"100%", maxWidth: docked ? (activePage === "bookmarks" ? "2000px" : ["prayers","qibla","calendar","recent","getpro"].includes(activePage) ? "1560px" : "1280px") : "none", margin:"0 auto", flex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
              {activePage === "profile"  && <ProfilePage   {...pageProps} profile={profile} setProfile={setProfile} remaining={remaining}/>}
              {activePage === "bookmarks"&& <BookmarksPage {...pageProps} bookmarks={bookmarks} onToggle={handleToggleBookmark}/>}
              {activePage === "qibla"    && <QiblaPage     {...pageProps}/>}
              {activePage === "calendar" && <IslamicCalendarPage {...pageProps}/>}
              {activePage === "recent"   && <RecentPage    {...pageProps} onContinue={handleContinueSession}/>}
              {activePage === "getpro"   && <GetProPage    {...pageProps} setUnlocked={setUnlocked} setRemaining={setRemaining} deviceId={deviceId.current}/>}
              {activePage === "support"  && <SupportPage   {...pageProps}/>}
              {activePage === "about"    && <AboutPage     {...pageProps}/>}
              {activePage === "prayers"  && <PrayerTimesPage {...pageProps}/>}
              {activePage === "feedback" && <FeedbackPage  {...pageProps}/>}
              {activePage === "privacy"  && <PrivacyPage   {...pageProps}/>}
              {activePage === "terms"    && <TermsPage     {...pageProps}/>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
