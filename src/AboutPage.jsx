import { useMedia, DOCK_QUERY } from "./useMedia.js";

export default function AboutPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const docked = useMedia(DOCK_QUERY);
  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const cardBg = "var(--panel)";

  const INFO = [
    { label:"Version",       value:"2.1.0" },
    { label:"Quran API",     value:"AlQuran.cloud" },
    { label:"Hadith API",    value:"fawazahmed0 / jsDelivr CDN" },
    { label:"Prayer times",  value:"AlAdhan.com" },
  ];

  if (docked) {
    const ts = textSize || 1;
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
          <div className="nur-ph-title">
            <span>About</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:500, color:"var(--dim)" }}>The app, where its content comes from, and a reminder.</span></span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:"22px", alignItems:"stretch" }}>
            <section className="card" style={{ padding:"48px 32px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
              <div style={{ fontFamily:"var(--font-head)", fontWeight:700, fontSize:`${56*ts}px`, lineHeight:1, letterSpacing:"9px", paddingLeft:"9px", color:gold }}>NŪR</div>
              <div className="lbl" style={{ marginTop:"14px", letterSpacing:"3px" }}>Islamic Knowledge Assistant</div>
              <div style={{ width:"44px", height:"1px", margin:"26px auto 24px", background:`linear-gradient(90deg,transparent,${gold},transparent)` }}/>
              <div lang="ar" dir="rtl" style={{ fontFamily:"var(--font-ar)", fontSize:`${34*ts}px`, lineHeight:1.6, color:gold }}>وَقُل رَّبِّ زِدْنِي عِلْمًا</div>
              <div style={{ marginTop:"6px", fontSize:`${13*ts}px`, fontWeight:500, color:"var(--faint)" }}>"My Lord, increase me in knowledge" — Surah Ta-Ha 20:114</div>
            </section>
            <div style={{ display:"flex", flexDirection:"column", gap:"22px", minWidth:0 }}>
              <section className="card" style={{ padding:"8px 24px" }}>
                {INFO.map(({ label, value }, i) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"16px", padding:"14px 0", borderTop: i ? "1px solid var(--lineSoft)" : "none" }}>
                    <span style={{ fontSize:`${13.5*ts}px`, fontWeight:500, color:textDim }}>{label}</span>
                    <span style={{ fontSize:`${13.5*ts}px`, fontWeight:700, color:textClr, textAlign:"right" }}>{value}</span>
                  </div>
                ))}
              </section>
              <section className="card" style={{ padding:"22px 26px" }}>
                <span className="lbl">Disclaimer</span>
                <div style={{ marginTop:"12px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.8, color:textDim }}>
                  NŪR is an educational tool designed to help explore Islamic knowledge. The AI responses are generated based on Quranic verses and authentic Hadith, but they should not replace the guidance of a qualified Islamic scholar (Alim).
                </div>
                <div style={{ marginTop:"12px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.8, color:textDim }}>
                  For personal religious rulings (fatwa), matters of fiqh, or any important Islamic decisions, always consult a qualified scholar. Allahu A'lam — Allah knows best.
                </div>
              </section>
            </div>
          </div>
          <div style={{ marginTop:"34px", textAlign:"center" }}>
            <div lang="ar" dir="rtl" style={{ fontFamily:"var(--font-ar)", fontSize:`${24*ts}px`, color:gold }}>وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ</div>
            <div style={{ marginTop:"4px", fontSize:`${12.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>"My success is only through Allah" — Surah Hud 11:88</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div className="nur-ph" style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button className="nur-ph-menu" onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>About</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 20px 48px" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ fontFamily:"var(--font-head)", fontSize:`${56*textSize}px`, color:gold, fontWeight:700, letterSpacing:"9px", paddingLeft:"9px", lineHeight:1.05, marginBottom:"8px" }}>NŪR</div>
          <div style={{ color:goldDim, fontSize:`${11*textSize}px`, letterSpacing:"4px", textTransform:"uppercase" }}>Islamic Knowledge Assistant</div>
          <div style={{ width:"40px", height:"1px", background:`linear-gradient(90deg,transparent,${gold},transparent)`, margin:"18px auto" }}/>
          <div style={{ color:gold, fontSize:`${22 * textSize}px`, fontFamily:"var(--font-ar)", marginBottom:"6px" }}>
            وَقُل رَّبِّ زِدْنِي عِلْمًا
          </div>
          <div style={{ color:textDim, fontSize:`${11 * textSize}px`, letterSpacing:"0.5px" }}>
            "My Lord, increase me in knowledge" — Surah Ta-Ha 20:114
          </div>
        </div>

        {/* Info rows */}
        <div style={{ marginBottom:"24px" }}>
          {INFO.map(({ label, value }) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", marginBottom:"6px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"12px" }}>
              <span style={{ color:textDim, fontSize:`${13 * textSize}px` }}>{label}</span>
              <span style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:600 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"18px" }}>
          <div style={{ color:gold, fontSize:`${12 * textSize}px`, fontWeight:700, marginBottom:"10px", letterSpacing:"1px" }}>DISCLAIMER</div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.85 }}>
            NŪR is an educational tool designed to help explore Islamic knowledge. The AI responses are generated based on Quranic verses and authentic Hadith, but they should not replace the guidance of a qualified Islamic scholar (Alim).
          </div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.85, marginTop:"10px" }}>
            For personal religious rulings (fatwa), matters of fiqh, or any important Islamic decisions, always consult a qualified scholar. Allahu A'lam — Allah knows best.
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontFamily:"var(--font-ar)", marginBottom:"4px" }}>وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ</div>
          <div style={{ color:textDim, fontSize:`${11*textSize}px` }}>"My success is only through Allah" — Surah Hud 11:88</div>
        </div>

      </div>
    </div>
  );
}
