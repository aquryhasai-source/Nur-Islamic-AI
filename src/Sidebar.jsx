import { useState, useEffect } from "react";
import { saveProfile, KEYS, PROXY_URL, DAILY_LIMIT } from "./utils.js";

export default function Sidebar({
  isOpen, onClose, remaining, unlocked, setUnlocked, setRemaining,
  profile, setProfile, deviceId, onNavigate, onQuranSurah, onHadithTopic,
  lightMode, setLightMode,
}) {
  const [name,         setName]         = useState(profile.name || "");
  const [yearOfBirth,  setYearOfBirth]  = useState(profile.yearOfBirth || "");
  const [unlockCode,   setUnlockCode]   = useState("");
  const [unlockStatus, setUnlockStatus] = useState("idle");
  const [unlockError,  setUnlockError]  = useState("");

  useEffect(() => {
    setName(profile.name || "");
    setYearOfBirth(profile.yearOfBirth || "");
  }, [profile]);

  const persistProfile = () => {
    const p = { name: name.trim(), yearOfBirth: yearOfBirth.trim() };
    saveProfile(p);
    setProfile(p);
  };

  const redeemCode = async () => {
    if (!unlockCode.trim()) return;
    setUnlockStatus("loading"); setUnlockError("");
    try {
      const res  = await fetch(PROXY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, unlock_code: unlockCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.unlocked) {
        setUnlockError(data.error || "Invalid code"); setUnlockStatus("error");
      } else {
        localStorage.setItem(KEYS.UNLOCKED, "true");
        setUnlocked(true); setRemaining(999); setUnlockStatus("success");
      }
    } catch { setUnlockError("Connection error. Try again."); setUnlockStatus("error"); }
  };

  const usedToday = unlocked ? 0 : DAILY_LIMIT - remaining;
  const pct       = Math.min((usedToday / DAILY_LIMIT) * 100, 100);
  const barColor  = remaining <= 3 ? "#e07b54" : remaining <= 7 ? "#d4a942" : "#4caf84";

  // ── Theme-aware colours ──────────────────────────────────────────────────
  const bg      = lightMode
    ? "linear-gradient(180deg,#fdf8ed 0%,#f6edda 100%)"
    : "linear-gradient(180deg,#0d1f14 0%,#081510 100%)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const border   = lightMode ? "rgba(122,88,16,0.15)"   : "rgba(201,168,76,0.12)";
  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.5)"    : "rgba(201,168,76,0.45)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.88)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.4)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.05)";
  const overlayBg = lightMode ? "rgba(0,0,0,0.3)"       : "rgba(0,0,0,0.6)";

  const inputStyle = {
    width:"100%", background:inputBg,
    border:`1px solid ${goldBdr}`, borderRadius:"10px",
    padding:"10px 12px", color:textClr, fontSize:"14px",
    outline:"none", fontFamily:"Nunito, sans-serif",
  };
  const labelStyle = {
    color:goldDim, fontSize:"10px",
    letterSpacing:"2px", textTransform:"uppercase", marginBottom:"8px", display:"block",
  };
  const divider = <div style={{ height:"1px", background:border, margin:"18px 0" }}/>;

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{ position:"fixed", inset:0, background:overlayBg, zIndex:50, backdropFilter:"blur(4px)" }}/>
      )}

      <div style={{
        position:"fixed", top:0, left:0, bottom:0,
        width:"min(82vw, 320px)",
        background: bg,
        borderRight:`1px solid ${border}`,
        zIndex:51, overflowY:"auto",
        transition:"transform 0.3s ease",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
      }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:`1px solid ${border}`, position:"sticky", top:0, background:headerBg, backdropFilter:"blur(10px)", zIndex:1 }}>
          <div style={{ color:gold, fontSize:"17px", letterSpacing:"2px", fontVariant:"small-caps", fontWeight:700 }}>NŪR</div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {/* Dark / Light toggle */}
            <button
              onClick={() => setLightMode(m => !m)}
              title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
              style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"20px", padding:"5px 10px", cursor:"pointer", fontSize:"14px", lineHeight:1, display:"flex", alignItems:"center", gap:"5px" }}>
              <span>{lightMode ? "🌙" : "☀️"}</span>
              <span style={{ color:goldDim, fontSize:"10px", fontWeight:700 }}>{lightMode ? "Dark" : "Light"}</span>
            </button>
            <button onClick={onClose} style={{ background:"none", border:"none", color:goldDim, fontSize:"20px", cursor:"pointer", lineHeight:1 }}>✕</button>
          </div>
        </div>

        <div style={{ padding:"16px 18px" }}>

          {/* ── Profile ── */}
          <span style={labelStyle}>My Profile</span>
          <input value={name} onChange={e => setName(e.target.value)} onBlur={persistProfile}
            placeholder="Your name (optional)" style={{ ...inputStyle, marginBottom:"8px" }}/>
          <input value={yearOfBirth} onChange={e => setYearOfBirth(e.target.value)} onBlur={persistProfile}
            placeholder="Year of birth (e.g. 2005)" type="number" min="1900" max={new Date().getFullYear()}
            style={inputStyle}/>
          {yearOfBirth && (() => {
            const age = new Date().getFullYear() - parseInt(yearOfBirth, 10);
            if (isNaN(age) || age <= 0) return null;
            const label = age < 13 ? "🌱 Child mode" : age < 18 ? "📖 Teen mode" : "✦ Standard mode";
            return <div style={{ color:goldDim, fontSize:"11px", marginTop:"6px" }}>{label}</div>;
          })()}

          {divider}

          {/* ── Usage ── */}
          <span style={labelStyle}>Today's Usage</span>
          {unlocked ? (
            <div style={{ color:"#4caf84", fontSize:"13px", fontWeight:600 }}>✦ Lifetime Access — Unlimited</div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                <span style={{ color:textDim, fontSize:"13px" }}>{usedToday} of {DAILY_LIMIT} used</span>
                <span style={{ color: remaining <= 3 ? "#e07b54" : goldDim, fontSize:"13px", fontWeight:600 }}>{remaining} left</span>
              </div>
              <div style={{ height:"4px", background:lightMode?"rgba(0,0,0,0.08)":"rgba(255,255,255,0.07)", borderRadius:"4px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:"4px", transition:"width 0.4s" }}/>
              </div>
            </>
          )}

          {divider}

          {/* ── Upgrade CTA (always visible if not unlocked) ── */}
          {!unlocked && (
            <>
              <span style={labelStyle}>Get Full Access</span>
              <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"14px", marginBottom:"12px" }}>
                <div style={{ color:gold, fontSize:"13px", fontWeight:700, marginBottom:"4px" }}>🌙 Unlock NŪR Pro</div>
                <div style={{ color:textDim, fontSize:"12px", lineHeight:1.6, marginBottom:"12px" }}>Unlimited AI reflections · Bookmarks · Streaks</div>
                <div style={{ display:"flex", gap:"8px" }}>
                  <a href="https://yasirhaquecreativelabs.lemonsqueezy.com/checkout/buy/c19a2e49-4416-4cf7-b9b5-2f8140da3962"
                    target="_blank" rel="noreferrer"
                    style={{ flex:1, textAlign:"center", padding:"9px 8px", borderRadius:"10px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, color:lightMode?"#fff":"#0d1f14", fontSize:"12px", fontWeight:800, textDecoration:"none", fontFamily:"Nunito,sans-serif" }}>
                    $2.99 →
                  </a>
                  <a href="https://rzp.io/rzp/RxurFTj"
                    target="_blank" rel="noreferrer"
                    style={{ flex:1, textAlign:"center", padding:"9px 8px", borderRadius:"10px", background:lightMode?"rgba(122,88,16,0.1)":"rgba(201,168,76,0.08)", border:`1px solid ${goldBdr}`, color:gold, fontSize:"12px", fontWeight:700, textDecoration:"none", fontFamily:"Nunito,sans-serif" }}>
                    ₹299 →
                  </a>
                </div>
              </div>

              {/* Unlock code */}
              <span style={labelStyle}>Have a Code?</span>
              <input
                value={unlockCode}
                onChange={e => setUnlockCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && redeemCode()}
                placeholder="NUR-XXXX-XXXX-XXXX"
                maxLength={40}
                style={{ ...inputStyle, letterSpacing:"1.5px", fontFamily:"monospace", marginBottom:"8px",
                  borderColor: unlockStatus === "error" ? "#e07b54" : goldBdr }}
              />
              {unlockError && <div style={{ color:"#e07b54", fontSize:"12px", marginBottom:"8px" }}>{unlockError}</div>}
              {unlockStatus === "success" ? (
                <div style={{ color:"#4caf84", fontSize:"13px", fontWeight:600 }}>✦ Unlocked! Jazakallahu Khairan 🌙</div>
              ) : (
                <button onClick={redeemCode} disabled={!unlockCode.trim() || unlockStatus === "loading"}
                  style={{ width:"100%", padding:"10px", borderRadius:"10px",
                    background: unlockCode.trim() ? `linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})` : goldFaint,
                    border:`1px solid ${goldBdr}`,
                    color: unlockCode.trim() ? (lightMode?"#fff":"#0d1f14") : goldDim,
                    fontSize:"13px", cursor: unlockCode.trim() ? "pointer" : "not-allowed",
                    fontWeight:700, fontFamily:"Nunito,sans-serif" }}>
                  {unlockStatus === "loading" ? "Verifying..." : "Activate"}
                </button>
              )}
              {divider}
            </>
          )}

          {/* ── Navigate ── */}
          <span style={labelStyle}>Browse</span>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"6px" }}>
            {[
              { key:"quran",  icon:"📖", label:"Quran", sub:"114 Surahs · 6 translations" },
              { key:"hadith", icon:"📜", label:"Hadith", sub:"Bukhari · Muslim · Abu Dawud…" },
              { key:"saved",  icon:"🔖", label:"Bookmarks", sub:"Your saved ayahs & hadiths" },
            ].map(({ key, icon, label, sub }) => (
              <button key={key} onClick={() => onNavigate(key)}
                style={{ display:"flex", alignItems:"center", gap:"12px", width:"100%", padding:"11px 12px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"10px", cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:"18px" }}>{icon}</span>
                <div>
                  <div style={{ color:textClr, fontSize:"13px", fontWeight:700 }}>{label}</div>
                  <div style={{ color:textDim, fontSize:"11px", marginTop:"1px" }}>{sub}</div>
                </div>
              </button>
            ))}
          </div>

          {divider}

          {/* ── About ── */}
          <div style={{ textAlign:"center", paddingBottom:"12px" }}>
            <div style={{ color:gold, fontSize:"19px", marginBottom:"4px" }}>بِسْمِ اللّٰهِ</div>
            <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"1px" }}>NŪR v2.0 · Islamic Knowledge Assistant</div>
            <div style={{ color:textDim, fontSize:"10px", marginTop:"5px", lineHeight:1.6 }}>
              Always consult a qualified scholar<br/>for personal rulings · Allahu A'lam
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
