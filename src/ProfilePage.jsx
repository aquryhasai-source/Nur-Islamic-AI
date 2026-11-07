import { useState, useEffect } from "react";
import { saveProfile, DAILY_LIMIT } from "./utils.js";
import { subscribeToPush, getPushPermissionState } from "./lib/pushNotifications.js";
import { trackEvent, trackError } from "./analytics.js";
import { useMedia, DOCK_QUERY } from "./useMedia.js";
import { Icon } from "./Icons.jsx";

export default function ProfilePage({ onBack, onOpenSidebar, profile, setProfile, remaining, unlocked, textSize, lightMode }) {
  const docked = useMedia(DOCK_QUERY);
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
    ? age < 13 ? { icon:"sprout", text:"Child mode active" } : age < 18 ? { icon:"book", text:"Teen mode active" } : { icon:"spark", text:"Standard mode" }
    : null;

  const inputStyle = {
    width:"100%", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"12px",
    padding:"12px 14px", color:textClr, fontSize:`${14 * textSize}px`,
    outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  };
  const labelStyle = {
    color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px",
    textTransform:"uppercase", marginBottom:"10px", display:"block",
  };
  const divider = <div style={{ height:"1px", background:goldBdr, margin:"22px 0" }}/>;

  if (docked) {
    const modeText = age && age > 0 && age < 120
      ? age < 13 ? "Child mode active" : age < 18 ? "Teen mode active" : "Standard mode"
      : null;
    const ts = textSize || 1;
    const dInput = {
      boxSizing:"border-box", width:"100%", height:"42px", padding:"0 14px", borderRadius:"12px",
      border:"1px solid var(--line)", background:"var(--panel2)", color:"var(--text)",
      fontFamily:"inherit", fontSize:`${14*ts}px`, fontWeight:600, outline:0,
    };
    const fieldLbl = { display:"block", marginBottom:"7px", fontSize:`${12*ts}px`, fontWeight:600, color:"var(--dim)" };
    const secStyle = { padding:"22px 24px" };
    const leftColor = remaining <= 3 ? "var(--warn)" : "var(--gold)";
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <style>{`
          .nurp-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}
          .nurp-col{display:flex;flex-direction:column;gap:20px;min-width:0}
          @media (max-width:1199px){.nurp-grid{grid-template-columns:minmax(0,1fr)}}
        `}</style>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
          <div className="nur-ph-title">
            <span>Profile</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:500, color:"var(--dim)" }}>Personalise how NŪR answers you and how the app reads.</span></span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          <div className="nurp-grid">
            <div className="nurp-col">
              <section className="card" style={secStyle}>
                <span className="lbl">Today's Usage</span>
                {unlocked ? (
                  <div style={{ marginTop:"14px", display:"flex", alignItems:"center", gap:"10px", fontSize:`${14*ts}px`, fontWeight:700, color:"var(--green)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
                    Lifetime Access — Unlimited
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop:"14px", display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:"12px" }}>
                      <span style={{ fontSize:"calc(30px * var(--ts, 1))", fontWeight:600, lineHeight:1, fontVariantNumeric:"tabular-nums", color:"var(--text)" }}>
                        {usedToday}<span style={{ marginLeft:"8px", fontSize:`${13.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>of {DAILY_LIMIT} used</span>
                      </span>
                      <span style={{ fontSize:`${13*ts}px`, fontWeight:700, color:leftColor }}>{remaining} left today</span>
                    </div>
                    <div style={{ marginTop:"14px", height:"6px", borderRadius:"4px", background:"var(--lineSoft)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, borderRadius:"4px", background:barColor, transition:"width 0.4s" }}/>
                    </div>
                    <div style={{ marginTop:"10px", fontSize:`${12*ts}px`, fontWeight:500, color:"var(--faint)" }}>Resets at midnight</div>
                  </>
                )}
              </section>

              <section className="card" style={secStyle}>
                <span className="lbl">About You</span>
                <div style={{ marginTop:"14px", display:"grid", gridTemplateColumns:"minmax(0,1fr) 150px", gap:"14px" }}>
                  <label style={{ display:"block" }}>
                    <span style={fieldLbl}>My name</span>
                    <input value={name} onChange={e => setName(e.target.value)} onBlur={persist}
                      placeholder="Your name (optional)" style={dInput}/>
                  </label>
                  <label style={{ display:"block" }}>
                    <span style={fieldLbl}>Year of birth</span>
                    <input value={yearOfBirth} onChange={e => setYearOfBirth(e.target.value)} onBlur={persist}
                      placeholder="e.g. 2005" type="number" min="1900" max={new Date().getFullYear()}
                      style={{ ...dInput, fontVariantNumeric:"tabular-nums" }}/>
                  </label>
                </div>
                {modeText && (
                  <div style={{ marginTop:"14px", display:"inline-flex", alignItems:"center", gap:"8px", height:"30px", padding:"0 12px", borderRadius:"15px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontSize:`${12.5*ts}px`, fontWeight:700 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4Z"/></svg>
                    {modeText}
                  </div>
                )}
              </section>
            </div>

            <div className="nurp-col">
              <section className="card" style={secStyle}>
                <span className="lbl">Daily Reminders</span>
                {pushStatus === "granted" ? (
                  <>
                    <div style={{ marginTop:"12px", display:"flex", alignItems:"center", gap:"10px", fontSize:`${14*ts}px`, fontWeight:700, color:"var(--green)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
                      Notifications enabled
                    </div>
                    <div style={{ marginTop:"8px", fontSize:`${13*ts}px`, fontWeight:500, lineHeight:1.6, color:"var(--dim)" }}>You will receive the daily Hadith and prayer reminders.</div>
                  </>
                ) : pushStatus === "denied" ? (
                  <div style={{ marginTop:"12px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.6, color:"var(--dim)" }}>
                    Blocked in your browser settings. Enable them there to get the daily Hadith and prayer reminders.
                  </div>
                ) : pushStatus === "unsupported" ? (
                  <div style={{ marginTop:"12px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.6, color:"var(--dim)" }}>
                    Not supported in this browser.
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop:"12px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.6, color:"var(--dim)" }}>
                      Get a daily Hadith each morning, right on your device.
                    </div>
                    <button className="pc" onClick={handleEnableNotifications} disabled={pushStatus === "loading"}
                      style={{ marginTop:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", width:"100%", height:"44px", borderRadius:"12px",
                        border:0, background:"var(--goldFill)", color:"var(--onGold)", fontFamily:"inherit", fontSize:"calc(14px * var(--ts, 1))", fontWeight:700,
                        cursor: pushStatus === "loading" ? "default" : "pointer" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0"/></svg>
                      {pushStatus === "loading" ? "Enabling…" : "Enable Notifications"}
                    </button>
                    {pushError && (
                      <div style={{ color:"var(--warn)", fontSize:`${12*ts}px`, marginTop:"8px" }}>{pushError}</div>
                    )}
                  </>
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
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Profile</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0, display:"flex", alignItems:"center" }}><Icon n="back" size={20}/></button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 40px" }}>

        {/* Usage */}
        <span style={labelStyle}>Today's Usage</span>
        <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"8px" }}>
          {unlocked ? (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"var(--green)", fontSize:`${14 * textSize}px`, fontWeight:600 }}><Icon n="spark" size={14}/>Lifetime Access — Unlimited</div>
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
          <div style={{ display:"flex", alignItems:"center", gap:"6px", color:goldDim, fontSize:`${12*textSize}px`, marginTop:"8px" }}><Icon n={ageLabel.icon} size={12}/>{ageLabel.text}</div>
        )}



        {divider}

        {/* Notifications */}
        <span style={labelStyle}>Daily Reminders</span>
        <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px" }}>
          {pushStatus === "granted" ? (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"var(--green)", fontSize:`${14 * textSize}px`, fontWeight:600 }}><Icon n="spark" size={14}/>Notifications enabled</div>
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
                  fontFamily:"inherit", fontSize:`${14*textSize}px` }}>
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
