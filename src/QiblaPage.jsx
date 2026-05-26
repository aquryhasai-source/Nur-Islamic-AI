import { useState, useEffect, useRef } from "react";
import { calculateQibla } from "./utils.js";

// Decorative compass SVG
const CompassSVG = ({ bearing = 0, qibla = 0, size = 280 }) => {
  const r = size / 2;
  const needleAngle = qibla - bearing;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer ring */}
      <circle cx={r} cy={r} r={r - 4} fill="none" stroke="#c9a84c" strokeWidth="2" opacity="0.4"/>
      <circle cx={r} cy={r} r={r - 12} fill="none" stroke="#c9a84c" strokeWidth="0.8" opacity="0.2"/>

      {/* Cardinal directions */}
      {["N","E","S","W"].map((d, i) => {
        const angle = i * 90 * Math.PI / 180;
        const tx = r + (r - 28) * Math.sin(angle);
        const ty = r - (r - 28) * Math.cos(angle);
        return <text key={d} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fill="#c9a84c" fontSize="14" fontWeight="700" fontFamily="Georgia">{d}</text>;
      })}

      {/* Tick marks */}
      {Array.from({ length: 72 }).map((_, i) => {
        const angle = (i * 5) * Math.PI / 180;
        const isMajor = i % 6 === 0;
        const inner = r - 20 - (isMajor ? 10 : 5);
        const outer = r - 20;
        const x1 = r + inner * Math.sin(angle);
        const y1 = r - inner * Math.cos(angle);
        const x2 = r + outer * Math.sin(angle);
        const y2 = r - outer * Math.cos(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c9a84c" strokeWidth={isMajor ? 1.5 : 0.7} opacity={isMajor ? 0.6 : 0.3}/>;
      })}

      {/* Qibla needle group — rotates to point toward Mecca */}
      <g transform={`rotate(${needleAngle}, ${r}, ${r})`}>
        {/* Qibla pointer (gold, toward Mecca) */}
        <polygon points={`${r},${r - (r-40)} ${r-9},${r+20} ${r},${r+10} ${r+9},${r+20}`} fill="#c9a84c" opacity="0.9"/>
        {/* Back pointer */}
        <polygon points={`${r},${r + (r-40)} ${r-7},${r-16} ${r},${r-6} ${r+7},${r-16}`} fill="rgba(201,168,76,0.25)"/>
        {/* Kaaba icon at tip */}
        <text x={r} y={r - (r-38)} textAnchor="middle" dominantBaseline="central" fontSize="16">🕋</text>
      </g>

      {/* Center dot */}
      <circle cx={r} cy={r} r="8" fill="#0d1f14" stroke="#c9a84c" strokeWidth="2"/>
      <circle cx={r} cy={r} r="3" fill="#c9a84c"/>
    </svg>
  );
};

export default function QiblaPage({ onBack, unlocked, navigateTo, lightMode, textSize = 1 }) {
  const [qiblaAngle,  setQiblaAngle]  = useState(null);
  const [bearing,     setBearing]     = useState(0);
  const [location,    setLocation]    = useState(null);
  const [locError,    setLocError]    = useState(null);
  const [city,        setCity]        = useState("");
  const [showCityInput, setShowCityInput] = useState(false);

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.85)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.4)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.06)";

  // Device compass
  useEffect(() => {
    if (!unlocked) return;
    const handler = (e) => {
      if (e.alpha !== null) setBearing(e.alpha);
    };
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(p => {
        if (p === "granted") window.addEventListener("deviceorientation", handler);
      }).catch(() => {});
    } else {
      window.addEventListener("deviceorientationabsolute", handler, true);
      window.addEventListener("deviceorientation", handler);
    }
    return () => {
      window.removeEventListener("deviceorientation", handler);
      window.removeEventListener("deviceorientationabsolute", handler);
    };
  }, [unlocked]);

  // Geolocation
  useEffect(() => {
    if (!unlocked) return;
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        setLocation(coords);
        setQiblaAngle(calculateQibla(coords.latitude, coords.longitude));
      },
      () => setLocError("Location access denied"),
      { enableHighAccuracy: true }
    );
  }, [unlocked]);

  const lookupCity = async () => {
    if (!city.trim()) return;
    try {
      const res  = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&method=2`);
      const data = await res.json();
      if (data.code === 200) {
        // AlAdhan doesn't return lat/lon directly, use Open Meteo geocoding
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const gd  = await geo.json();
        if (gd.results?.[0]) {
          const { latitude, longitude } = gd.results[0];
          setQiblaAngle(calculateQibla(latitude, longitude));
          setLocError(null);
        }
      }
    } catch {}
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Qibla Direction</div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px", position:"relative", overflow:"hidden" }}>

        {/* ── FREE: blurred compass + Get Pro ── */}
        {!unlocked && (
          <>
            <div style={{ filter:"blur(8px)", opacity:0.5, pointerEvents:"none", userSelect:"none" }}>
              <CompassSVG bearing={0} qibla={145} size={280}/>
            </div>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"16px" }}>
              <div style={{ textAlign:"center", marginBottom:"8px" }}>
                <div style={{ fontSize:"32px", marginBottom:"8px" }}>🧭</div>
                <div style={{ color:gold, fontSize:`${17 * textSize}px`, fontWeight:700, marginBottom:"8px" }}>Qibla Direction</div>
                <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.7 }}>Find the direction of prayer<br/>from anywhere in the world</div>
              </div>
              <button onClick={() => navigateTo("getpro")}
                style={{ padding:"14px 36px", borderRadius:"50px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, border:"none", color:lightMode?"#fff":"#0d1f14", fontSize:`${15 * textSize}px`, fontWeight:800, cursor:"pointer", fontFamily:"Nunito,sans-serif", boxShadow:`0 6px 24px ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.25)"}` }}>
                🌙 Get Pro
              </button>
            </div>
          </>
        )}

        {/* ── PRO: working compass ── */}
        {unlocked && (
          <>
            {qiblaAngle !== null ? (
              <>
                <div style={{ marginBottom:"16px", textAlign:"center" }}>
                  <div style={{ color:goldDim, fontSize:"11px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"4px" }}>Facing Mecca</div>
                  <div style={{ color:gold, fontSize:`${28 * textSize}px`, fontWeight:800 }}>{Math.round(qiblaAngle)}°</div>
                  <div style={{ color:textDim, fontSize:"11px" }}>from North</div>
                </div>
                <CompassSVG bearing={bearing} qibla={qiblaAngle} size={260}/>
                <div style={{ marginTop:"20px", color:textDim, fontSize:`${11 * textSize}px`, textAlign:"center" }}>
                  🕋 The 🕋 emoji points toward Mecca · Hold your phone flat
                </div>
                <button onClick={() => setShowCityInput(v => !v)}
                  style={{ marginTop:"14px", background:"none", border:`1px solid ${goldBdr}`, borderRadius:"10px", padding:"8px 20px", color:goldDim, fontSize:"12px", cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                  Change city
                </button>
              </>
            ) : (
              <div style={{ textAlign:"center" }}>
                {locError ? (
                  <>
                    <div style={{ color:textDim, fontSize:`${13 * textSize}px`, marginBottom:"20px" }}>{locError}</div>
                    <button onClick={() => setShowCityInput(true)}
                      style={{ padding:"12px 28px", borderRadius:"12px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, border:"none", color:lightMode?"#fff":"#0d1f14", fontSize:`${14 * textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                      Enter city manually
                    </button>
                  </>
                ) : (
                  <div style={{ color:goldDim, fontSize:`${13 * textSize}px` }}>Finding your location…</div>
                )}
              </div>
            )}

            {showCityInput && (
              <div style={{ position:"absolute", bottom:"20px", left:"20px", right:"20px", background:lightMode?"rgba(253,248,237,0.98)":"rgba(10,20,14,0.98)", border:`1px solid ${goldBdr}`, borderRadius:"16px", padding:"16px" }}>
                <input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key==="Enter" && lookupCity()}
                  placeholder="Enter your city…"
                  style={{ width:"100%", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"10px", padding:"10px 14px", color:textClr, fontSize:`${14 * textSize}px`, outline:"none", fontFamily:"Nunito,sans-serif", boxSizing:"border-box", marginBottom:"10px" }}/>
                <button onClick={lookupCity}
                  style={{ width:"100%", padding:"10px", borderRadius:"10px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, border:"none", color:lightMode?"#fff":"#0d1f14", fontSize:`${13 * textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                  Find Qibla
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
