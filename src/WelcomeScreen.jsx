import { useState, useEffect } from "react";

export const WELCOME_KEY = "nur_welcome_seen";

// ─── Decorative SVG elements ──────────────────────────────────────────────────
const CornerDecor = ({ flip }) => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none"
    style={{ transform: flip ? "scaleX(-1)" : "none" }}>
    <path d="M4 76 L4 20 Q4 4 20 4 L76 4" stroke="#8b5a2b" strokeWidth="1.5" opacity="0.4"/>
    <path d="M4 76 L4 30 Q4 14 18 10 L76 4" stroke="#c9a84c" strokeWidth="0.6" opacity="0.25"/>
    <circle cx="4" cy="76" r="3" fill="#8b5a2b" opacity="0.3"/>
    <circle cx="76" cy="4" r="3" fill="#8b5a2b" opacity="0.3"/>
    <circle cx="20" cy="20" r="2" fill="#c9a84c" opacity="0.35"/>
    <path d="M14 14 L26 14 L26 26" stroke="#c9a84c" strokeWidth="1" opacity="0.3" fill="none"/>
  </svg>
);

const GeoBorder = () => (
  <svg width="100%" height="8" viewBox="0 0 300 8" preserveAspectRatio="none">
    <defs>
      <pattern id="geo-border" x="0" y="0" width="20" height="8" patternUnits="userSpaceOnUse">
        <polygon points="10,1 19,4 10,7 1,4" fill="none" stroke="#8b5a2b" strokeWidth="0.8" opacity="0.4"/>
      </pattern>
    </defs>
    <rect width="100%" height="8" fill="url(#geo-border)"/>
  </svg>
);

const StarCluster = ({ x, y, size = 1 }) => (
  <g>
    <circle cx={x} cy={y} r={1.2 * size} fill="#c9a84c" opacity="0.7"/>
    <circle cx={x - 6 * size} cy={y + 3 * size} r={0.7 * size} fill="#c9a84c" opacity="0.4"/>
    <circle cx={x + 5 * size} cy={y - 4 * size} r={0.9 * size} fill="#c9a84c" opacity="0.5"/>
    <circle cx={x + 8 * size} cy={y + 5 * size} r={0.6 * size} fill="#c9a84c" opacity="0.35"/>
  </g>
);

// ─── PAGE 1 — Image hero ──────────────────────────────────────────────────────
function Page1({ onNext }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Background image */}
      <img
        src="/welcome-bg.jpg"
        alt="NŪR Welcome"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "top",
        }}
        onError={e => { e.target.style.display = "none"; }}
      />

      {/* Subtle gradient overlay at bottom for button readability */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "220px",
        background: "linear-gradient(0deg, rgba(253,246,227,0.98) 55%, transparent)",
      }}/>

      {/* Real interactive button at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "0 28px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
      }}>
        <button onClick={onNext}
          style={{
            width: "100%", maxWidth: "320px", padding: "16px", borderRadius: "50px",
            background: "linear-gradient(135deg,#8b5a2b,#6b4020)",
            border: "none", color: "#fdf6e3", fontSize: "18px", fontWeight: 800,
            fontFamily: "Nunito,sans-serif", cursor: "pointer", letterSpacing: "0.5px",
            boxShadow: "0 6px 24px rgba(139,90,43,0.35)",
          }}>
          Begin Your Journey
        </button>
        {/* Dots */}
        <div style={{ display: "flex", gap: "7px" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: i===0?"22px":"7px", height:"7px", borderRadius:"4px", background: i===0?"#8b5a2b":"rgba(139,90,43,0.25)", transition:"all 0.3s" }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE 2 — Features ────────────────────────────────────────────────────────
function Page2({ onNext }) {
  const features = [
    {
      icon: "📖",
      title: "Full Quran",
      desc: "All 114 Surahs in Arabic with 6 translations — English, Urdu, French, Turkish, Indonesian, Bangla",
      color: "#1a2a4a",
      bg: "linear-gradient(135deg,#1a2a4a,#0d1830)",
    },
    {
      icon: "✨",
      title: "AI Islamic Chat",
      desc: "Ask anything about Islam — answered from Quran and authentic Hadith with citations",
      color: "#0d1f14",
      bg: "linear-gradient(135deg,#0d2a18,#081510)",
    },
    {
      icon: "📜",
      title: "Hadith Library",
      desc: "Search across Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai & Ibn Majah in seconds",
      color: "#3a1a05",
      bg: "linear-gradient(135deg,#4a2a0a,#2a1205)",
    },
    {
      icon: "☽",
      title: "Ramadan Mode",
      desc: "Live Iftar & Suhoor countdown based on your location, automatically during Ramadan",
      color: "#1a0a2a",
      bg: "linear-gradient(135deg,#1a0a35,#0a0520)",
    },
  ];

  return (
    <div style={{
      width: "100%", height: "100%", overflowY: "auto",
      background: "linear-gradient(160deg,#fdf6e3 0%,#f5e6c8 60%,#ede0c0 100%)",
      position: "relative",
    }}>
      {/* Corner decorations */}
      <div style={{ position: "fixed", top: 0, left: 0, zIndex: 1, pointerEvents: "none" }}><CornerDecor/></div>
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 1, pointerEvents: "none" }}><CornerDecor flip/></div>

      {/* Geometric background pattern */}
      <svg style={{ position:"fixed", inset:0, width:"100%", height:"100%", opacity:0.04, pointerEvents:"none", zIndex:0 }} viewBox="0 0 400 800">
        <defs>
          <pattern id="p2geo" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <polygon points="25,2 48,14 48,36 25,48 2,36 2,14" fill="none" stroke="#8b5a2b" strokeWidth="1"/>
            <circle cx="25" cy="25" r="3" fill="none" stroke="#8b5a2b" strokeWidth="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p2geo)"/>
      </svg>

      <div style={{ position: "relative", zIndex: 2, padding: "48px 24px 32px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{
            fontSize: "48px", fontFamily: "Georgia,serif", color: "#8b5a2b",
            textShadow: "0 0 30px rgba(139,90,43,0.3)", lineHeight: 1.1, marginBottom: "4px",
          }}>
            اقْرَأْ
          </div>
          <div style={{ color: "rgba(139,90,43,0.5)", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>
            "Read" — The first word revealed
          </div>
        </div>

        <GeoBorder/>

        <div style={{ textAlign: "center", margin: "20px 0 28px" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#2a1205", letterSpacing: "-0.5px", lineHeight: 1.15 }}>
            Everything you need,<br/>
            <span style={{ color: "#8b5a2b" }}>all in one place.</span>
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
          {features.map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "16px",
              background: "#fff8ee", border: "1px solid rgba(139,90,43,0.15)",
              borderRadius: "18px", padding: "16px 18px",
              boxShadow: "0 2px 12px rgba(139,90,43,0.08)",
            }}>
              {/* Icon circle */}
              <div style={{
                width: "52px", height: "52px", borderRadius: "16px",
                background: f.bg, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px", boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}>
                {f.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#2a1205", marginBottom: "3px" }}>{f.title}</div>
                <div style={{ fontSize: "12px", color: "rgba(80,40,10,0.6)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Decorative Arabic */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", color: "rgba(139,90,43,0.4)", fontFamily: "Georgia,serif" }}>
            وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا
          </div>
          <div style={{ fontSize: "10px", color: "rgba(139,90,43,0.3)", letterSpacing: "1px", marginTop: "4px" }}>
            Surah At-Talaq 65:2
          </div>
        </div>

        <GeoBorder/>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", marginTop: "24px" }}>
          <button onClick={onNext}
            style={{
              width: "100%", maxWidth: "320px", padding: "16px", borderRadius: "50px",
              background: "linear-gradient(135deg,#8b5a2b,#6b4020)",
              border: "none", color: "#fdf6e3", fontSize: "17px", fontWeight: 800,
              fontFamily: "Nunito,sans-serif", cursor: "pointer",
              boxShadow: "0 6px 20px rgba(139,90,43,0.3)",
            }}>
            See what's free →
          </button>
          <div style={{ display: "flex", gap: "7px" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i===1?"22px":"7px", height:"7px", borderRadius:"4px", background: i===1?"#8b5a2b":"rgba(139,90,43,0.25)", transition:"all 0.3s" }}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE 3 — Get started ─────────────────────────────────────────────────────
function Page3({ onDone }) {
  const freeItems = [
    "15 AI reflections per day",
    "Full Quran — browse & search",
    "Hadith search — all 6 collections",
    "Ramadan mode & prayer times",
    "Multilingual support",
  ];
  const proItems = [
    "Unlimited AI reflections",
    "Bookmarks in Quran & Hadith",
    "Rewards, streaks & more",
    "Priority features forever",
  ];

  return (
    <div style={{
      width: "100%", height: "100%", overflowY: "auto",
      background: "linear-gradient(160deg,#fdf6e3 0%,#f5e6c8 60%,#ede0c0 100%)",
      position: "relative",
    }}>
      {/* Corner decorations */}
      <div style={{ position: "fixed", top: 0, left: 0, zIndex: 1, pointerEvents: "none" }}><CornerDecor/></div>
      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 1, pointerEvents: "none" }}><CornerDecor flip/></div>

      {/* Starfield decoration */}
      <svg style={{ position:"fixed", top:0, left:0, width:"100%", height:"45%", pointerEvents:"none", zIndex:0 }} viewBox="0 0 400 350">
        <defs>
          <radialGradient id="p3grad" cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor="#1a2a4a" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#p3grad)"/>
        <StarCluster x={60} y={40} size={1}/>
        <StarCluster x={330} y={60} size={0.8}/>
        <StarCluster x={200} y={25} size={1.2}/>
        <StarCluster x={100} y={100} size={0.7}/>
        <StarCluster x={300} y={110} size={0.9}/>
        {/* Crescent */}
        <path d="M200 55 A28 28 0 1 0 200 111 A20 20 0 1 1 200 55" fill="rgba(201,168,76,0.2)"/>
      </svg>

      {/* Geometric background */}
      <svg style={{ position:"fixed", inset:0, width:"100%", height:"100%", opacity:0.035, pointerEvents:"none", zIndex:0 }} viewBox="0 0 400 800">
        <defs>
          <pattern id="p3geo" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
            <polygon points="25,2 48,14 48,36 25,48 2,36 2,14" fill="none" stroke="#8b5a2b" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p3geo)"/>
      </svg>

      <div style={{ position: "relative", zIndex: 2, padding: "52px 24px 36px" }}>

        {/* Big NŪR heading */}
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <div style={{ fontSize: "18px", color: "rgba(139,90,43,0.45)", letterSpacing: "4px", textTransform: "uppercase", fontWeight: 600 }}>
            Welcome to
          </div>
          <div style={{
            fontSize: "72px", fontWeight: 900, color: "#8b5a2b",
            letterSpacing: "8px", fontVariant: "small-caps", lineHeight: 1,
            textShadow: "0 4px 20px rgba(139,90,43,0.2)",
          }}>
            NŪR
          </div>
          <div style={{ fontSize: "13px", color: "rgba(139,90,43,0.5)", letterSpacing: "4px", textTransform: "uppercase", marginTop: "4px" }}>
            نُور · Light
          </div>
        </div>

        <GeoBorder/>

        <div style={{ textAlign: "center", margin: "20px 0 24px" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#2a1205", lineHeight: 1.3 }}>
            Start free.<br/>
            <span style={{ color: "#8b5a2b" }}>Upgrade when you're ready.</span>
          </div>
        </div>

        {/* Free tier */}
        <div style={{
          background: "#fff8ee", border: "1px solid rgba(139,90,43,0.2)",
          borderRadius: "20px", padding: "20px", marginBottom: "12px",
          boxShadow: "0 2px 12px rgba(139,90,43,0.08)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#2a1205" }}>Free Forever</div>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#8b5a2b" }}>$0</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {freeItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(139,90,43,0.1)", border: "1px solid rgba(139,90,43,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "10px", color: "#8b5a2b" }}>✓</span>
                </div>
                <span style={{ fontSize: "13px", color: "rgba(60,30,10,0.7)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro tier */}
        <div style={{
          background: "linear-gradient(135deg,rgba(139,90,43,0.12),rgba(139,90,43,0.06))",
          border: "1.5px solid rgba(139,90,43,0.35)",
          borderRadius: "20px", padding: "20px", marginBottom: "28px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "12px", right: "14px",
            background: "linear-gradient(135deg,#8b5a2b,#6b4020)",
            color: "#fdf6e3", fontSize: "10px", fontWeight: 800, letterSpacing: "1px",
            padding: "3px 10px", borderRadius: "20px",
          }}>PRO</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "14px" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#2a1205" }}>Lifetime Access</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {proItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(139,90,43,0.15)", border: "1px solid rgba(139,90,43,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "10px", color: "#8b5a2b" }}>✦</span>
                </div>
                <span style={{ fontSize: "13px", color: "rgba(60,30,10,0.75)", fontWeight: 600 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "12px", fontSize: "12px", color: "rgba(139,90,43,0.5)", textAlign: "center" }}>
            One-time payment · ₹299 India · $2.99 Worldwide
          </div>
        </div>

        {/* Closing verse */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,rgba(139,90,43,0.3),transparent)", marginBottom: "16px" }}/>
          <div style={{ fontSize: "15px", color: "rgba(139,90,43,0.55)", fontFamily: "Georgia,serif" }}>
            وَقُل رَّبِّ زِدْنِي عِلْمًا
          </div>
          <div style={{ fontSize: "11px", color: "rgba(139,90,43,0.35)", marginTop: "5px", letterSpacing: "0.5px" }}>
            "My Lord, increase me in knowledge" — Surah Ta-Ha 20:114
          </div>
        </div>

        {/* Final CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <button onClick={onDone}
            style={{
              width: "100%", maxWidth: "320px", padding: "17px", borderRadius: "50px",
              background: "linear-gradient(135deg,#8b5a2b,#6b4020)",
              border: "none", color: "#fdf6e3", fontSize: "18px", fontWeight: 800,
              fontFamily: "Nunito,sans-serif", cursor: "pointer",
              boxShadow: "0 8px 28px rgba(139,90,43,0.35)", letterSpacing: "0.3px",
            }}>
            🌙 Enter NŪR
          </button>
          <div style={{ display: "flex", gap: "7px" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i===2?"22px":"7px", height:"7px", borderRadius:"4px", background: i===2?"#8b5a2b":"rgba(139,90,43,0.25)", transition:"all 0.3s" }}/>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main WelcomeScreen ───────────────────────────────────────────────────────
export default function WelcomeScreen({ onDone }) {
  const [page, setPage] = useState(0);

  const handleDone = () => {
    localStorage.setItem(WELCOME_KEY, "true");
    onDone();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      fontFamily: "Nunito, sans-serif",
      touchAction: "pan-y",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(139,90,43,0.2); border-radius: 4px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ width: "100%", height: "100%", animation: "fadeIn 0.4s ease" }}>
        {page === 0 && <Page1 onNext={() => setPage(1)}/>}
        {page === 1 && <Page2 onNext={() => setPage(2)}/>}
        {page === 2 && <Page3 onDone={handleDone}/>}
      </div>
    </div>
  );
}
