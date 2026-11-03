import { useState, useEffect } from "react";
import { saveProfile, KEYS, DAILY_LIMIT } from "./utils.js";
import { subscribeToPush, getPushPermissionState } from "./lib/pushNotifications.js";
import { trackEvent, trackError } from "./analytics.js";

const TEXT_SIZES = [
  { label: "XS", value: 0.75,  name: "Tiny"   },
  { label: "S",  value: 0.88,  name: "Small"  },
  { label: "M",  value: 1.0,   name: "Medium" },
  { label: "L",  value: 1.14,  name: "Large"  },
  { label: "XL", value: 1.28,  name: "Huge"   },
];

export default function ProfilePage({ onBack, onOpenSidebar, profile, setProfile, remaining, unlocked, textSize, setTextSize, lightMode }) {
  const [name,        setName]        = useState(profile.name || "");
  const [yearOfBirth, setYearOfBirth] = useState(profile.yearOfBirth || "");
  const [pushStatus,  setPushStatus]  = useState("idle"); // idle | loading | granted | denied | unsupported | error
  const [pushError,   setPushError]   = useState("");

  useEffect(() => {
    const state = getPushPermissionState();
    setPushStatus(state);
    if (state === "granted") {
      // Permission may have been granted in an earlier attempt without the
      // subscription actually reaching Supabase — resync quietly on load
      // so the DB row always matches what the browser shows.
      subscribeToPush().catch((err) => trackError(err.message, "resync_notifications"));
    }
  }, []);

  const handleEnableNotifications = async () => {
    setPushStatus("loading");
    setPushError("");
    try {
      await subscribeToPush();
      setPushStatus("granted");
      trackEvent("notifications_enabled");
    } catch (err) {
      setPushError(err.message || "Something went wrong enabling notifications.");
      setPushStatus(getPushPermissionState() === "denied" ? "denied" : "error");
      trackError(err.message, "enable_notifications");
    }
  };

  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const inputBg = "var(--panel2)";
  const cardBg = "var(--panel)";

  const persist = () => {
    const p = { name: name.trim(), yearOfBirth: yearOfBirth.trim() };
    saveProfile(p);
    setProfile(p);
  };

  const usedToday = unlocked ? 0 : DAILY_LIMIT - remaining;
  const pct       = Math.min((usedToday / DAILY_LIMIT) * 100, 100);
  const barColor  = remaining <= 3 ? "var(--warn)" : remaining <= 7 ? "var(--gold)" : "var(--green)";

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
    color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px",
    textTransform:"uppercase", marginBottom:"10px", display:"block",
  };
  const divider = <div style={{ height:"1px", background:goldBdr, margin:"22px 0" }}/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div className="nur-ph" style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button className="nur-ph-menu" onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Profile</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 40px" }}>

        {/* Usage */}
        <span style={labelStyle}>Today's Usage</span>
        <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"8px" }}>
          {unlocked ? (
            <div style={{ color:"var(--green)", fontSize:`${14 * textSize}px`, fontWeight:600 }}>✦ Lifetime Access — Unlimited</div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                <span style={{ color:textDim, fontSize:`${13 * textSize}px` }}>{usedToday} of {DAILY_LIMIT} used</span>
                <span style={{ color: remaining <= 3 ? "var(--warn)" : goldDim, fontSize:`${13 * textSize}px`, fontWeight:700 }}>{remaining} left today</span>
              </div>
              <div style={{ height:"5px", background:"var(--panel2)", borderRadius:"4px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:"4px", transition:"width 0.4s" }}/>
              </div>
              <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginTop:"8px" }}>Resets at midnight</div>
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
          <div style={{ color:goldDim, fontSize:`${12*textSize}px`, marginTop:"8px" }}>{ageLabel}</div>
        )}

        {divider}

        {/* Text size — 5 levels */}
        <span style={labelStyle}>Text Size</span>
        <div style={{ display:"flex", gap:"6px" }}>
          {TEXT_SIZES.map(({ label, value, name: sizeName }) => {
            const active = Math.abs(textSize - value) < 0.05;
            return (
              <button key={label}
                onClick={() => {
                  setTextSize(value);
                  localStorage.setItem(KEYS.TEXT_SIZE, String(value));
                }}
                style={{ flex:1, padding:"10px 4px", borderRadius:"12px",
                  background: active ? "var(--goldFill)" : goldFaint,
                  border:`1px solid ${active ? gold : goldBdr}`,
                  color: active ? "var(--onGold)" : goldDim,
                  cursor:"pointer", fontFamily:"Nunito,sans-serif", transition:"all 0.2s" }}>
                <div style={{ fontSize:`${active ? 16*value : 14}px`, fontWeight:800, marginBottom:"3px" }}>{label}</div>
                <div style={{ fontSize:"9px", opacity:0.75 }}>{sizeName}</div>
              </button>
            );
          })}
        </div>
        <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginTop:"10px" }}>
          Applies to chat, Quran, Hadith and all pages.
        </div>

        {divider}

        {/* Notifications */}
        <span style={labelStyle}>Daily Reminders</span>
        <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px" }}>
          {pushStatus === "granted" ? (
            <div style={{ color:"var(--green)", fontSize:`${14 * textSize}px`, fontWeight:600 }}>✦ Notifications enabled</div>
          ) : pushStatus === "denied" ? (
            <div style={{ color:textDim, fontSize:`${13 * textSize}px` }}>
              Blocked in your browser settings. Enable them there to get the daily Hadith and prayer reminders.
            </div>
          ) : pushStatus === "unsupported" ? (
            <div style={{ color:textDim, fontSize:`${13 * textSize}px` }}>
              Not supported in this browser.
            </div>
          ) : (
            <>
              <div style={{ color:textDim, fontSize:`${13 * textSize}px`, marginBottom:"12px" }}>
                Get a daily Hadith each morning, right on your device.
              </div>
              <button onClick={handleEnableNotifications} disabled={pushStatus === "loading"}
                style={{ width:"100%", padding:"12px", borderRadius:"12px",
                  background:"var(--goldFill)",
                  border:"none", color: "var(--onGold)", fontWeight:700,
                  cursor: pushStatus === "loading" ? "default" : "pointer",
                  fontFamily:"Nunito,sans-serif", fontSize:`${14*textSize}px` }}>
                {pushStatus === "loading" ? "Enabling…" : "Enable Notifications"}
              </button>
              {pushError && (
                <div style={{ color:"var(--warn)", fontSize:`${11*textSize}px`, marginTop:"8px" }}>{pushError}</div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
