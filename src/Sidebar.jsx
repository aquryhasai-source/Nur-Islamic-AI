import { SADAQAH_ENABLED } from "./sadaqah.js";
// ─── Nav icons ────────────────────────────────────────────────────────────
// Hand-drawn inline SVGs, matching the fill="currentColor" style already
// used for SearchIcon/BackIcon in HadithTab.jsx — no icon-font/library
// dependency, and every icon inherits color from its wrapper (set to
// `gold` below) so light/dark mode just work like everything else here.
const IconHome = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>
  </svg>
);
const IconProfile = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);
const IconBookmark = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 3h10v17l-5-3.75L7 20z"/>
  </svg>
);
// Compass — ring + needle as one path (even-odd fill), same two-tone-needle
// concept as the CompassSVG on the Qibla page, just simplified to a glyph.
const IconQibla = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd">
    <path d="M12,3 A9,9 0 1,0 12,21 A9,9 0 1,0 12,3 Z M12,5 A7,7 0 1,1 12,19 A7,7 0 1,1 12,5 Z M12,6.5 L13.5,12 L12,17.5 L10.5,12 Z"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 2v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-2V2h-2v2H9V2H7zM5 9h14v11H5z"/>
  </svg>
);
// Prayer Times — stylized sujood (prostration) figure, per the reference
// image: a rounded bowing silhouette with a detached circular head, drawn
// as a single thick rounded stroke rather than a fill (the shape reads as
// a silhouette this way, matching the reference far better than a filled
// path would at this size).
const IconPrayer = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <circle cx="16.3" cy="6.2" r="1.8" fill="currentColor"/>
    <path d="M12.8 8.3c1 1.1 1 2.6-.1 3.6l-3.1 2.9c-.85.8-.9 2.05-.1 2.85.8.8 2.05.75 2.85-.05l2.7-2.6"
      stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.2 17.7h5.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
  </svg>
);
const IconHistory = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z"/>
  </svg>
);
const IconCrown = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16l-2-9 5 3 4-6 4 6 5-3-2 9H5zm0 2h14v2H5z"/>
  </svg>
);
const IconHeart = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);
const IconHeadset = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3a8 8 0 0 0-8 8v6a3 3 0 0 0 3 3h1v-8H6v-1a6 6 0 1 1 12 0v1h-2v8h1a3 3 0 0 0 3-3v-6a8 8 0 0 0-8-8z"/>
  </svg>
);
// Shield check — outline (the checkmark needs real contrast against the
// shield to read at 19px, which a same-color knockout can't give reliably)
const IconShield = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <path d="M12 2.5l6.5 2.7v5.4c0 4.4-2.8 8.2-6.5 9.6-3.7-1.4-6.5-5.2-6.5-9.6V5.2z"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M8.7 12.1l2.1 2.1 4.3-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
// Terms — single filled path; the three text lines are even-odd knockouts
// cut out of the solid document, same technique as the compass needle above
const IconTerms = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd">
    <path d="M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z
      M8 8h8v1.6H8z M8 11.5h8v1.6H8z M8 15h5v1.6H8z"/>
  </svg>
);
const IconInfo = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/>
  </svg>
);

// Non-feature, utility-style nav entries — rendered smaller and non-bold
// so the main app features (Home through Get Pro) stand out at a glance.
const UTILITY_KEYS = ["feedback", "privacy", "terms", "about"];

export default function Sidebar({ isOpen, onClose, unlocked, lightMode, setLightMode, onNavigate, textSize = 1 }) {
  const gold = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim = lightMode ? "rgba(122,88,16,0.5)" : "rgba(201,168,76,0.45)";
  const goldFaint = lightMode ? "rgba(122,88,16,0.08)" : "rgba(201,168,76,0.07)";
  const goldBdr = lightMode ? "rgba(122,88,16,0.15)" : "rgba(201,168,76,0.12)";
  const textClr = lightMode ? "rgba(26,15,0,0.85)" : "rgba(255,255,240,0.88)";
  const textDim = lightMode ? "rgba(26,15,0,0.4)" : "rgba(255,255,255,0.35)";
  const bg = lightMode ? "linear-gradient(180deg,#fdf8ed,#f6edda)" : "linear-gradient(180deg,#0d1f14,#081510)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const overlayBg = lightMode ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.65)";

  const NAV_ITEMS = [
    { key:"home",      icon:<IconHome/>,     label:"Home",               sub:"Return to NŪR chat" },
    { key:"profile",   icon:<IconProfile/>,  label:"Profile",            sub:"Usage · Name · Text size" },
    { key:"bookmarks", icon:<IconBookmark/>, label:"Bookmarks",          sub:"Saved ayahs & hadiths" },
    { key:"qibla",     icon:<IconQibla/>,    label:"Qibla Direction",    sub:"Find the direction of prayer" },
    { key:"calendar",  icon:<IconCalendar/>, label:"Islamic Calendar",   sub:"Hijri dates & events" },
    { key:"prayers",   icon:<IconPrayer/>,   label:"Prayer Times",       sub:"Daily salah times & alarms" },
    { key:"recent",    icon:<IconHistory/>,  label:"Chat History",       sub:"Your recent questions" },
    { key:"getpro",    icon:<IconCrown/>,    label:"Get Pro",            sub:"Remove ads · Unlimited chat" },
    { key:"support",   icon:<IconHeart/>,    label:"Support NŪR",        sub:"Sadaqah jariyah · any amount" },
    { key:"feedback",  icon:<IconHeadset/>,  label:"Feedback & Support", sub:"Report issue · Suggestions" },
    { key:"privacy",   icon:<IconShield/>,   label:"Privacy Policy",     sub:"How we handle your data" },
    { key:"terms",     icon:<IconTerms/>,    label:"Terms of Use",       sub:"Disclaimer · Terms" },
    { key:"about",     icon:<IconInfo/>,     label:"About",              sub:"Version · Disclaimer" },
  ];

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{ position:"fixed", inset:0, background:overlayBg, zIndex:50, backdropFilter:"blur(4px)" }}/>
      )}
      <div style={{
        position:"fixed", top:0, left:0, bottom:0,
        width:"min(82vw,300px)",
        background:bg, borderRight:`1px solid ${goldBdr}`,
        zIndex:51, display:"flex", flexDirection:"column",
        transition:"transform 0.28s ease",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
      }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(10px)", flexShrink:0 }}>
          <div style={{ color:gold, fontSize:`${18*textSize}px`, letterSpacing:"3px", fontWeight:800 }}>NŪR</div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <button
              onClick={() => setLightMode(m => !m)}
              style={{ display:"flex", alignItems:"center", gap:"6px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"20px", padding:"5px 11px", cursor:"pointer" }}>
              <span style={{ fontSize:"13px" }}>{lightMode ? "🌙" : "☀️"}</span>
              <span style={{ color:goldDim, fontSize:`${10*textSize}px`, fontWeight:700 }}>{lightMode ? "Dark" : "Light"}</span>
            </button>
            <button onClick={onClose} style={{ background:"none", border:"none", color:goldDim, fontSize:"20px", cursor:"pointer", lineHeight:1 }}>✕</button>
          </div>
        </div>

        {/* Nav items */}
        {/* Utility items (Feedback, Privacy, Terms, About) render smaller and
            non-bold, so the main app features stand out at a glance. */}
        <div style={{ flex:1, overflowY:"auto", padding:"10px 12px 20px" }}>
          {NAV_ITEMS.filter(i => i.key !== "support" || SADAQAH_ENABLED).map(({ key, icon, label, sub }) => {
            const isUtility = UTILITY_KEYS.includes(key);
            return (
            <button key={key}
              onClick={() => { onNavigate(key); onClose(); }}
              style={{ display:"flex", alignItems:"center", gap:"14px", width:"100%", padding:"13px 14px", marginBottom:"4px", background:"transparent", border:`1px solid transparent`, borderRadius:"12px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = goldFaint; e.currentTarget.style.borderColor = goldBdr; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
              <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", color:gold, flexShrink:0 }}>
                {icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:textClr, fontSize:`${(isUtility ? 13 : 15) * textSize}px`, fontWeight:isUtility ? 400 : 700, lineHeight:1.3 }}>{label}</div>
                <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginTop:"2px" }}>{sub}</div>
              </div>
              {key === "getpro" && !unlocked
                ? <div style={{ background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, color:lightMode?"#fff":"#0d1f14", fontSize:`${9*textSize}px`, fontWeight:800, letterSpacing:"1px", padding:"3px 8px", borderRadius:"10px", flexShrink:0 }}>AD‑FREE</div>
                : key === "getpro" && unlocked
                  ? <div style={{ color:"rgba(76,175,132,0.7)", fontSize:`${11*textSize}px`, flexShrink:0 }}>✦</div>
                  : null
              }
            </button>
          );})}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 18px", borderTop:`1px solid ${goldBdr}`, textAlign:"center" }}>
          <div style={{ color:gold, fontSize:`${16*textSize}px`, fontFamily:"Georgia,serif", marginBottom:"3px" }}>بِسْمِ اللّٰهِ</div>
          <div style={{ color:textDim, fontSize:`${9*textSize}px`, letterSpacing:"1px" }}>Always consult a qualified scholar</div>
        </div>
      </div>
    </>
  );
}
