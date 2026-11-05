import { useSadaqahLink } from "./sadaqah.js";
import { trackEvent } from "./analytics.js";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

export default function SupportPage({ onBack, onOpenSidebar, lightMode, textSize = 1, navigateTo }) {
  const url = useSadaqahLink();
  const docked = useMedia(DOCK_QUERY);

  const gold = "var(--gold)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const btnText = "var(--onGold)";
  const btnBg    = "var(--goldFill)";

  if (docked) {
    const ts = textSize || 1;
    const Ico = ({ size = 18, children }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    );
    const heart = <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>;
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
          <div className="nur-ph-title">
            <span>Support NŪR</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"13.5px", fontWeight:500, color:"var(--dim)" }}>Free for everyone, kept running by gifts of any size.</span></span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.25fr) minmax(0,1fr)", gap:"22px", alignItems:"start" }}>
            <section className="card" style={{ padding:"44px 32px 36px", textAlign:"center" }}>
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"60px", height:"60px", borderRadius:"18px", border:"1px solid var(--lineSoft)", background:goldFaint, color:gold }}><Ico size={28}>{heart}</Ico></span>
              <h2 className="h2" style={{ marginTop:"18px", fontSize:`${30*ts}px` }}>Sadaqah Jariyah</h2>
              <div style={{ width:"44px", height:"1px", margin:"18px auto 20px", background:`linear-gradient(90deg,transparent,${gold},transparent)` }}/>
              <div style={{ margin:"0 auto", maxWidth:"420px", fontSize:`${15*ts}px`, fontWeight:500, lineHeight:1.8, color:textClr }}>
                NŪR is free to use. If it has benefited you, you can help keep it running for everyone with a gift of any amount.
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer"
                  onClick={() => trackEvent("sadaqah_click", { source:"support_page" })}
                  style={{ margin:"30px auto 0", display:"flex", alignItems:"center", justifyContent:"center", gap:"9px", width:"100%", maxWidth:"300px", height:"52px", boxSizing:"border-box", borderRadius:"16px", background:btnBg, color:btnText, fontSize:`${16*ts}px`, fontWeight:700, textDecoration:"none", boxShadow:"0 10px 30px -12px var(--gold)" }}>
                  <Ico size={18}>{heart}</Ico>Give sadaqah
                </a>
              ) : (
                <div style={{ margin:"30px auto 0", color:textDim, fontSize:`${13*ts}px` }}>Coming soon.</div>
              )}
              <div style={{ margin:"22px auto 0", maxWidth:"400px", fontSize:`${12.5*ts}px`, fontWeight:500, lineHeight:1.75, color:"var(--faint)" }}>
                Optional. Your contribution goes toward NŪR's running costs (servers and AI), not to an outside charity. All features stay free.
              </div>
            </section>
            <div style={{ display:"flex", flexDirection:"column", gap:"18px", minWidth:0 }}>
              <section className="card" style={{ padding:"22px 24px" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"9px", color:gold }}><Ico size={16}><path d="M5 5.5A2 2 0 0 1 7 3.5h11v15H7a2 2 0 0 0-2 2v-15Z"/><path d="M5 20.5h13"/></Ico><span className="lbl">A reminder</span></span>
                <div style={{ marginTop:"14px", fontSize:`${14*ts}px`, fontWeight:500, lineHeight:1.8, color:textClr }}>The Prophet ﷺ taught that when a person passes away, their deeds end except three: ongoing charity, knowledge that is benefited from, and a righteous child who prays for them.</div>
                <div style={{ marginTop:"10px", fontSize:`${12.5*ts}px`, fontWeight:600, color:gold }}>— Ṣaḥīḥ Muslim</div>
              </section>
              <button className="pc" onClick={() => navigateTo && navigateTo("getpro")}
                style={{ display:"flex", alignItems:"center", gap:"12px", width:"100%", height:"54px", padding:"0 18px", borderRadius:"14px", border:"1px solid var(--line)", background:goldFaint, color:gold, fontFamily:"inherit", fontSize:`${14*ts}px`, fontWeight:700, cursor:"pointer", textAlign:"left" }}>
                <Ico size={18}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8L12 3.5Z"/></Ico>
                <span style={{ flex:1 }}>Looking to remove ads? See Pro</span>
                <Ico size={16}><path d="m9 6 6 6-6 6"/></Ico>
              </button>
            </div>
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
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Support NŪR</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
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
            style={{ display:"block", maxWidth:"300px", margin:"0 auto 18px", padding:"16px", borderRadius:"50px", background:btnBg, color:btnText, fontSize:`${17*textSize}px`, fontWeight:800, textDecoration:"none", boxShadow:`0 6px 28px ${"var(--line)"}` }}>
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
