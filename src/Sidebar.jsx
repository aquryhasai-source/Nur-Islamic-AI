export default function Sidebar({ isOpen, onClose, unlocked, lightMode, setLightMode, onNavigate, textSize = 1 }) {
  const gold      = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim   = lightMode ? "rgba(122,88,16,0.5)"    : "rgba(201,168,76,0.45)";
  const goldFaint = lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const goldBdr   = lightMode ? "rgba(122,88,16,0.15)"   : "rgba(201,168,76,0.12)";
  const textClr   = lightMode ? "rgba(26,15,0,0.85)"     : "rgba(255,255,240,0.88)";
  const textDim   = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.35)";
  const bg        = lightMode ? "linear-gradient(180deg,#fdf8ed,#f6edda)" : "linear-gradient(180deg,#0d1f14,#081510)";
  const headerBg  = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const overlayBg = lightMode ? "rgba(0,0,0,0.3)"        : "rgba(0,0,0,0.65)";

  const NAV_ITEMS = [
    { key:"home",     icon:"🏠", label:"Home",             sub:"Return to NŪR chat"             },
    { key:"profile",  icon:"👤", label:"Profile",           sub:"Usage · Name · Text size"       },
    { key:"bookmarks",icon:"🔖", label:"Bookmarks",         sub:"Saved ayahs & hadiths"          },
    { key:"qibla",    icon:"🧭", label:"Qibla Direction",   sub:"Find the direction of prayer"   },
    { key:"calendar", icon:"📅", label:"Islamic Calendar",  sub:"Hijri dates & events"           },
    { key:"prayers",  icon:"🕌", label:"Prayer Times",      sub:"Daily salah times & alarms"     },
    { key:"recent",   icon:"🕐", label:"Chat History",      sub:"Your recent questions"          },
    { key:"getpro",   icon:"⭐", label:"Get Pro",           sub:"Remove ads · Unlimited chat"    },
    { key:"feedback", icon:"💬", label:"Feedback & Support", sub:"Report issue · Suggestions"    },
    { key:"privacy",  icon:"🔒", label:"Privacy Policy",    sub:"How we handle your data"        },
    { key:"terms",    icon:"📋", label:"Terms of Use",      sub:"Disclaimer · Terms"             },
    { key:"about",    icon:"ℹ️",  label:"About",             sub:"Version · Disclaimer"           },
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
        <div style={{ flex:1, overflowY:"auto", padding:"10px 12px 20px" }}>
          {NAV_ITEMS.map(({ key, icon, label, sub }) => (
            <button key={key}
              onClick={() => { onNavigate(key); onClose(); }}
              style={{ display:"flex", alignItems:"center", gap:"14px", width:"100%", padding:"13px 14px", marginBottom:"4px", background:"transparent", border:`1px solid transparent`, borderRadius:"12px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = goldFaint; e.currentTarget.style.borderColor = goldBdr; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
              <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>
                {icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:textClr, fontSize:`${14*textSize}px`, fontWeight:700, lineHeight:1.3 }}>{label}</div>
                <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginTop:"2px" }}>{sub}</div>
              </div>
              {key === "getpro" && !unlocked
                ? <div style={{ background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, color:lightMode?"#fff":"#0d1f14", fontSize:`${9*textSize}px`, fontWeight:800, letterSpacing:"1px", padding:"3px 8px", borderRadius:"10px", flexShrink:0 }}>AD‑FREE</div>
                : key === "getpro" && unlocked
                ? <div style={{ color:"rgba(76,175,132,0.7)", fontSize:`${11*textSize}px`, flexShrink:0 }}>✦</div>
                : <div style={{ color:goldDim, fontSize:"16px", flexShrink:0 }}>›</div>
              }
            </button>
          ))}
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
