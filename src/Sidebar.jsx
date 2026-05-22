import { useState, useEffect } from "react";
import { saveProfile, KEYS, PROXY_URL, DAILY_LIMIT } from "./utils.js";

const QUICK_SURAHS = [
  { number: 1,   name: "Al-Fatiha",  meaning: "The Opening"    },
  { number: 2,   name: "Al-Baqarah", meaning: "The Cow"        },
  { number: 18,  name: "Al-Kahf",    meaning: "The Cave"       },
  { number: 36,  name: "Ya-Sin",     meaning: "Ya Sin"         },
  { number: 55,  name: "Ar-Rahman",  meaning: "The Gracious"   },
  { number: 67,  name: "Al-Mulk",    meaning: "The Sovereignty"},
  { number: 112, name: "Al-Ikhlas",  meaning: "Sincerity"      },
  { number: 114, name: "An-Nas",     meaning: "Mankind"        },
];

const HADITH_TOPICS = ["Intention","Prayer","Fasting","Charity","Pilgrimage","Character","Patience","Kindness","Honesty","Gratitude"];

const PRO_FEATURES = [
  "Unlimited reflections — no daily cap",
  "Full Quran browser — all 114 Surahs",
  "Hadith library — Bukhari, Muslim & more",
  "Save & bookmark answers",
  "Rewards, streaks & Ramadan mode",
];

export default function Sidebar({ isOpen, onClose, remaining, unlocked, setUnlocked, setRemaining, profile, setProfile, deviceId, onNavigate, onQuranSurah, onHadithTopic }) {
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

  const age = yearOfBirth ? new Date().getFullYear() - parseInt(yearOfBirth, 10) : null;
  const ageLabel = age && !isNaN(age) && age > 0
    ? age < 13  ? "🌱 Simplified explanations enabled"
    : age < 18  ? "📖 Teen-friendly mode enabled"
    : "✦ Standard mode"
    : null;

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(201,168,76,0.2)", borderRadius: "10px",
    padding: "10px 12px", color: "rgba(255,255,240,0.88)", fontSize: "14px",
    outline: "none", fontFamily: "Nunito, sans-serif",
  };
  const labelStyle = {
    color: "rgba(201,168,76,0.45)", fontSize: "10px",
    letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px", display: "block",
  };
  const divider = <div style={{ height: "1px", background: "rgba(201,168,76,0.1)", margin: "20px 0" }}/>;

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, backdropFilter: "blur(4px)" }}/>
      )}

      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: "min(85vw, 360px)",
        background: "linear-gradient(180deg,#0d1f14 0%,#081510 100%)",
        borderRight: "1px solid rgba(201,168,76,0.15)",
        zIndex: 51, overflowY: "auto",
        transition: "transform 0.3s ease",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(201,168,76,0.12)", position: "sticky", top: 0, background: "rgba(8,21,16,0.95)", backdropFilter: "blur(10px)", zIndex: 1 }}>
          <div style={{ color: "#c9a84c", fontSize: "18px", letterSpacing: "2px", fontVariant: "small-caps", fontWeight: 700 }}>NŪR</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(201,168,76,0.5)", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: "20px" }}>

          {/* ── Profile ── */}
          <span style={labelStyle}>My Profile</span>
          <input value={name} onChange={e => setName(e.target.value)} onBlur={persistProfile}
            placeholder="Your name (optional)" style={{ ...inputStyle, marginBottom: "10px" }}/>
          <input value={yearOfBirth} onChange={e => setYearOfBirth(e.target.value)} onBlur={persistProfile}
            placeholder="Year of birth (e.g. 2005)" type="number" min="1900" max={new Date().getFullYear()}
            style={inputStyle}/>
          {ageLabel && (
            <div style={{ color: "rgba(201,168,76,0.5)", fontSize: "12px", marginTop: "8px", paddingLeft: "4px" }}>
              {ageLabel}
            </div>
          )}

          {divider}

          {/* ── Usage ── */}
          <span style={labelStyle}>Today's Usage</span>
          {unlocked ? (
            <div style={{ color: "#4caf84", fontSize: "14px", fontWeight: 600 }}>✦ Lifetime Access — Unlimited</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>{usedToday} of {DAILY_LIMIT} used</span>
                <span style={{ color: remaining <= 3 ? "#e07b54" : "rgba(201,168,76,0.6)", fontSize: "13px", fontWeight: 600 }}>{remaining} left</span>
              </div>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "4px", transition: "width 0.4s" }}/>
              </div>
            </>
          )}

          {divider}

          {/* ── Unlock code ── */}
          {!unlocked && (
            <>
              <span style={labelStyle}>Unlock Pro</span>
              <input
                value={unlockCode}
                onChange={e => setUnlockCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && redeemCode()}
                placeholder="Enter code — NUR-XXXX-XXXX"
                maxLength={40}
                style={{ ...inputStyle, letterSpacing: "1.5px", fontFamily: "monospace", marginBottom: "10px", borderColor: unlockStatus === "error" ? "#e07b54" : "rgba(201,168,76,0.2)" }}
              />
              {unlockError && <div style={{ color: "#e07b54", fontSize: "12px", marginBottom: "8px" }}>{unlockError}</div>}
              {unlockStatus === "success" ? (
                <div style={{ color: "#4caf84", fontSize: "14px", fontWeight: 600 }}>✦ Unlocked! Jazakallahu Khairan 🌙</div>
              ) : (
                <button onClick={redeemCode} disabled={!unlockCode.trim() || unlockStatus === "loading"}
                  style={{ width: "100%", padding: "11px", borderRadius: "10px", background: unlockCode.trim() ? "linear-gradient(135deg,#c9a84c,#a8862e)" : "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", color: unlockCode.trim() ? "#0d1f14" : "rgba(201,168,76,0.3)", fontSize: "14px", cursor: unlockCode.trim() ? "pointer" : "not-allowed", fontWeight: 700, fontFamily: "Nunito,sans-serif" }}>
                  {unlockStatus === "loading" ? "Verifying..." : "Activate Lifetime Access"}
                </button>
              )}
              {divider}
            </>
          )}

          {/* ── Quick Quran ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={labelStyle}>Quick Quran</span>
            <button onClick={() => onNavigate("quran")} style={{ background: "none", border: "none", color: "rgba(201,168,76,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "Nunito,sans-serif", marginBottom: "10px" }}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {QUICK_SURAHS.map(s => (
              <button key={s.number} onClick={() => { onQuranSurah(s.number); onNavigate("quran"); }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", fontFamily: "Nunito,sans-serif" }}>{s.name}</span>
                <span style={{ color: "rgba(201,168,76,0.4)", fontSize: "11px" }}>{s.meaning}</span>
              </button>
            ))}
          </div>

          {divider}

          {/* ── Quick Hadith Topics ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={labelStyle}>Hadith Topics</span>
            <button onClick={() => onNavigate("hadith")} style={{ background: "none", border: "none", color: "rgba(201,168,76,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "Nunito,sans-serif", marginBottom: "10px" }}>Search all →</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {HADITH_TOPICS.map(topic => (
              <button key={topic} onClick={() => { onHadithTopic(topic); onNavigate("hadith"); }}
                style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "20px", padding: "6px 14px", color: "rgba(201,168,76,0.75)", fontSize: "12px", cursor: "pointer", fontFamily: "Nunito,sans-serif" }}>
                {topic}
              </button>
            ))}
          </div>

          {divider}

          {/* ── Features ── */}
          <span style={labelStyle}>Features</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {PRO_FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, background: unlocked ? "rgba(76,175,132,0.15)" : "rgba(201,168,76,0.08)", border: `1px solid ${unlocked ? "rgba(76,175,132,0.4)" : "rgba(201,168,76,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "9px", color: unlocked ? "#4caf84" : "rgba(201,168,76,0.5)" }}>{unlocked ? "✓" : "✦"}</span>
                </div>
                <span style={{ color: unlocked ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)", fontSize: "13px" }}>{f}</span>
              </div>
            ))}
          </div>

          {divider}

          {/* ── About ── */}
          <div style={{ textAlign: "center", paddingBottom: "20px" }}>
            <div style={{ color: "#c9a84c", fontSize: "22px", marginBottom: "6px" }}>بِسْمِ اللّٰهِ</div>
            <div style={{ color: "rgba(201,168,76,0.35)", fontSize: "11px", letterSpacing: "1px" }}>NŪR v2.0 · Islamic Knowledge Assistant</div>
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", marginTop: "6px", lineHeight: 1.6 }}>
              Always consult a qualified scholar<br/>for personal rulings · Allahu A'lam
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
