import { useState, useEffect } from "react";
import { PROXY_URL, KEYS, deviceHeaders } from "./utils.js";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

const LS_URL = "https://yasirhaquecreativelabs.lemonsqueezy.com/checkout/buy/c19a2e49-4416-4cf7-b9b5-2f8140da3962";
const RZ_URL = "https://rzp.io/rzp/RxurFTj";

const PRO_FEATURES = [
  { icon: "🚫", svg: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17ZM6 6l12 12", label: "Remove all ads — clean experience forever" },
  { icon: "✦",  svg: "M12 12c-1.5-2.2-3-3.5-4.8-3.5a3.5 3.5 0 1 0 0 7c1.8 0 3.3-1.3 4.8-3.5Zm0 0c1.5 2.2 3 3.5 4.8 3.5a3.5 3.5 0 1 0 0-7c-1.8 0-3.3 1.3-4.8 3.5Z", label: "Unlimited AI reflections daily" },
  { icon: "⭐", svg: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z", label: "Support NŪR's ongoing development" },
  { icon: "🌙", svg: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z", label: "Priority access to new features" },
];

export default function GetProPage({ onBack, onOpenSidebar, onUnlocked, setUnlocked, setRemaining, deviceId, lightMode, textSize = 1 }) {
  const [isIndia,      setIsIndia]      = useState(false);
  const [unlockCode,   setUnlockCode]   = useState("");
  const [unlockStatus, setUnlockStatus] = useState("idle");
  const [unlockError,  setUnlockError]  = useState("");
  const docked = useMedia(DOCK_QUERY);   // website view

  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldFaint = "var(--chip)";
  const goldBdr = "var(--line)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const cardBg = "var(--panel)";

  useEffect(() => {
    // Choose the Indian (Razorpay) checkout from the browser's own timezone — no third-party IP lookup.
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === "Asia/Calcutta" || tz === "Asia/Kolkata") setIsIndia(true);
    } catch {}
  }, []);

  const redeem = async () => {
    if (!unlockCode.trim()) return;
    setUnlockStatus("loading"); setUnlockError("");
    try {
      const res  = await fetch(PROXY_URL, {
        method: "POST", headers: deviceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ device_id: deviceId, unlock_code: unlockCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.unlocked) {
        setUnlockError(data.error || "Invalid code");
        setUnlockStatus("error");
      } else {
        localStorage.setItem(KEYS.UNLOCKED, "true");
        setUnlocked(true);
        setRemaining(999);
        setUnlockStatus("success");
        setTimeout(() => onBack(), 1800);
      }
    } catch {
      setUnlockError("Connection error. Try again.");
      setUnlockStatus("error");
    }
  };

  const payUrl  = isIndia ? RZ_URL  : LS_URL;
  const price   = isIndia ? "₹299"  : "$2.99";
  const payNote = isIndia ? "UPI · Cards · Net Banking · Wallets" : "Cards · PayPal · Worldwide";


  // ── Website view (>=1024px): two-column layout per the approved desktop design ──
  if (docked) {
    const fs = n => `${n*textSize}px`;
    const filled = !!unlockCode.trim();
    const Ico = ({ d, size=18, sw=1.8, children }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d ? <path d={d}/> : children}</svg>
    );
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <style>{`
          .gp-grid{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:20px;align-items:start}
          .gp-left{order:1}.gp-right{order:2}
          @media (max-width:1279px){.gp-grid{grid-template-columns:minmax(0,1fr)}.gp-right{order:0}}
          .gp-cta:hover{filter:brightness(1.05)}
          .gp-in:focus{border-color:var(--gold)!important}
        `}</style>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", padding:"12px 16px", flexShrink:0 }}>
          <div className="nur-ph-title" style={{ flex:1 }}>
            <span>Get Pro</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:500, color:"var(--dim)" }}>One payment. No ads, no daily limit, yours for good.</span></span>
          </div>
        </div>

        <div className="msgscroll" style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          <div className="gp-grid">
            <div className="gp-left" style={{ display:"flex", flexDirection:"column", gap:"20px", minWidth:0 }}>
              <div>
                <span className="lbl">What Pro gives you</span>
                <div style={{ marginTop:"12px", display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:"16px" }}>
                  {PRO_FEATURES.map((f, i) => (
                    <div key={i} className="card" style={{ display:"flex", alignItems:"flex-start", gap:"14px", padding:"18px 20px" }}>
                      <span style={{ flex:"none", display:"flex", alignItems:"center", justifyContent:"center", width:"38px", height:"38px", borderRadius:"11px", border:"1px solid var(--lineSoft)", background:goldFaint, color:gold }}><Ico d={f.svg} size={20}/></span>
                      <span style={{ fontSize:fs(14.5), fontWeight:600, lineHeight:1.5, color:textClr }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <section className="card" style={{ overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 140px 140px", alignItems:"center", height:"46px", background:"var(--panel2)" }}>
                  <span className="lbl" style={{ padding:"0 20px" }}>Compare</span>
                  <span className="lbl" style={{ textAlign:"center" }}>Free</span>
                  <span className="lbl" style={{ textAlign:"center", color:gold }}>Pro</span>
                </div>
                {[["Prayer times, Qibla, calendar","Included","Included"],["Quran, Hadith, bookmarks","Included","Included"],["AI reflections","Daily limit","Unlimited"],["Advertising","Shown","None"]].map(([a,b,c]) => (
                  <div key={a} style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 140px 140px", alignItems:"center", minHeight:"46px", borderTop:"1px solid var(--lineSoft)", fontSize:fs(13.5) }}>
                    <span style={{ padding:"0 20px", fontWeight:600 }}>{a}</span>
                    <span style={{ textAlign:"center", color:textDim }}>{b}</span>
                    <span style={{ textAlign:"center", fontWeight:700, color:gold }}>{c}</span>
                  </div>
                ))}
              </section>
            </div>
            <div className="gp-right" style={{ display:"flex", flexDirection:"column", gap:"20px", minWidth:0 }}>
            {/* Hero */}
            <section className="card" style={{ padding:"34px 32px 30px", textAlign:"center", background:"linear-gradient(160deg, var(--active), var(--panel))" }}>
              <div style={{ fontFamily:"var(--font-head)", fontWeight:700, fontSize:fs(46), lineHeight:1, letterSpacing:"8px", color:gold, paddingLeft:"8px" }}>NŪR</div>
              <div className="lbl" style={{ marginTop:"12px", letterSpacing:"3px" }}>Ad‑Free · Unlimited</div>
              <div lang="ar" dir="rtl" style={{ marginTop:"26px", fontFamily:"var(--font-ar)", fontSize:fs(36), lineHeight:1.5, color:gold }}>طَلَبُ الْعِلْمِ فَرِيضَةٌ</div>
              <div style={{ marginTop:"4px", fontSize:fs(12.5), fontWeight:500, color:"var(--faint)" }}>"Seeking knowledge is an obligation" — Ibn Mājah</div>
              <div style={{ margin:"20px auto 0", maxWidth:"400px", fontSize:fs(14), fontWeight:500, lineHeight:1.75, color:textDim }}>
                All features are free. Pro removes ads and lifts the daily chat limit — a one-time payment to support NŪR forever.
              </div>
              <a href={payUrl} target="_blank" rel="noreferrer" className="gp-cta"
                style={{ margin:"28px auto 0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"4px", width:"100%", maxWidth:"340px", minHeight:"74px", boxSizing:"border-box", borderRadius:"20px", background:"var(--goldFill)", color:"var(--onGold)", textDecoration:"none", boxShadow:"0 10px 30px -12px var(--gold)", fontFamily:"var(--font-body)" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"9px", fontSize:fs(18), fontWeight:700 }}><Ico d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>Go Ad‑Free — {price}</span>
                <span style={{ fontSize:fs(11.5), fontWeight:500, opacity:0.8 }}>{payNote}</span>
              </a>
              <div style={{ marginTop:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"7px", fontSize:fs(12), fontWeight:500, color:"var(--faint)" }}>
                <Ico size={14}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></Ico>
                One-time payment · Yours forever
              </div>
            </section>

              {/* Code entry */}
              <section className="card" style={{ padding:"22px 24px" }}>
                <span className="lbl">Already paid? Enter your code</span>
                <label style={{ display:"block", marginTop:"14px" }}>
                  <span style={{ position:"absolute", width:"1px", height:"1px", overflow:"hidden", clip:"rect(0 0 0 0)" }}>Unlock code</span>
                  <input className="gp-in"
                    value={unlockCode}
                    onChange={e => setUnlockCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && redeem()}
                    placeholder="NUR-XXXX-XXXX-XXXX"
                    maxLength={40}
                    style={{ boxSizing:"border-box", width:"100%", height:"48px", padding:"0 16px", borderRadius:"13px", border:`1px solid ${unlockStatus==="error"?"var(--warn)":goldBdr}`, background:"var(--panel2)", color:textClr, fontFamily:"ui-monospace,'SF Mono',Menlo,monospace", fontSize:fs(15), fontWeight:600, letterSpacing:"2px", outline:"none" }}
                  />
                </label>
                {unlockError && <div style={{ marginTop:"10px", fontSize:fs(12.5), fontWeight:600, color:"var(--warn)" }}>{unlockError}</div>}
                {unlockStatus === "success" ? (
                  <div style={{ marginTop:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"9px", padding:"12px", fontSize:fs(15), fontWeight:700, color:"var(--green)" }}>
                    <Ico d="m5 12.5 4.5 4.5L19 7.5" sw={2.2}/>Unlocked! Jazakallahu Khairan
                  </div>
                ) : (
                  <button className="pc" onClick={redeem} disabled={!filled || unlockStatus==="loading"}
                    style={{ marginTop:"12px", width:"100%", height:"46px", borderRadius:"13px", border:`1px solid ${filled?"transparent":goldBdr}`, background:filled?"var(--goldFill)":"transparent", color:filled?"var(--onGold)":"var(--faint)", fontFamily:"var(--font-body)", fontSize:fs(14), fontWeight:700, cursor:filled?"pointer":"not-allowed" }}>
                    {unlockStatus==="loading" ? "Verifying…" : "Activate Pro Access"}
                  </button>
                )}
              </section>
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
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Get Pro</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"0 0 40px" }}>

        {/* Hero */}
        <div style={{ padding:"32px 24px 28px", textAlign:"center", borderBottom:`1px solid ${goldBdr}` }}>
          <div style={{ fontSize:`${44*textSize}px`, color:gold, fontWeight:900, letterSpacing:"6px", marginBottom:"4px" }}>NŪR</div>
          <div style={{ color:goldDim, fontSize:`${11*textSize}px`, letterSpacing:"3px", textTransform:"uppercase", marginBottom:"20px" }}>Ad‑Free · Unlimited</div>

          <div style={{ fontSize:`${18*textSize}px`, color:gold, fontFamily:"var(--font-ar)", marginBottom:"6px" }}>
            طَلَبُ الْعِلْمِ فَرِيضَةٌ
          </div>
          <div style={{ color:textDim, fontSize:`${11*textSize}px`, letterSpacing:"1px", marginBottom:"8px" }}>
            "Seeking knowledge is an obligation" — Ibn Mājah
          </div>
          <div style={{ color:textDim, fontSize:`${12*textSize}px`, lineHeight:1.7, marginBottom:"28px", maxWidth:"280px", margin:"0 auto 28px" }}>
            All features are free. Pro removes ads and lifts the daily chat limit — a one-time payment to support NŪR forever.
          </div>

          <a href={payUrl} target="_blank" rel="noreferrer"
            style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", maxWidth:"300px", background:"var(--goldFill)", borderRadius:"18px", color:"var(--onGold)", padding:"18px 24px", fontSize:`${18*textSize}px`, fontWeight:800, textDecoration:"none", margin:"0 auto", boxShadow:`0 6px 28px ${"var(--line)"}`, fontFamily:"Nunito,sans-serif" }}>
            <span>🌙 Go Ad‑Free — {price}</span>
            <span style={{ fontSize:`${11*textSize}px`, fontWeight:400, opacity:0.8 }}>{payNote}</span>
          </a>
          <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginTop:"10px" }}>One-time payment · Yours forever</div>
        </div>

        {/* Feature list */}
        <div style={{ padding:"24px 20px" }}>
          <div style={{ color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"16px" }}>What Pro gives you</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {PRO_FEATURES.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
                <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"calc(18px * var(--ts, 1))", flexShrink:0 }}>
                  {f.icon}
                </div>
                <span style={{ color:textClr, fontSize:`${14*textSize}px`, fontWeight:600 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height:"1px", background:goldBdr, margin:"0 20px 24px" }}/>

        {/* Code entry */}
        <div style={{ padding:"0 20px 20px" }}>
          <div style={{ color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>Already paid? Enter your code</div>
          <input
            value={unlockCode}
            onChange={e => setUnlockCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && redeem()}
            placeholder="NUR-XXXX-XXXX-XXXX"
            maxLength={40}
            style={{ width:"100%", background:"var(--panel2)", border:`1px solid ${unlockStatus==="error"?"var(--warn)":goldBdr}`, borderRadius:"12px", padding:"13px 16px", color:textClr, fontSize:`${15*textSize}px`, fontFamily:"monospace", letterSpacing:"2px", outline:"none", boxSizing:"border-box", marginBottom:"10px" }}
          />
          {unlockError && <div style={{ color:"var(--warn)", fontSize:`${12*textSize}px`, marginBottom:"10px" }}>{unlockError}</div>}
          {unlockStatus === "success"
            ? <div style={{ textAlign:"center", color:"var(--green)", fontSize:`${15*textSize}px`, fontWeight:700, padding:"12px" }}>✦ Unlocked! Jazakallahu Khairan 🌙</div>
            : (
              <button onClick={redeem} disabled={!unlockCode.trim() || unlockStatus==="loading"}
                style={{ width:"100%", padding:"13px", borderRadius:"12px", background:unlockCode.trim()?"var(--goldFill)":"transparent", border:`1px solid ${goldBdr}`, color:unlockCode.trim()?"var(--onGold)":goldDim, fontSize:`${14*textSize}px`, fontWeight:700, cursor:unlockCode.trim()?"pointer":"not-allowed", fontFamily:"Nunito,sans-serif" }}>
                {unlockStatus==="loading" ? "Verifying…" : "Activate Pro Access"}
              </button>
            )
          }
        </div>

      </div>
    </div>
  );
}
