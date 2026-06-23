import { useState, useEffect, useRef } from "react";
import { calculateQibla } from "./utils.js";

// ─── Subtle Islamic geometric background ─────────────────────────────────────
const GeoBg = ({ lightMode }) => (
  <svg
    aria-hidden="true"
    style={{
      position: "absolute", inset: 0,
      width: "100%", height: "100%",
      pointerEvents: "none",
      opacity: lightMode ? 0.055 : 0.03,
    }}
  >
    <defs>
      <pattern id="q-geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <polygon points="40,3 77,22 77,58 40,77 3,58 3,22"
          fill="none" stroke="#c9a84c" strokeWidth="0.8"/>
        <polygon points="40,17 63,30 63,50 40,63 17,50 17,30"
          fill="none" stroke="#c9a84c" strokeWidth="0.45" opacity="0.7"/>
        <circle cx="40" cy="40" r="5" fill="none" stroke="#c9a84c" strokeWidth="0.5" opacity="0.55"/>
        <circle cx="40" cy="3"  r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="77" cy="22" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="77" cy="58" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="40" cy="77" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="3"  cy="58" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="3"  cy="22" r="1.5" fill="#c9a84c" opacity="0.4"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#q-geo)"/>
  </svg>
);

// ─── Redesigned Compass SVG ───────────────────────────────────────────────────
const CompassSVG = ({ bearing, qibla, size, aligned, lightMode }) => {
  const r  = size / 2;
  const cx = r;
  const cy = r;
  const GOLD       = "#c9a84c";
  const NORTH_RED  = "#e07575";

  // Needle rotation: positive = clockwise, 0 = pointing straight up toward Qibla
  const needleAngle = ((qibla - bearing) % 360 + 360) % 360;

  // ── Tick marks: 72 total (every 5°) ──────────────────────────────────────
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const deg    = i * 5;
    const isCard = deg % 90 === 0;          // cardinal  — 4 ticks
    const isMed  = !isCard && deg % 30 === 0; // mid label — 8 ticks
    const isTen  = !isMed  && !isCard && deg % 10 === 0; // every 10°
    const len    = isCard ? 20 : isMed ? 13 : isTen ? 8 : 4;
    const sw     = isCard ? 2.2 : isMed ? 1.3 : 0.75;
    const op     = isCard ? 1   : isMed ? 0.65 : isTen ? 0.38 : 0.22;
    const rad    = (deg - 90) * (Math.PI / 180);
    const outer  = r - 12;
    const inner  = outer - len;
    return {
      x1: cx + inner * Math.cos(rad), y1: cy + inner * Math.sin(rad),
      x2: cx + outer * Math.cos(rad), y2: cy + outer * Math.sin(rad),
      sw, op,
    };
  });

  // ── Label positions ───────────────────────────────────────────────────────
  const LABEL_R = r - 40;
  const DEG_R   = r - 41;

  const pos = (deg, dist) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + dist * Math.cos(rad), y: cy + dist * Math.sin(rad) };
  };

  const cardinals = [
    { d: 0,   l: "N", fill: NORTH_RED, fs: 16, fw: "800" },
    { d: 90,  l: "E", fill: GOLD,      fs: 13, fw: "700" },
    { d: 180, l: "S", fill: GOLD,      fs: 13, fw: "700" },
    { d: 270, l: "W", fill: GOLD,      fs: 13, fw: "700" },
  ];

  const degLabels = [30, 60, 120, 150, 210, 240, 300, 330];

  // ── Needle geometry ───────────────────────────────────────────────────────
  const TIP  = cy - (r - 57);   // tip of needle (above center)
  const BASE = cy + 22;          // base wings  (below center)
  const MID  = cy + 12;          // narrowing point

  const TAIL_TIP  = cy + (r - 62); // tail bottom
  const TAIL_WING = cy - 16;        // tail wing spread

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: "block",
        filter: aligned
          ? "drop-shadow(0 0 22px rgba(201,168,76,0.20)) drop-shadow(0 8px 32px rgba(0,0,0,0.38))"
          : "drop-shadow(0 8px 32px rgba(0,0,0,0.42))",
        transition: "filter 0.8s ease",
      }}
    >
      <defs>
        {/* Compass face gradient */}
        <radialGradient id="qFace" cx="50%" cy="50%" r="50%">
          <stop offset="0%"
            stopColor={lightMode ? "#fef9ee" : "#112218"}
            stopOpacity="0.92"/>
          <stop offset="100%"
            stopColor={lightMode ? "#ede4cc" : "#08130f"}
            stopOpacity="1"/>
        </radialGradient>

        {/* Needle glow (active when aligned) */}
        <filter id="qNeedleGlow" x="-60%" y="-30%" width="220%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/>
          <feFlood floodColor={GOLD} floodOpacity="0.75" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* Kaaba glow */}
        <filter id="qKaabaGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur"/>
          <feFlood floodColor={GOLD} floodOpacity="1" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* ── Outer decorative rings ── */}
      <circle cx={cx} cy={cy} r={r - 2}
        fill="none" stroke={GOLD} strokeWidth="0.4" opacity="0.2"/>

      {/* Alignment pulse ring — shown only when aligned */}
      {aligned && (
        <circle cx={cx} cy={cy} r={r - 7}
          fill="none" stroke={GOLD} strokeWidth="2" opacity="0.35"
          className="q-align-ring"/>
      )}

      {/* Tick ring border */}
      <circle cx={cx} cy={cy} r={r - 11}
        fill="none" stroke={GOLD} strokeWidth="1.2" opacity="0.5"/>

      {/* Compass face */}
      <circle cx={cx} cy={cy} r={r - 27} fill="url(#qFace)"/>

      {/* Inner ring detail */}
      <circle cx={cx} cy={cy} r={r - 27}
        fill="none" stroke={GOLD} strokeWidth="0.7" opacity="0.28"/>

      {/* Second inner ring */}
      <circle cx={cx} cy={cy} r={r - 38}
        fill="none" stroke={GOLD} strokeWidth="0.3" opacity="0.15"/>

      {/* ── Tick marks ── */}
      {ticks.map((t, i) => (
        <line key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={GOLD} strokeWidth={t.sw} opacity={t.op}/>
      ))}

      {/* ── Cardinal labels ── */}
      {cardinals.map(({ d, l, fill, fs, fw }) => {
        const { x, y } = pos(d, LABEL_R);
        return (
          <text key={d} x={x} y={y}
            textAnchor="middle" dominantBaseline="central"
            fill={fill} fontSize={fs} fontWeight={fw}
            fontFamily="Georgia, serif">
            {l}
          </text>
        );
      })}

      {/* ── Degree labels (30° intervals, non-cardinal) ── */}
      {degLabels.map(d => {
        const { x, y } = pos(d, DEG_R - 2);
        return (
          <text key={d} x={x} y={y}
            textAnchor="middle" dominantBaseline="central"
            fill={GOLD} fontSize="8.5"
            fontFamily="Georgia, serif" opacity="0.42">
            {d}
          </text>
        );
      })}

      {/* ── Subtle crosshair ── */}
      <line x1={cx} y1={cy - 20} x2={cx} y2={cy + 20}
        stroke={GOLD} strokeWidth="0.35" opacity="0.14"/>
      <line x1={cx - 20} y1={cy} x2={cx + 20} y2={cy}
        stroke={GOLD} strokeWidth="0.35" opacity="0.14"/>

      {/* ── North arrow notch on outer ring ── */}
      <path
        d={`M${cx},${cy - (r - 10)} L${cx - 5},${cy - (r - 20)} L${cx + 5},${cy - (r - 20)} Z`}
        fill={NORTH_RED} opacity="0.85"/>

      {/* ═══════════════════════════════════════════════════════════════════
          Rotating needle — points toward Qibla
          CSS transform used for smooth transition (more reliable than SVG attr)
      ═══════════════════════════════════════════════════════════════════ */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `rotate(${needleAngle}deg)`,
        transition: "transform 0.42s cubic-bezier(0.23, 1, 0.32, 1)",
      }}>

        {/* Kaaba aura — subtle pulse when aligned */}
        {aligned && (
          <circle
            cx={cx} cy={TIP + 6}
            r="22" fill={GOLD}
            className="q-kaaba-pulse"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}

        {/* ── Main needle body (Qibla direction — upward) ── */}
        <path
          d={`M${cx},${TIP} L${cx - 9},${BASE} L${cx},${MID} L${cx + 9},${BASE} Z`}
          fill={GOLD}
          opacity={aligned ? 1 : 0.88}
          filter={aligned ? "url(#qNeedleGlow)" : undefined}
        />

        {/* ── Tail (away from Qibla) ── */}
        <path
          d={`M${cx},${TAIL_TIP} L${cx - 6},${TAIL_WING} L${cx},${TAIL_WING + 10} L${cx + 6},${TAIL_WING} Z`}
          fill={GOLD} opacity="0.2"
        />

        {/* ── Kaaba emoji marker at needle tip ── */}
        <text
          x={cx} y={TIP + 8}
          textAnchor="middle" dominantBaseline="central"
          fontSize={aligned ? "22" : "20"}
          filter={aligned ? "url(#qKaabaGlow)" : undefined}
          style={{
            transition: "font-size 0.4s ease",
            filter: aligned
              ? "drop-shadow(0 0 10px rgba(201,168,76,0.95)) drop-shadow(0 0 22px rgba(201,168,76,0.55))"
              : "drop-shadow(0 2px 6px rgba(201,168,76,0.5))",
          }}
        >
          🕋
        </text>
      </g>

      {/* ── Center cap ── */}
      <circle cx={cx} cy={cy} r="13"
        fill={lightMode ? "#fdf8ed" : "#091610"}
        stroke={GOLD} strokeWidth="2.5"/>
      <circle cx={cx} cy={cy} r="5.5" fill={GOLD}/>
      <circle cx={cx} cy={cy} r="2"
        fill={lightMode ? "#fdf8ed" : "#091610"}/>
    </svg>
  );
};

// ─── Main QiblaPage ───────────────────────────────────────────────────────────
export default function QiblaPage({ onBack, lightMode, textSize = 1 }) {
  const [qiblaAngle,   setQiblaAngle]   = useState(null);
  const [bearing,      setBearing]      = useState(0);
  const [locError,     setLocError]     = useState(null);
  const [city,         setCity]         = useState("");
  const [locationName, setLocationName] = useState("");
  const [showCity,     setShowCity]     = useState(false);

  const smoothRef = useRef(0);

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const gold      = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim   = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr   = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint = lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr   = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.85)";
  const textDim   = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg  = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const inputBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.06)";

  // ── Smoothed compass bearing (exponential moving average) ───────────────────
  useEffect(() => {
    const onOrientation = (e) => {
      if (e.alpha == null) return;
      // Shortest-path interpolation to avoid wrap-around jumps
      const raw  = e.alpha;
      const diff = ((raw - smoothRef.current) + 540) % 360 - 180;
      smoothRef.current = (smoothRef.current + diff * 0.14 + 360) % 360;
      setBearing(Math.round(smoothRef.current * 10) / 10);
    };

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then(p => { if (p === "granted") window.addEventListener("deviceorientation", onOrientation); })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientationabsolute", onOrientation, true);
      window.addEventListener("deviceorientation", onOrientation);
    }

    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onOrientation);
    };
  }, []);

  // ── Geolocation + reverse geocode ──────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported");
      setShowCity(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setQiblaAngle(calculateQibla(coords.latitude, coords.longitude));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en", "User-Agent": "NUR-Islamic-PWA/2.0" } }
          );
          const d = await res.json();
          const a = d.address || {};
          const name    = a.city || a.town || a.village || a.county || a.state || "Your Location";
          const country = a.country || "";
          setLocationName(country ? `${name}, ${country}` : name);
        } catch {
          setLocationName("Current Location");
        }
      },
      () => { setLocError("Location access denied"); setShowCity(true); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── City lookup ─────────────────────────────────────────────────────────────
  const lookupCity = async () => {
    if (!city.trim()) return;
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1`
      );
      const d = await res.json();
      if (d.results?.[0]) {
        const { latitude, longitude, name, country } = d.results[0];
        setQiblaAngle(calculateQibla(latitude, longitude));
        setLocationName(country ? `${name}, ${country}` : name);
        setLocError(null);
        setShowCity(false);
      }
    } catch {}
  };

  // ── Alignment calculation ───────────────────────────────────────────────────
  const diff = qiblaAngle !== null
    ? (() => { let d = ((qiblaAngle - bearing) % 360 + 360) % 360; return d > 180 ? d - 360 : d; })()
    : null;

  const aligned  = diff !== null && Math.abs(diff) <= 5;
  const absDiff  = diff !== null ? Math.abs(Math.round(diff)) : null;

  // Status pill config
  const status = diff !== null
    ? aligned
      ? {
          icon: "✓",
          text: "Facing Qibla",
          sub:  "Allahu Akbar · You are aligned with the Qibla",
          color: "#4caf84",
          bg:    "rgba(76,175,132,0.11)",
          bdr:   "rgba(76,175,132,0.42)",
          shadow:"rgba(76,175,132,0.13)",
        }
      : diff > 0
      ? {
          icon: "↻",
          text: `Turn Right  ${absDiff}°`,
          sub:  "Rotate clockwise to face the Qibla",
          color: gold, bg: goldFaint, bdr: goldBdr, shadow: "rgba(0,0,0,0.06)",
        }
      : {
          icon: "↺",
          text: `Turn Left  ${absDiff}°`,
          sub:  "Rotate counter-clockwise to face the Qibla",
          color: gold, bg: goldFaint, bdr: goldBdr, shadow: "rgba(0,0,0,0.06)",
        }
    : null;

  const compassSize = Math.min(300, (typeof window !== "undefined" ? window.innerWidth : 390) - 48);

  // ── Info metrics for the row below the compass ─────────────────────────────
  const metrics = [
    { label: "Qibla",   value: qiblaAngle !== null ? `${Math.round(qiblaAngle)}°` : "—", sub: "from North" },
    { label: "Heading", value: `${Math.round(bearing)}°`,                                sub: "current"   },
    { label: "Off by",  value: absDiff !== null ? `${absDiff}°` : "—",                  sub: "offset", highlight: aligned },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", position:"relative" }}>

      {/* ── Global animations ── */}
      <style>{`
        @keyframes qAlignRing {
          0%, 100% { opacity: 0.22; }
          50%       { opacity: 0.55; }
        }
        @keyframes qKaabaPulse {
          0%, 100% { transform: scale(1);    opacity: 0.10; }
          50%       { transform: scale(1.50); opacity: 0.19; }
        }
        @keyframes qStatusIn {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .q-align-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: qAlignRing 2.4s ease-in-out infinite;
        }
        .q-kaaba-pulse {
          animation: qKaabaPulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Background pattern ── */}
      <div style={{ position:"absolute", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <GeoBg lightMode={lightMode}/>
      </div>

      {/* ══════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════ */}
      <div style={{
        display:"flex", alignItems:"center", gap:"12px",
        padding:"12px 16px",
        borderBottom:`1px solid ${goldBdr}`,
        background:headerBg, backdropFilter:"blur(14px)",
        flexShrink:0, position:"relative", zIndex:2,
      }}>
        <button onClick={onBack}
          style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>
          ←
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>
            Qibla Direction
          </div>
          {/* Location display — under title */}
          {locationName && (
            <div style={{
              color:goldDim, fontSize:"11px", marginTop:"2px",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>
              📍 {locationName}
            </div>
          )}
        </div>

        {/* Change City — secondary action, visually quiet */}
        <button
          onClick={() => setShowCity(v => !v)}
          style={{
            background: showCity ? goldFaint : "transparent",
            border:`1px solid ${showCity ? gold : goldBdr}`,
            borderRadius:"8px", padding:"5px 11px",
            color: showCity ? gold : goldDim,
            fontSize:"11px", cursor:"pointer", fontFamily:"Nunito, sans-serif",
            transition:"all 0.2s", flexShrink:0,
            fontWeight: showCity ? 700 : 400,
          }}
        >
          📍 City
        </button>
      </div>

      {/* ── City input (slides in below header) ── */}
      {showCity && (
        <div style={{
          padding:"10px 16px", borderBottom:`1px solid ${goldBdr}`,
          background:headerBg, flexShrink:0, position:"relative", zIndex:2,
          animation:"qStatusIn 0.2s ease",
        }}>
          <div style={{ display:"flex", gap:"8px" }}>
            <input
              value={city} onChange={e => setCity(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupCity()}
              placeholder="e.g. London, Cairo, Karachi…"
              style={{
                flex:1, background:inputBg,
                border:`1px solid ${goldBdr}`, borderRadius:"10px",
                padding:"9px 12px", color:textClr,
                fontSize:"13px", outline:"none", fontFamily:"Nunito, sans-serif",
              }}
            />
            <button onClick={lookupCity}
              style={{
                padding:"9px 18px", borderRadius:"10px",
                background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`,
                border:"none", color:lightMode?"#fff":"#0d1f14",
                fontSize:"13px", fontWeight:700, cursor:"pointer",
                fontFamily:"Nunito, sans-serif",
              }}>
              Go
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"14px 24px 20px",
        position:"relative", zIndex:1, overflow:"hidden",
        gap:"0px",
      }}>

        {qiblaAngle !== null ? (
          <>
            {/* ── Alignment status pill ─────────────────────── */}
            {status && (
              <div style={{
                marginBottom:"20px", textAlign:"center",
                animation:"qStatusIn 0.4s ease",
              }}>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:"10px",
                  padding:"11px 26px", borderRadius:"50px",
                  background: status.bg,
                  border:`1.5px solid ${status.bdr}`,
                  boxShadow:`0 4px 18px ${status.shadow}`,
                  transition:"background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease",
                }}>
                  <span style={{
                    fontSize:"20px", color:status.color,
                    fontWeight:800, lineHeight:1,
                    fontFamily:"Georgia, serif",
                  }}>
                    {status.icon}
                  </span>
                  <span style={{
                    color:status.color,
                    fontSize:`${15 * textSize}px`,
                    fontWeight:800, letterSpacing:"0.3px",
                  }}>
                    {status.text}
                  </span>
                </div>
                <div style={{
                  color:textDim, fontSize:`${11 * textSize}px`,
                  marginTop:"8px", letterSpacing:"0.2px",
                }}>
                  {status.sub}
                </div>
              </div>
            )}

            {/* ── Compass hero ─────────────────────────────── */}
            <div style={{
              borderRadius:"50%",
              boxShadow: aligned
                ? `0 0 56px rgba(201,168,76,0.16), 0 20px 60px rgba(0,0,0,0.32)`
                : `0 20px 60px rgba(0,0,0,0.32)`,
              transition:"box-shadow 0.8s ease",
              marginBottom:"22px",
              flexShrink:0,
            }}>
              <CompassSVG
                bearing={bearing}
                qibla={qiblaAngle}
                size={compassSize}
                aligned={aligned}
                lightMode={lightMode}
              />
            </div>

            {/* ── Metric row ───────────────────────────────── */}
            <div style={{
              display:"flex", alignItems:"center",
              gap:"0px", marginBottom:"16px",
              background:goldFaint,
              border:`1px solid ${goldBdr}`,
              borderRadius:"16px", overflow:"hidden",
            }}>
              {metrics.map(({ label, value, sub, highlight }, i) => (
                <div key={label} style={{ display:"flex", alignItems:"center" }}>
                  {i > 0 && (
                    <div style={{ width:"1px", height:"40px", background:goldBdr, opacity:0.7 }}/>
                  )}
                  <div style={{
                    padding:"12px 20px", textAlign:"center", minWidth:"76px",
                  }}>
                    <div style={{
                      color:goldDim, fontSize:"9px", letterSpacing:"1.8px",
                      textTransform:"uppercase", marginBottom:"3px",
                    }}>
                      {label}
                    </div>
                    <div style={{
                      color: highlight ? "#4caf84" : textClr,
                      fontSize:`${17 * textSize}px`,
                      fontWeight:800, fontVariantNumeric:"tabular-nums",
                      transition:"color 0.5s ease",
                    }}>
                      {value}
                    </div>
                    <div style={{ color:textDim, fontSize:"9px", marginTop:"2px" }}>
                      {sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Polished instruction text ─────────────────── */}
            <div style={{
              color:textDim, fontSize:`${11 * textSize}px`,
              textAlign:"center", lineHeight:1.9,
              letterSpacing:"0.3px",
            }}>
              Hold your phone level and follow the 🕋 marker
            </div>
          </>
        ) : (
          /* ── No location state ──────────────────────────── */
          <div style={{ textAlign:"center", padding:"16px" }}>
            {locError ? (
              <>
                <div style={{ fontSize:"40px", marginBottom:"18px", opacity:0.55 }}>📍</div>
                <div style={{
                  color:gold, fontSize:`${16 * textSize}px`,
                  fontWeight:700, marginBottom:"10px",
                }}>
                  Location Required
                </div>
                <div style={{
                  color:textDim, fontSize:`${13 * textSize}px`,
                  lineHeight:1.85, marginBottom:"26px", maxWidth:"240px",
                }}>
                  {locError}. Enter your city to find your Qibla direction.
                </div>
                <button onClick={() => setShowCity(true)}
                  style={{
                    padding:"14px 36px", borderRadius:"50px",
                    background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`,
                    border:"none", color:lightMode?"#fff":"#0d1f14",
                    fontSize:`${14 * textSize}px`, fontWeight:800,
                    cursor:"pointer", fontFamily:"Nunito, sans-serif",
                    boxShadow:`0 6px 24px ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.22)"}`,
                  }}>
                  Enter Your City
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize:"38px", marginBottom:"18px", opacity:0.45 }}>🧭</div>
                <div style={{ color:goldDim, fontSize:`${13 * textSize}px`, lineHeight:1.8 }}>
                  Finding your location…
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
