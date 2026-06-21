import { useState, useEffect } from "react";
import { PROXY_URL, KEYS } from "./utils.js";

const LS_URL = "https://yasirhaquecreativelabs.lemonsqueezy.com/checkout/buy/c19a2e49-4416-4cf7-b9b5-2f8140da3962";
const RZ_URL = "https://rzp.io/rzp/RxurFTj";

const PRO_FEATURES = [
  { icon: "🚫", label: "Remove all ads — clean experience forever" },
  { icon: "✦",  label: "Unlimited AI reflections daily" },
  { icon: "⭐", label: "Support NŪR's ongoing development" },
  { icon: "🌙", label: "Priority access to new features" },
];

export default function GetProPage({ onBack, onUnlocked, setUnlocked, setRemaining, deviceId, lightMode }) {
  const [isIndia,      setIsIndia]      = useState(false);
  const [unlockCode,   setUnlockCode]   = useState("");
  const [unlockStatus, setUnlockStatus] = useState("idle");
  const [unlockError,  setUnlockError]  = useState("");

  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)" : "rgba(201,168,76,0.5)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)" : "rgba(201,168,76,0.07)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.22)" : "rgba(201,168,76,0.22)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"   : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.45)"   : "rgba(255,255,255,0.4)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(d => { if (d.country_code === "IN") setIsIndia(true); })
      .catch(() => {});
  }, []);

  const redeem = async () => {
    if (!unlockCode.trim()) return;
    setUnlockStatus("loading"); setUnlockError("");
    try {
      const res  = await fetch(PROXY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Get Pro</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"0 0 40px" }}>

        {/* Hero */}
        <div style={{ padding:"32px 24px 28px", textAlign:"center", borderBottom:`1px solid ${goldBdr}` }}>
          <div style={{ fontSize:"44px", color:gold, fontWeight:900, letterSpacing:"6px", marginBottom:"4px" }}>NŪR</div>
          <div style={{ color:goldDim, fontSize:"11px", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"20px" }}>Ad‑Free · Unlimited</div>

          <div style={{ fontSize:"18px", color:gold, fontFamily:"Georgia,serif", marginBottom:"6px" }}>
            طَلَبُ الْعِلْمِ فَرِيضَةٌ
          </div>
          <div style={{ color:textDim, fontSize:"11px", letterSpacing:"1px", marginBottom:"8px" }}>
            "Seeking knowledge is an obligation" — Ibn Mājah
          </div>
          <div style={{ color:textDim, fontSize:`${12 * 1}px`, lineHeight:1.7, marginBottom:"28px", maxWidth:"280px", margin:"0 auto 28px" }}>
            All features are free. Pro removes ads and lifts the daily chat limit — a one-time payment to support NŪR forever.
          </div>

          {/* Price + CTA */}
          <a href={payUrl} target="_blank" rel="noreferrer"
            style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", maxWidth:"300px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, borderRadius:"18px", color:lightMode?"#fff":"#0d1f14", padding:"18px 24px", fontSize:"18px", fontWeight:800, textDecoration:"none", margin:"0 auto", boxShadow:`0 6px 28px ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.28)"}`, fontFamily:"Nunito,sans-serif" }}>
            <span>🌙 Go Ad‑Free — {price}</span>
            <span style={{ fontSize:"11px", fontWeight:400, opacity:0.8 }}>{payNote}</span>
          </a>
          <div style={{ color:textDim, fontSize:"11px", marginTop:"10px" }}>One-time payment · Yours forever</div>
        </div>

        {/* Feature list */}
        <div style={{ padding:"24px 20px" }}>
          <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"16px" }}>What Pro gives you</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {PRO_FEATURES.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
                <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>
                  {f.icon}
                </div>
                <span style={{ color:textClr, fontSize:"14px", fontWeight:600 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:"1px", background:goldBdr, margin:"0 20px 24px" }}/>

        {/* Code entry */}
        <div style={{ padding:"0 20px 20px" }}>
          <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>Already paid? Enter your code</div>
          <input
            value={unlockCode}
            onChange={e => setUnlockCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && redeem()}
            placeholder="NUR-XXXX-XXXX-XXXX"
            maxLength={40}
            style={{ width:"100%", background:lightMode?"rgba(255,255,255,0.55)":"rgba(255,255,255,0.05)", border:`1px solid ${unlockStatus==="error"?"#e07b54":goldBdr}`, borderRadius:"12px", padding:"13px 16px", color:textClr, fontSize:"15px", fontFamily:"monospace", letterSpacing:"2px", outline:"none", boxSizing:"border-box", marginBottom:"10px" }}
          />
          {unlockError && <div style={{ color:"#e07b54", fontSize:"12px", marginBottom:"10px" }}>{unlockError}</div>}
          {unlockStatus === "success"
            ? <div style={{ textAlign:"center", color:"#4caf84", fontSize:"15px", fontWeight:700, padding:"12px" }}>✦ Unlocked! Jazakallahu Khairan 🌙</div>
            : (
              <button onClick={redeem} disabled={!unlockCode.trim() || unlockStatus==="loading"}
                style={{ width:"100%", padding:"13px", borderRadius:"12px", background:unlockCode.trim()?`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`:"transparent", border:`1px solid ${goldBdr}`, color:unlockCode.trim()?lightMode?"#fff":"#0d1f14":goldDim, fontSize:"14px", fontWeight:700, cursor:unlockCode.trim()?"pointer":"not-allowed", fontFamily:"Nunito,sans-serif" }}>
                {unlockStatus==="loading" ? "Verifying…" : "Activate Pro Access"}
              </button>
            )
          }
        </div>

      </div>
    </div>
  );
}
