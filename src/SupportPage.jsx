import { useSadaqahLink } from "./sadaqah.js";
import { trackEvent } from "./analytics.js";

export default function SupportPage({ onBack, onOpenSidebar, lightMode, textSize = 1, navigateTo }) {
  const url = useSadaqahLink();

  const gold     = lightMode ? "#7a5810"               : "#c9a84c";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"   : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"  : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"    : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.55)"    : "rgba(255,255,255,0.5)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)": "rgba(8,21,16,0.95)";
  const btnText  = lightMode ? "#fff" : "#0d1f14";
  const btnBg    = `linear-gradient(135deg,${gold},${lightMode ? "#a07020" : "#a8862e"})`;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Support NŪR</div>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 20px 48px", textAlign:"center" }}>
        <div style={{ fontSize:`${40*textSize}px`, marginBottom:"8px" }}>💛</div>
        <div style={{ color:gold, fontSize:`${20*textSize}px`, fontWeight:800, marginBottom:"6px" }}>Sadaqah Jariyah</div>
        <div style={{ width:"40px", height:"1px", background:`linear-gradient(90deg,transparent,${gold},transparent)`, margin:"14px auto 18px" }}/>

        <div style={{ color:textClr, fontSize:`${14*textSize}px`, lineHeight:1.8, maxWidth:"320px", margin:"0 auto 22px" }}>
          NŪR is free to use. If it has benefited you, you can help keep it running for everyone with a gift of any amount.
        </div>

        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px", maxWidth:"340px", margin:"0 auto 24px" }}>
          <div style={{ color:textDim, fontSize:`${12.5*textSize}px`, lineHeight:1.8 }}>
            The Prophet ﷺ taught that when a person passes away, their deeds end except three: ongoing charity, knowledge that is benefited from, and a righteous child who prays for them. (Ṣaḥīḥ Muslim)
          </div>
        </div>

        {url ? (
          <a href={url} target="_blank" rel="noreferrer"
            onClick={() => trackEvent("sadaqah_click", { source:"support_page" })}
            style={{ display:"block", maxWidth:"300px", margin:"0 auto 18px", padding:"16px", borderRadius:"50px", background:btnBg, color:btnText, fontSize:`${17*textSize}px`, fontWeight:800, textDecoration:"none", boxShadow:`0 6px 28px ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.28)"}` }}>
            Give sadaqah
          </a>
        ) : (
          <div style={{ color:textDim, fontSize:`${13*textSize}px`, marginBottom:"18px" }}>Coming soon.</div>
        )}

        <div style={{ color:textDim, fontSize:`${11.5*textSize}px`, lineHeight:1.8, maxWidth:"300px", margin:"0 auto 20px" }}>
          Optional. Your contribution goes toward NŪR's running costs (servers and AI), not to an outside charity. All features stay free.
        </div>

        <button onClick={() => navigateTo && navigateTo("getpro")}
          style={{ background:"none", border:"none", color:gold, fontSize:`${12.5*textSize}px`, cursor:"pointer", textDecoration:"underline", fontFamily:"Nunito,sans-serif" }}>
          Looking to remove ads? See Pro
        </button>
      </div>
    </div>
  );
}
