import { useState } from "react";
import { saveProfile, KEYS, DAILY_LIMIT } from "./utils.js";

const TEXT_SIZES = [
  { label: "S", value: 0.88, name: "Small"  },
  { label: "M", value: 1.0,  name: "Medium" },
  { label: "L", value: 1.14, name: "Large"  },
];

export default function ProfilePage({ onBack, profile, setProfile, remaining, unlocked, textSize, setTextSize, lightMode }) {
  const [name,        setName]        = useState(profile.name || "");
  const [yearOfBirth, setYearOfBirth] = useState(profile.yearOfBirth || "");

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.85)"     : "rgba(255,255,240,0.88)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.4)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.05)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";

  const persist = () => {
    const p = { name: name.trim(), yearOfBirth: yearOfBirth.trim() };
    saveProfile(p);
    setProfile(p);
  };

  const usedToday = unlocked ? 0 : DAILY_LIMIT - remaining;
  const pct       = Math.min((usedToday / DAILY_LIMIT) * 100, 100);
  const barColor  = remaining <= 3 ? "#e07b54" : remaining <= 7 ? "#d4a942" : "#4caf84";

  const age = yearOfBirth ? new Date().getFullYear() - parseInt(yearOfBirth, 10) : null;
  const ageLabel = age && age > 0 && age < 120
    ? age < 13 ? "🌱 Child mode active" : age < 18 ? "📖 Teen mode active" : "✦ Standard mode"
    : null;

  const inputStyle = {
    width:"100%", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"12px",
    padding:"12px 14px", color:textClr, fontSize:`${14 * textSize}px`,
    outline:"none", fontFamily:"Nunito,sans-serif", boxSizing:"border-box",
  };
  const labelStyle = {
    color:goldDim, fontSize:"10px", letterSpacing:"2px",
    textTransform:"uppercase", marginBottom:"10px", display:"block",
  };
  const divider = <div style={{ height:"1px", background:goldBdr, margin:"22px 0" }}/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Profile</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 40px" }}>

        {/* Usage */}
        <span style={labelStyle}>Today's Usage</span>
        <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"8px" }}>
          {unlocked ? (
            <div style={{ color:"#4caf84", fontSize:`${14 * textSize}px`, fontWeight:600 }}>✦ Lifetime Access — Unlimited</div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                <span style={{ color:textDim, fontSize:`${13 * textSize}px` }}>{usedToday} of {DAILY_LIMIT} used</span>
                <span style={{ color: remaining <= 3 ? "#e07b54" : goldDim, fontSize:`${13 * textSize}px`, fontWeight:700 }}>{remaining} left today</span>
              </div>
              <div style={{ height:"5px", background:lightMode?"rgba(0,0,0,0.08)":"rgba(255,255,255,0.07)", borderRadius:"4px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:"4px", transition:"width 0.4s" }}/>
              </div>
              <div style={{ color:textDim, fontSize:"11px", marginTop:"8px" }}>Resets at midnight</div>
            </>
          )}
        </div>

        {divider}

        {/* Name */}
        <span style={labelStyle}>My Name</span>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={persist}
          placeholder="Your name (optional)" style={{ ...inputStyle, marginBottom:"6px" }}/>

        {divider}

        {/* Year of birth */}
        <span style={labelStyle}>Year of Birth</span>
        <input value={yearOfBirth} onChange={e => setYearOfBirth(e.target.value)} onBlur={persist}
          placeholder="e.g. 2005" type="number" min="1900" max={new Date().getFullYear()}
          style={inputStyle}/>
        {ageLabel && (
          <div style={{ color:goldDim, fontSize:"12px", marginTop:"8px" }}>{ageLabel}</div>
        )}

        {divider}

        {/* Text size */}
        <span style={labelStyle}>Text Size</span>
        <div style={{ display:"flex", gap:"10px" }}>
          {TEXT_SIZES.map(({ label, value, name: sizeName }) => {
            const active = Math.abs(textSize - value) < 0.05;
            return (
              <button key={label}
                onClick={() => {
                  setTextSize(value);
                  localStorage.setItem(KEYS.TEXT_SIZE, String(value));
                }}
                style={{ flex:1, padding:"14px 8px", borderRadius:"12px",
                  background: active ? `linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})` : goldFaint,
                  border:`1px solid ${active ? gold : goldBdr}`,
                  color: active ? (lightMode?"#fff":"#0d1f14") : goldDim,
                  cursor:"pointer", fontFamily:"Nunito,sans-serif", transition:"all 0.2s" }}>
                <div style={{ fontSize: active ? `${18 * value}px` : "16px", fontWeight:800, marginBottom:"4px" }}>{label}</div>
                <div style={{ fontSize:"10px", opacity:0.7 }}>{sizeName}</div>
              </button>
            );
          })}
        </div>
        <div style={{ color:textDim, fontSize:"11px", marginTop:"10px" }}>
          Applies to chat, Quran, Hadith and all pages.
        </div>

      </div>
    </div>
  );
}
