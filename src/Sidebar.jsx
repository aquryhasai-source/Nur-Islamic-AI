import { useState } from "react";
import { SADAQAH_ENABLED } from "./sadaqah.js";
import AdBanner from "./AdBanner.jsx";

// ─── Icons (stroke style, inherit colour) ────────────────────────────────────
const Svg = ({ d, size = 18, sw = 1.8, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d}/> : children}
  </svg>
);
const I = {
  home:     <Svg d="M3 11.5 12 4l9 7.5M5.5 10v9.5h5v-5h3v5h5V10"/>,
  prayerG:  <Svg d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>,
  library:  <Svg><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z"/><path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19"/></Svg>,
  pro:      <Svg d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8L12 3Z"/>,
  support:  <Svg d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10Z"/>,
  about:    <Svg><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/></Svg>,
  prayer:   <Svg size={17}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Svg>,
  qibla:    <Svg size={17}><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></Svg>,
  calendar: <Svg size={17}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></Svg>,
  profile:  <Svg size={17}><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5"/></Svg>,
  bookmark: <Svg size={17} d="M7 4h10v16l-5-3.6L7 20V4Z"/>,
  history:  <Svg size={17} d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5v4h4M12 8v4.2l2.8 1.6"/>,
  feedback: <Svg size={17} d="M5 5h14v10H10l-4 3.5V15H5V5Z"/>,
  shield:   <Svg size={17}><path d="M12 3.5 18.5 6v5.2c0 4.2-2.7 7.4-6.5 9.3-3.8-1.9-6.5-5.1-6.5-9.3V6L12 3.5Z"/><path d="m9 12 2.2 2.2L15.2 10"/></Svg>,
  terms:    <Svg size={17}><path d="M7 3.5h8l3.5 3.5v13.5H7V3.5Z"/><path d="M9.5 11h6M9.5 14.5h6M9.5 18h3.5"/></Svg>,
  aboutS:   <Svg size={17}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/></Svg>,
};

// Which group each page key lives in (so the right group opens by default)
const GROUPS = [
  { id:"tools",   label:"Prayer & Tools",  icon:I.prayerG, items:[["prayers","Prayer Times",I.prayer],["qibla","Qibla Direction",I.qibla],["calendar","Islamic Calendar",I.calendar]] },
  { id:"library", label:"My Library",      icon:I.library, items:[["profile","Profile",I.profile],["bookmarks","Bookmarks",I.bookmark],["recent","Chat History",I.history]] },
  { id:"support", label:"Support",         icon:I.support, support:true, items:[["support","Support NŪR",I.support],["feedback","Feedback & Support",I.feedback]] },
  { id:"legal",   label:"About & Legal",   icon:I.about,   items:[["about","About",I.aboutS],["privacy","Privacy Policy",I.shield],["terms","Terms of Use",I.terms]] },
];
const groupOf = (page) => GROUPS.find(g => g.items.some(([k]) => k === page))?.id || null;

const IconBox = ({ children }) => (
  <span style={{ width:"28px", height:"28px", borderRadius:"8px", background:"var(--chip)", border:"1px solid var(--lineSoft)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gold)", flex:"none" }}>{children}</span>
);

export default function Sidebar({ isOpen, onClose, unlocked, lightMode, setLightMode, onNavigate, textSize = 1, docked = false, activePage = null }) {
  // One group open at a time. Starts on whichever group holds the current page.
  const [openGroup, setOpenGroup] = useState(() => groupOf(activePage) || "tools");
  const go = (key) => { onNavigate(key); if (!docked) onClose(); };

  const header = (
    <div style={{ flex:"none", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 16px", borderBottom:"1px solid var(--lineSoft)" }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:"9px" }}>
          <span style={{ fontFamily:"var(--font-head)", fontSize:"30px", fontWeight:700, letterSpacing:"5px", color:"var(--gold)", lineHeight:1.1 }}>NŪR</span>
          <span style={{ fontSize:"10px", fontWeight:700, letterSpacing:"1.5px", color:"var(--gold)", border:"1px solid var(--line)", borderRadius:"6px", padding:"2px 7px", background:"var(--chip)" }}>BETA</span>
        </div>
        <div style={{ fontSize:"10px", fontWeight:600, letterSpacing:"2.4px", color:"var(--faint)", marginTop:"4px" }}>FREE WHILE WE GROW</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
        <button className="cb" onClick={() => setLightMode(m => !m)} aria-label="Switch colour theme"
          style={{ display:"flex", alignItems:"center", gap:"7px", background:"var(--chip)", border:"1px solid var(--line)", borderRadius:"20px", padding:"7px 13px", color:"var(--gold)", fontSize:`${12*textSize}px`, fontWeight:700, cursor:"pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor"/></svg>
          {lightMode ? "Dark" : "Light"}
        </button>
        {!docked && <button onClick={onClose} aria-label="Close menu" style={{ background:"none", border:"none", color:"var(--dim)", fontSize:"20px", cursor:"pointer", lineHeight:1 }}>✕</button>}
      </div>
    </div>
  );

  const nav = (
    <nav style={{ flex:1, minHeight:0, overflowY:"auto", padding:"10px 12px" }} aria-label="Main">
      <button className="nb" aria-current={activePage === null ? "page" : undefined} onClick={() => go("home")} style={{ height:"40px", marginBottom:"3px", fontWeight:700 }}>
        <IconBox>{I.home}</IconBox><span style={{ flex:1 }}>Home</span>
      </button>

      {GROUPS.slice(0, 2).map(g => <Group key={g.id} g={g} openGroup={openGroup} setOpenGroup={setOpenGroup} activePage={activePage} go={go}/>)}

      <button className="nb" aria-current={activePage === "getpro" ? "page" : undefined} onClick={() => go("getpro")} style={{ height:"40px", marginBottom:"3px" }}>
        <IconBox>{I.pro}</IconBox><span style={{ flex:1 }}>Get Pro</span>
        {!unlocked
          ? <span style={{ background:"var(--goldFill)", color:"var(--onGold)", fontSize:"9.5px", fontWeight:700, letterSpacing:"1px", padding:"3px 8px", borderRadius:"10px" }}>AD‑FREE</span>
          : <span style={{ color:"var(--green)", fontSize:"11px" }}>✦</span>}
      </button>

      {GROUPS.slice(2).filter(g => !g.support || SADAQAH_ENABLED || true).map(g => (
        <Group key={g.id} g={g} openGroup={openGroup} setOpenGroup={setOpenGroup} activePage={activePage} go={go} hideKeys={SADAQAH_ENABLED ? [] : ["support"]}/>
      ))}
    </nav>
  );

  const footer = (
    <div style={{ flex:"none", padding:"11px 18px 13px", textAlign:"center", borderTop:"1px solid var(--lineSoft)" }}>
      <div lang="ar" className="ar" style={{ fontSize:"20px", color:"var(--gold)", lineHeight:1.3 }}>بِسْمِ اللّٰهِ</div>
      <div style={{ fontSize:"9.5px", fontWeight:600, letterSpacing:"1.4px", color:"var(--faint)", marginTop:"2px" }}>ALWAYS CONSULT A QUALIFIED SCHOLAR</div>
    </div>
  );

  // ── Website view: permanent column ────────────────────────────────────────
  if (docked) {
    return (
      <aside className="nur-side-dock" aria-label="Sidebar">
        {header}{nav}
        <AdBanner unlocked={unlocked} lightMode={lightMode} variant="slot"/>
        {footer}
      </aside>
    );
  }

  // ── Phone view: slide-in drawer (same open/close behaviour as before) ─────
  return (
    <>
      {isOpen && <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(4,8,28,.62)", zIndex:50, backdropFilter:"blur(4px)", animation:"fadeIn .2s ease" }}/>}
      <aside aria-label="Sidebar" aria-hidden={!isOpen}
        style={{ position:"fixed", top:0, left:0, bottom:0, width:"min(86vw,330px)", background:"var(--side)", backgroundColor:"var(--bgSolid)", borderRight:"1px solid var(--lineSoft)", zIndex:51, display:"flex", flexDirection:"column", transition:"transform .28s ease", transform:isOpen ? "translateX(0)" : "translateX(-100%)", visibility:isOpen ? "visible" : "hidden", transitionProperty:"transform, visibility" }}>
        {header}{nav}{footer}
      </aside>
    </>
  );
}

function Group({ g, openGroup, setOpenGroup, activePage, go, hideKeys = [] }) {
  const open = openGroup === g.id;
  const hasActive = g.items.some(([k]) => k === activePage);
  const items = g.items.filter(([k]) => !hideKeys.includes(k));
  return (
    <>
      <button className="nb" aria-expanded={open} onClick={() => setOpenGroup(open ? null : g.id)}
        style={{ height:"40px", marginBottom:"3px", border:`1px solid ${hasActive && !open ? "var(--line)" : "transparent"}`, background: hasActive && !open ? "var(--active)" : undefined }}>
        <IconBox>{g.icon}</IconBox>
        <span style={{ flex:1 }}>{g.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform:open ? "rotate(90deg)" : "none", transition:"transform .2s" }}><path d="m9 6 6 6-6 6"/></svg>
      </button>
      {open && (
        <div style={{ margin:"0 0 6px 27px", paddingLeft:"12px", borderLeft:"1px solid var(--line)" }}>
          {items.map(([k, label, icon]) => (
            <button key={k} className="nb" aria-current={activePage === k ? "page" : undefined} onClick={() => go(k)}
              style={{ height:"36px", padding:"0 10px", borderRadius:"9px", fontSize:"13px", gap:"11px", color: activePage === k ? "var(--text)" : "var(--dim)", fontWeight: activePage === k ? 700 : 600 }}>
              <span style={{ color:"var(--gold)", display:"flex" }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
