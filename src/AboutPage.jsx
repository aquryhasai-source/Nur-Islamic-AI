export default function AboutPage({ onBack, lightMode, textSize = 1 }) {
  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";

  const INFO = [
    { label:"Version",       value:"2.1.0" },
    { label:"Quran API",     value:"AlQuran.cloud" },
    { label:"Hadith API",    value:"fawazahmed0 / jsDelivr CDN" },
    { label:"Prayer times",  value:"AlAdhan.com" },
    { label:"AI engine",     value:"Powered by Claude" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>About</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 20px 48px" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ fontSize:"52px", color:gold, fontWeight:900, letterSpacing:"8px", marginBottom:"6px" }}>NŪR</div>
          <div style={{ color:goldDim, fontSize:"11px", letterSpacing:"4px", textTransform:"uppercase" }}>Islamic Knowledge Assistant</div>
          <div style={{ width:"40px", height:"1px", background:`linear-gradient(90deg,transparent,${gold},transparent)`, margin:"18px auto" }}/>
          <div style={{ color:gold, fontSize:`${22 * textSize}px`, fontFamily:"Georgia,serif", marginBottom:"6px" }}>
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
          <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontFamily:"Georgia,serif", marginBottom:"4px" }}>وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ</div>
          <div style={{ color:textDim, fontSize:"11px" }}>"My success is only through Allah" — Surah Hud 11:88</div>
        </div>

      </div>
    </div>
  );
}
