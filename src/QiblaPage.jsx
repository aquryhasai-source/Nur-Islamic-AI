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
        <circle cx="40" cy="3" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="77" cy="22" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="77" cy="58" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="40" cy="77" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="3" cy="58" r="1.5" fill="#c9a84c" opacity="0.4"/>
        <circle cx="3" cy="22" r="1.5" fill="#c9a84c" opacity="0.4"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#q-geo)"/>
  </svg>
);

// ─── Compass SVG — rotating ring design ──────────────────────────────────────
//
// HOW IT WORKS:
// • The RING (N/E/S/W labels + ticks) rotates by -bearing so N always tracks
//   true magnetic north regardless of which way the phone is pointing.
// • The NEEDLE is a completely separate SVG group. It rotates by
//   (qibla - bearing) so it always points toward Mecca in world space.
// • A fixed gold triangle at 12 o'clock (never rotates) shows where
//   the phone is currently pointing. When needle aligns with it → Facing Qibla.
//
// Keeps a continuously-accumulating ("unwrapped") version of an angle that
// would otherwise be reported mod 360. Feeding the wrapped value straight
// into a CSS `transform: rotate()` transition makes the browser interpolate
// the raw numeric gap between the old and new values — so a real ~2° step
// that happens to cross the 0°/360° seam (e.g. 359° → 1°) gets rendered as a
// ~358° spin the WRONG way (this is exactly the "needle runs back around
// through the south instead of crossing N" bug). rotate(361deg) looks
// identical to rotate(1deg) but animates smoothly from rotate(359deg), so
// this hook tracks the shortest signed step each render and accumulates it,
// letting the value drift past 360 or below 0 instead of resetting.
function useUnwrappedAngle(targetDeg) {
  const prevWrapped = useRef(null);
  const unwrapped = useRef(0);
  if (prevWrapped.current === null) {
    unwrapped.current = targetDeg;
    prevWrapped.current = targetDeg;
  } else {
    const delta = ((targetDeg - prevWrapped.current + 540) % 360) - 180;
    unwrapped.current += delta;
    prevWrapped.current = targetDeg;
  }
  return unwrapped.current;
}

const CompassSVG = ({ bearing, qibla, size, aligned, lightMode }) => {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const GOLD = "#c9a84c";
  const NORTH_RED = "#e07575";

  // Ring rotates opposite to bearing → N tracks true north on screen.
  // Needle points toward Qibla in world space → screen angle = qibla - bearing.
  // Both go through useUnwrappedAngle so the transition never spins the long
  // way around when the raw angle wraps past 0°/360°.
  const rawRingAngle = -bearing;
  const rawNeedleAngle = ((qibla - bearing) % 360 + 360) % 360;
  const ringAngle = useUnwrappedAngle(rawRingAngle);
  const needleAngle = useUnwrappedAngle(rawNeedleAngle);

  // ── Tick marks (live inside the rotating ring group) ─────────────────────
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const deg = i * 5;
    const isCard = deg % 90 === 0;
    const isMed = !isCard && deg % 30 === 0;
    const isTen = !isMed && !isCard && deg % 10 === 0;
    const len = isCard ? 20 : isMed ? 13 : isTen ? 8 : 4;
    const sw = isCard ? 2.2 : isMed ? 1.3 : 0.75;
    const op = isCard ? 1 : isMed ? 0.65 : isTen ? 0.38 : 0.22;
    const rad = (deg - 90) * (Math.PI / 180);
    const outer = r - 12;
    const inner = outer - len;
    return {
      x1: cx + inner * Math.cos(rad), y1: cy + inner * Math.sin(rad),
      x2: cx + outer * Math.cos(rad), y2: cy + outer * Math.sin(rad),
      sw, op,
    };
  });

  const pos = (deg, dist) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + dist * Math.cos(rad), y: cy + dist * Math.sin(rad) };
  };

  const LABEL_R = r - 40;
  const DEG_R = r - 41;

  const cardinals = [
    { d: 0, l: "N", fill: NORTH_RED, fs: 16, fw: "800" },
    { d: 90, l: "E", fill: GOLD, fs: 13, fw: "700" },
    { d: 180, l: "S", fill: GOLD, fs: 13, fw: "700" },
    { d: 270, l: "W", fill: GOLD, fs: 13, fw: "700" },
  ];

  const degLabels = [30, 60, 120, 150, 210, 240, 300, 330];

  // ── Needle geometry ───────────────────────────────────────────────────────
  const TIP = cy - (r - 57);
  const BASE = cy + 22;
  const MID = cy + 12;
  const TAIL_TIP = cy + (r - 62);
  const TAIL_WING = cy - 16;

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
        <radialGradient id="qFace" cx="50%" cy="50%" r="50%">
          <stop offset="0%"
            stopColor={lightMode ? "#fef9ee" : "#112218"} stopOpacity="0.92"/>
          <stop offset="100%"
            stopColor={lightMode ? "#ede4cc" : "#08130f"} stopOpacity="1"/>
        </radialGradient>
        <filter id="qNeedleGlow" x="-60%" y="-30%" width="220%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/>
          <feFlood floodColor={GOLD} floodOpacity="0.75" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="qKaabaGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur"/>
          <feFlood floodColor={GOLD} floodOpacity="1" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── Static outer shell (never rotates) ── */}
      <circle cx={cx} cy={cy} r={r - 2}
        fill="none" stroke={GOLD} strokeWidth="0.4" opacity="0.2"/>
      {aligned && (
        <circle cx={cx} cy={cy} r={r - 7}
          fill="none" stroke={GOLD} strokeWidth="2" opacity="0.35"
          className="q-align-ring"/>
      )}

      {/* Compass face fill */}
      <circle cx={cx} cy={cy} r={r - 27} fill="url(#qFace)"/>
      <circle cx={cx} cy={cy} r={r - 27}
        fill="none" stroke={GOLD} strokeWidth="0.7" opacity="0.28"/>
      <circle cx={cx} cy={cy} r={r - 38}
        fill="none" stroke={GOLD} strokeWidth="0.3" opacity="0.15"/>

      {/* ══════════════════════════════════════════════════════════════════
          ROTATING RING — tracks true magnetic north
          Ring rotates by -bearing so N always points to geographic North
          ══════════════════════════════════════════════════════════════════ */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `rotate(${ringAngle}deg)`,
        transition: "transform 0.35s cubic-bezier(0.23, 1, 0.32, 1)",
      }}>
        {/* Tick ring border */}
        <circle cx={cx} cy={cy} r={r - 11}
          fill="none" stroke={GOLD} strokeWidth="1.2" opacity="0.5"/>

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={GOLD} strokeWidth={t.sw} opacity={t.op}/>
        ))}

        {/* Cardinal labels */}
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

        {/* Degree labels at 30° intervals */}
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

        {/* North marker (red triangle at N position on the ring) */}
        <path
          d={`M${cx},${cy - (r - 10)} L${cx - 5},${cy - (r - 20)} L${cx + 5},${cy - (r - 20)} Z`}
          fill={NORTH_RED} opacity="0.9"/>
      </g>

      {/* ── Fixed heading indicator — gold triangle at 12 o'clock ── */}
      {/* This never rotates. It shows where the phone is currently pointing. */}
      {/* When the Qibla needle aligns with this triangle → Facing Qibla. */}
      <path
        d={`M${cx},${cy - (r - 13)} L${cx - 6},${cy - (r - 26)} L${cx + 6},${cy - (r - 26)} Z`}
        fill={GOLD} opacity="0.9"/>

      {/* Subtle center crosshair */}
      <line x1={cx} y1={cy - 18} x2={cx} y2={cy + 18}
        stroke={GOLD} strokeWidth="0.35" opacity="0.12"/>
      <line x1={cx - 18} y1={cy} x2={cx + 18} y2={cy}
        stroke={GOLD} strokeWidth="0.35" opacity="0.12"/>

      {/* ══════════════════════════════════════════════════════════════════
          QIBLA NEEDLE — completely independent of the ring
          Rotates by (qibla - bearing) to always point toward Mecca
          in world space, regardless of phone orientation.
          ══════════════════════════════════════════════════════════════════ */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `rotate(${needleAngle}deg)`,
        transition: "transform 0.42s cubic-bezier(0.23, 1, 0.32, 1)",
      }}>
        {/* Kaaba aura pulse when aligned */}
        {aligned && (
          <circle
            cx={cx} cy={TIP + 6} r="22" fill={GOLD}
            className="q-kaaba-pulse"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}

        {/* Needle body (points toward Qibla = upward at 0°) */}
        <path
          d={`M${cx},${TIP} L${cx - 9},${BASE} L${cx},${MID} L${cx + 9},${BASE} Z`}
          fill={GOLD}
          opacity={aligned ? 1 : 0.88}
          filter={aligned ? "url(#qNeedleGlow)" : undefined}
        />

        {/* Needle tail */}
        <path
          d={`M${cx},${TAIL_TIP} L${cx - 6},${TAIL_WING} L${cx},${TAIL_WING + 10} L${cx + 6},${TAIL_WING} Z`}
          fill={GOLD} opacity="0.2"
        />

        {/* Kaaba emoji at needle tip */}
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

      {/* ── Center cap (always on top) ── */}
      <circle cx={cx} cy={cy} r="13"
        fill={lightMode ? "#fdf8ed" : "#091610"}
        stroke={GOLD} strokeWidth="2.5"/>
      <circle cx={cx} cy={cy} r="5.5" fill={GOLD}/>
      <circle cx={cx} cy={cy} r="2"
        fill={lightMode ? "#fdf8ed" : "#091610"}/>
    </svg>
  );
};

// ─── Tunable smoothing / hysteresis constants ────────────────────────────────
// FILTER_ALPHA      — low-pass filter strength for the compass heading.
//                      Lower = smoother but slower to react to real turns.
// DISPLAY_DEADZONE  — minimum change (deg) before a filtered reading is
//                      pushed to React state at all. Filters out the residual
//                      sub-degree noise that survives the low-pass filter.
// RENDER_FPS_CAP    — max rate (Hz) at which bearing state (and therefore the
//                      CSS-animated needle) updates. Decouples the render/
//                      transition rate from the raw sensor event rate, which
//                      is what actually stops the needle "wobbling" even when
//                      the underlying value is already filtered.
// ALIGN_ENTER_DEG / ALIGN_EXIT_DEG — asymmetric hysteresis band for the
//                      "Facing Qibla" state, so it doesn't flicker in and out
//                      right at the boundary.
const FILTER_ALPHA = 0.15;
const DISPLAY_DEADZONE_DEG = 0.4;
const RENDER_FPS_CAP = 24;
const ALIGN_ENTER_DEG = 3;
const ALIGN_EXIT_DEG = 6;

// ═════════════════════════════════════════════════════════════════════════════
// QIBLA PAGE EXTRAS (additive) — sensor status, level, distance, route, info.
// Nothing below touches the compass heading / Qibla / alignment logic. It only
// READS existing state (qiblaAngle, bearing, locationName) and adds separate,
// read-only sensor listeners.
// ═════════════════════════════════════════════════════════════════════════════

const KAABA = { lat: 21.422487, lon: 39.826206 };
const EARTH_R_KM = 6371.0088;
const LEVEL_OK_DEG = 15;      // max tilt (either axis) still treated as "level"
const TILT_CLAMP_DEG = 30;    // bubble reaches the ring edge at this tilt
const GOOD = "#4caf84";
const WARN = "#d9a35b";

// Great-circle (haversine) distance in km.
function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const CARD16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const cardinal16 = (deg) => CARD16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const fmtKm = (km) => `${Math.round(km).toLocaleString("en-US")} km`;
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ── Read-only sensor health ──────────────────────────────────────────────────
// Only reports what the browser genuinely exposes:
//   • tilt            — beta/gamma from DeviceOrientation (all platforms)
//   • source          — whether north-referenced (absolute) events are arriving
//   • iOS accuracy    — webkitCompassAccuracy (iOS Safari only)
//   • magnetic field  — Generic Sensor Magnetometer magnitude (Chrome/Android,
//                       where available). Shown as a plain value; never used
//                       for heading and never labelled as "interference".
// Android's DeviceOrientation API has no accuracy value, so none is invented.
function useCompassHealth() {
  const [h, setH] = useState({
    beta: null, gamma: null, source: null, iosAcc: null,
    fieldUT: null, fieldStable: false, needsCal: false,
  });

  useEffect(() => {
    const s = { beta: null, gamma: null, absMs: 0, anyMs: 0, iosAcc: null, field: [], badSince: 0 };

    const takeTilt = (e) => {
      if (e.beta == null || e.gamma == null) return;
      s.beta = s.beta === null ? e.beta : s.beta + (e.beta - s.beta) * 0.3;
      s.gamma = s.gamma === null ? e.gamma : s.gamma + (e.gamma - s.gamma) * 0.3;
    };
    const onAbs = (e) => { const n = Date.now(); s.absMs = n; s.anyMs = n; takeTilt(e); };
    const onRel = (e) => {
      s.anyMs = Date.now();
      takeTilt(e);
      if (typeof e.webkitCompassAccuracy === "number") s.iosAcc = Math.round(e.webkitCompassAccuracy);
    };
    window.addEventListener("deviceorientationabsolute", onAbs, true);
    window.addEventListener("deviceorientation", onRel);

    let mag = null;
    try {
      if (typeof window.Magnetometer === "function") {
        mag = new window.Magnetometer({ frequency: 5 });
        mag.addEventListener("reading", () => {
          const m = Math.hypot(mag.x, mag.y, mag.z);
          if (Number.isFinite(m) && m > 0) {
            s.field.push(m);
            if (s.field.length > 10) s.field.shift();
          }
        });
        mag.addEventListener("error", () => {});
        mag.start();
      }
    } catch { mag = null; }

    const tick = () => {
      const now = Date.now();
      const iosLike = s.iosAcc !== null;
      const source = iosLike ? "ios" : now - s.absMs < 1500 ? "absolute" : now - s.anyMs < 1500 ? "relative" : null;

      // Field magnitude is shown as measured. "Stable" is claimed only when the
      // last ~2s of readings barely vary (evidence), never inferred from the value.
      const n = s.field.length;
      const fieldUT = n >= 3 ? s.field.reduce((x, y) => x + y, 0) / n : null;
      let fieldStable = false;
      if (n >= 10) {
        const sd = Math.sqrt(s.field.reduce((x, y) => x + (y - fieldUT) ** 2, 0) / n);
        fieldStable = sd <= 2;
      }

      // Calibration is only *recommended* (soft hint), after ~2s of iOS
      // reporting poor accuracy. Magnetic field strength is display-only and
      // never triggers this.
      const iosBad = iosLike && (s.iosAcc < 0 || s.iosAcc > 30);
      const bad = iosBad;
      if (bad) { if (!s.badSince) s.badSince = now; } else s.badSince = 0;
      const needsCal = bad && now - s.badSince > 2000;

      const next = {
        beta: s.beta === null ? null : Math.round(s.beta),
        gamma: s.gamma === null ? null : Math.round(s.gamma),
        source, iosAcc: s.iosAcc,
        fieldUT: fieldUT === null ? null : Math.round(fieldUT),
        fieldStable, needsCal,
      };
      setH((prev) => (Object.keys(next).every((k) => prev[k] === next[k]) ? prev : next));
    };
    const id = setInterval(tick, 200);

    return () => {
      clearInterval(id);
      window.removeEventListener("deviceorientationabsolute", onAbs, true);
      window.removeEventListener("deviceorientation", onRel);
      try { if (mag) mag.stop(); } catch {}
    };
  }, []);

  return h;
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function LevelBubble({ beta, gamma, color, t }) {
  // Ball rolls toward the lower side of the phone, like a marble in a dish.
  const dx = clamp(gamma / TILT_CLAMP_DEG, -1, 1) * 9;
  const dy = clamp(beta / TILT_CLAMP_DEG, -1, 1) * 9;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="15" cy="15" r="13.5" fill="none" stroke={t.goldBdr} strokeWidth="1"/>
      <line x1="15" y1="3" x2="15" y2="27" stroke={t.gold} strokeWidth="0.4" opacity="0.25"/>
      <line x1="3" y1="15" x2="27" y2="15" stroke={t.gold} strokeWidth="0.4" opacity="0.25"/>
      <circle cx="15" cy="15" r="5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.75"
        style={{ transition: "stroke 0.4s ease" }}/>
      <circle cx="15" cy="15" r="3.6" fill={color}
        style={{ transform: `translate(${dx}px, ${dy}px)`, transition: "transform 0.25s ease-out, fill 0.4s ease" }}/>
    </svg>
  );
}

function StatCol({ t, textSize, label, value, sub, color, lead, first }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: "11px 6px", textAlign: "center",
      borderLeft: first ? "none" : `1px solid ${t.goldBdr}`,
    }}>
      <div style={{ color: t.goldDim, fontSize: "9px", letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "5px" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", minHeight: "30px" }}>
        {lead}
        <span style={{ color, fontSize: `${12.5 * textSize}px`, fontWeight: 800, lineHeight: 1.25, transition: "color 0.5s ease" }}>
          {value}
        </span>
      </div>
      {sub && <div style={{ color: t.textDim, fontSize: "9px", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

const Dot = ({ color }) => (
  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0, transition: "background 0.5s ease" }}/>
);

// Lightweight geographic route: schematic great-circle arc from the user to
// Makkah. Pure SVG — no map library, no tiles, no network.
function QiblaRoute({ t, textSize, userName, distanceKm, qiblaAngle }) {
  const atKaaba = distanceKm < 1;
  return (
    <svg viewBox="0 0 300 112" width="100%" role="img"
      aria-label={`Qibla route: ${fmtKm(distanceKm)} to Makkah, bearing ${Math.round(qiblaAngle)} degrees`}
      style={{ display: "block" }}>
      <defs>
        <marker id="qRouteArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={t.gold} opacity="0.9"/>
        </marker>
      </defs>
      {/* faint graticule */}
      {[28, 56, 84].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke={t.gold} strokeWidth="0.4" strokeDasharray="1 5" opacity="0.14"/>
      ))}
      {[50, 100, 150, 200, 250].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="112" stroke={t.gold} strokeWidth="0.4" strokeDasharray="1 5" opacity="0.1"/>
      ))}
      {!atKaaba && (
        <path d="M49,66 Q150,12 251,66" fill="none" stroke={t.gold} strokeWidth="1.6"
          strokeLinecap="round" opacity="0.75" markerEnd="url(#qRouteArrow)" className="q-route-flow"/>
      )}
      {/* you */}
      <circle cx="40" cy="70" r="9" fill="none" stroke={t.gold} strokeWidth="0.8" opacity="0.4" className="q-align-ring"/>
      <circle cx="40" cy="70" r="5" fill={t.gold}/>
      <circle cx="40" cy="70" r="1.8" fill="#091610"/>
      {/* Makkah */}
      <circle cx="260" cy="70" r="12" fill="#091610" stroke={t.gold} strokeWidth="1.4"/>
      <text x="260" y="71" textAnchor="middle" dominantBaseline="central" fontSize="13">🕋</text>
      {/* labels */}
      {!atKaaba && (
        <>
          <text x="150" y="30" textAnchor="middle" fill={t.gold} fontSize="13" fontWeight="800"
            style={{ fontVariantNumeric: "tabular-nums" }}>{fmtKm(distanceKm)}</text>
          <text x="150" y="56" textAnchor="middle" fill={t.textDim} fontSize="9" letterSpacing="0.4">
            {Math.round(qiblaAngle)}° {cardinal16(qiblaAngle)}
          </text>
        </>
      )}
      {atKaaba && (
        <text x="150" y="44" textAnchor="middle" fill={t.gold} fontSize="12" fontWeight="700">You are at the Kaaba</text>
      )}
      <text x="12" y="100" textAnchor="start" fill={t.textClr} fontSize="9.5" opacity="0.8">
        {trunc(userName || "You", 16)}
      </text>
      <text x="288" y="100" textAnchor="end" fill={t.textClr} fontSize="9.5" opacity="0.8">Makkah</text>
    </svg>
  );
}

// ── Extras section, rendered below the existing metric row ───────────────────
function QiblaExtras({ t, textSize, health, distanceKm, qiblaAngle, locationName, calDismissed, onDismissCal }) {
  const glass = {
    width: "100%", maxWidth: "340px",
    background: t.goldFaint, border: `1px solid ${t.goldBdr}`, borderRadius: "16px",
    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
    animation: "qStatusIn 0.4s ease",
  };

  // Level
  const hasTilt = health.beta !== null && health.gamma !== null;
  const tiltMax = hasTilt ? Math.max(Math.abs(health.beta), Math.abs(health.gamma)) : null;
  const isLevel = hasTilt && tiltMax <= LEVEL_OK_DEG;
  const lvlColor = !hasTilt ? t.textDim : isLevel ? GOOD : WARN;

  // Compass column — real values only
  let cValue = "No signal", cSub = "check permissions", cColor = WARN;
  if (health.source === "ios") {
    const a = health.iosAcc;
    const grade = a < 0 || a > 30 ? "Low" : a <= 15 ? "High" : "Medium";
    cValue = grade;
    cColor = grade === "High" ? GOOD : grade === "Medium" ? t.gold : WARN;
    cSub = a >= 0 ? `± ${a}°` : "uncalibrated";
  } else if (health.source === "absolute") {
    cValue = "Active"; cColor = GOOD; cSub = "north-referenced";
  } else if (health.source === "relative") {
    cValue = "Relative"; cColor = WARN; cSub = "not north-locked";
  }

  // Magnetic field column — the measured value; "Stable" only with evidence
  const hasField = health.fieldUT !== null;
  const showCal = health.needsCal && !calDismissed;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%", marginTop: "16px" }}>

      {/* ── Sensor status: compass · magnetic field · level ── */}
      <div style={{ ...glass, display: "flex", overflow: "hidden" }}>
        <StatCol first t={t} textSize={textSize} label="Compass" value={cValue} sub={cSub} color={cColor}
          lead={<Dot color={cColor}/>}/>
        {hasField && (
          <StatCol t={t} textSize={textSize} label="Magnetic field"
            value={health.fieldStable ? "Stable" : `${health.fieldUT} µT`}
            sub={health.fieldStable ? `${health.fieldUT} µT` : null}
            color={health.fieldStable ? GOOD : t.textClr}
            lead={health.fieldStable ? <Dot color={GOOD}/> : null}/>
        )}
        <StatCol t={t} textSize={textSize} label="Level"
          value={!hasTilt ? "—" : isLevel ? "Phone level ✓" : "Hold your phone level"}
          sub={!hasTilt ? "no tilt data" : null} color={lvlColor}
          lead={hasTilt ? <LevelBubble beta={health.beta} gamma={health.gamma} color={lvlColor} t={t}/> : null}/>
      </div>

      {/* ── Calibration hint (only when sensor data warrants it) ── */}
      {showCal && (
        <div style={{ ...glass, display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px" }}>
          <svg width="46" height="24" viewBox="0 0 48 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M24,12 C24,4 8,4 8,12 C8,20 24,20 24,12 C24,4 40,4 40,12 C40,20 24,20 24,12"
              fill="none" stroke={t.gold} strokeWidth="1" opacity="0.25"/>
            <path d="M24,12 C24,4 8,4 8,12 C8,20 24,20 24,12 C24,4 40,4 40,12 C40,20 24,20 24,12"
              fill="none" stroke={t.gold} strokeWidth="2" strokeLinecap="round" pathLength="100"
              className="q-fig8"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: t.gold, fontSize: `${12 * textSize}px`, fontWeight: 800 }}>Compass calibration recommended</div>
            <div style={{ color: t.textDim, fontSize: `${11 * textSize}px`, marginTop: "2px" }}>Move your phone in a figure-8</div>
          </div>
          <button onClick={onDismissCal} aria-label="Dismiss calibration tip"
            style={{ background: "none", border: "none", color: t.goldDim, fontSize: "18px", cursor: "pointer", padding: "4px", lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* ── Kaaba distance / bearing ── */}
      {distanceKm !== null && (
        <div style={{ ...glass, display: "flex", overflow: "hidden" }}>
          <StatCol first t={t} textSize={textSize * 1.35} label="Kaaba"
            value={fmtKm(distanceKm)} color={t.textClr}/>
          <StatCol t={t} textSize={textSize * 1.35} label="Qibla bearing"
            value={`${Math.round(qiblaAngle)}°`} sub={cardinal16(qiblaAngle)} color={t.textClr}/>
        </div>
      )}

      {/* ── Mini Qibla route ── */}
      {distanceKm !== null && (
        <div style={{ ...glass, padding: "10px 12px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: t.goldDim, fontSize: "9px", letterSpacing: "1.8px", textTransform: "uppercase" }}>Qibla route</span>
            <span style={{ color: t.textDim, fontSize: "9px" }}>great-circle · schematic</span>
          </div>
          <QiblaRoute t={t} textSize={textSize} userName={locationName} distanceKm={distanceKm} qiblaAngle={qiblaAngle}/>
        </div>
      )}
    </div>
  );
}

// ─── Main QiblaPage ───────────────────────────────────────────────────────────
export default function QiblaPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const [qiblaAngle, setQiblaAngle] = useState(null);
  const [bearing, setBearing] = useState(0);
  const [aligned, setAligned] = useState(false);
  const [locError, setLocError] = useState(null);
  const [city, setCity] = useState("");
  const [locationName, setLocationName] = useState("");
  const [showCity, setShowCity] = useState(false);
  const smoothRef = useRef(0);
  const alignedRef = useRef(false);

  // ── Extras state (additive — does not affect compass logic) ────────────────
  const [userPos, setUserPos] = useState(null);       // { lat, lon }
  const [calDismissed, setCalDismissed] = useState(false);
  const health = useCompassHealth();

  // Re-arm the calibration tip once the sensor problem clears.
  useEffect(() => { if (!health.needsCal) setCalDismissed(false); }, [health.needsCal]);

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const gold = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim = lightMode ? "rgba(122,88,16,0.55)" : "rgba(201,168,76,0.5)";
  const goldBdr = lightMode ? "rgba(122,88,16,0.2)" : "rgba(201,168,76,0.2)";
  const goldFaint = lightMode ? "rgba(122,88,16,0.08)" : "rgba(201,168,76,0.07)";
  const textClr = lightMode ? "rgba(26,15,0,0.82)" : "rgba(255,255,240,0.85)";
  const textDim = lightMode ? "rgba(26,15,0,0.4)" : "rgba(255,255,255,0.38)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const inputBg = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.06)";

  // ── Compass bearing — absolute priority with timestamp fallback ─────────────
  // Reverted back to the original deviceorientationabsolute / deviceorientation
  // approach (the Generic Sensor API experiment was removed — on-device it
  // wasn't reporting a proper north-referenced heading, so the ring/needle
  // ended up rotating WITH the phone instead of staying counter-rotated
  // against it). Every raw sample still runs through the same low-pass
  // filter, and commits to React state through a render-rate-capped,
  // dead-zone-gated loop, which is what's actually cutting the jitter.
  useEffect(() => {
    let animFrame = null;
    let lastFrameTime = 0;
    let pendingHeading = null;
    let lastRenderedHeading = null;
    let lastAbsoluteMs = 0;
    const STALE_MS = 1000;
    const frameInterval = 1000 / RENDER_FPS_CAP;

    // Push one raw heading sample through the circular low-pass filter.
    // Cheap — just updates refs, no re-render here.
    const feedHeading = (heading) => {
      const diff = ((heading - smoothRef.current) + 540) % 360 - 180;
      smoothRef.current = (smoothRef.current + diff * FILTER_ALPHA + 360) % 360;
      pendingHeading = smoothRef.current;
    };

    // rAF loop, capped to RENDER_FPS_CAP, that actually commits the filtered
    // heading to React state — and only when it moved more than the display
    // dead zone since the last commit.
    const renderLoop = (t) => {
      if (t - lastFrameTime >= frameInterval) {
        lastFrameTime = t;
        if (pendingHeading !== null) {
          const last = lastRenderedHeading;
          const delta = last === null
            ? Infinity
            : Math.abs(((pendingHeading - last + 540) % 360) - 180);
          if (delta >= DISPLAY_DEADZONE_DEG) {
            lastRenderedHeading = pendingHeading;
            setBearing(Math.round(pendingHeading * 10) / 10);
          }
        }
      }
      animFrame = requestAnimationFrame(renderLoop);
    };
    animFrame = requestAnimationFrame(renderLoop);

    // DeviceOrientation alpha uses a counter-clockwise convention on many
    // Android browsers. Convert to a standard compass bearing where:
    // 0° = North, 90° = East, 180° = South, 270° = West.
    const onAbsolute = (e) => {
      if (e.alpha == null) return;
      lastAbsoluteMs = Date.now();
      feedHeading((360 - e.alpha) % 360);
    };
    const onRelative = (e) => {
      if (e.alpha == null) return;
      if (Date.now() - lastAbsoluteMs < STALE_MS) return; // absolute is fresh, skip
      feedHeading((360 - e.alpha) % 360);
    };

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      // iOS — requestPermission required; deviceorientation IS north-referenced on iOS
      DeviceOrientationEvent.requestPermission()
        .then(p => {
          if (p === "granted") {
            window.addEventListener("deviceorientationabsolute", onAbsolute, true);
            window.addEventListener("deviceorientation", onRelative);
          }
        })
        .catch(() => {});
    } else {
      // Android / Desktop
      window.addEventListener("deviceorientationabsolute", onAbsolute, true);
      window.addEventListener("deviceorientation", onRelative);
    }

    return () => {
      window.removeEventListener("deviceorientationabsolute", onAbsolute);
      window.removeEventListener("deviceorientation", onRelative);
      if (animFrame) cancelAnimationFrame(animFrame);
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
        setUserPos({ lat: coords.latitude, lon: coords.longitude });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en", "User-Agent": "NUR-Islamic-PWA/2.0" } }
          );
          const d = await res.json();
          const a = d.address || {};
          const name = a.city || a.town || a.village || a.county || a.state || "Your Location";
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
        setUserPos({ lat: latitude, lon: longitude });
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

  const absDiff = diff !== null ? Math.abs(Math.round(diff)) : null;

  // Hysteresis for the "Facing Qibla" state: enter the aligned state once
  // within ALIGN_ENTER_DEG, but only leave it once the drift exceeds
  // ALIGN_EXIT_DEG. This dead zone stops the status pill, glow and needle
  // highlight from flickering when the true heading sits right at the edge
  // of a single fixed threshold.
  useEffect(() => {
    if (diff === null) {
      if (alignedRef.current) {
        alignedRef.current = false;
        setAligned(false);
      }
      return;
    }
    const absD = Math.abs(diff);
    if (!alignedRef.current && absD <= ALIGN_ENTER_DEG) {
      alignedRef.current = true;
      setAligned(true);
    } else if (alignedRef.current && absD > ALIGN_EXIT_DEG) {
      alignedRef.current = false;
      setAligned(false);
    }
  }, [diff]);

  // Status pill config
  const status = diff !== null
    ? aligned
      ? {
          icon: "✓",
          text: "Facing Qibla",
          sub: "Allahu Akbar · You are aligned with the Qibla",
          color: "#4caf84",
          bg: "rgba(76,175,132,0.11)",
          bdr: "rgba(76,175,132,0.42)",
          shadow:"rgba(76,175,132,0.13)",
        }
      : diff > 0
        ? {
            icon: "↻",
            text: `Turn Right ${absDiff}°`,
            sub: "Rotate clockwise to face the Qibla",
            color: gold, bg: goldFaint, bdr: goldBdr, shadow: "rgba(0,0,0,0.06)",
          }
        : {
            icon: "↺",
            text: `Turn Left ${absDiff}°`,
            sub: "Rotate counter-clockwise to face the Qibla",
            color: gold, bg: goldFaint, bdr: goldBdr, shadow: "rgba(0,0,0,0.06)",
          }
    : null;

  const compassSize = Math.min(300, (typeof window !== "undefined" ? window.innerWidth : 390) - 48);

  // Great-circle distance to the Kaaba, from the same coordinates used for the Qibla bearing.
  const distanceKm = userPos ? haversineKm(userPos.lat, userPos.lon, KAABA.lat, KAABA.lon) : null;

  // ── Info metrics for the row below the compass ─────────────────────────────
  const metrics = [
    { label: "Qibla", value: qiblaAngle !== null ? `${Math.round(qiblaAngle)}°` : "—", sub: "from North" },
    { label: "Heading", value: `${Math.round(bearing)}°`, sub: "current" },
    { label: "Off by", value: absDiff !== null ? `${absDiff}°` : "—", sub: "offset", highlight: aligned },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", position:"relative" }}>
      {/* ── Global animations ── */}
      <style>{`
        @keyframes qAlignRing {
          0%, 100% { opacity: 0.22; }
          50% { opacity: 0.55; }
        }
        @keyframes qKaabaPulse {
          0%, 100% { transform: scale(1); opacity: 0.10; }
          50% { transform: scale(1.50); opacity: 0.19; }
        }
        @keyframes qStatusIn {
          from { opacity: 0; transform: translateY(7px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .q-align-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: qAlignRing 2.4s ease-in-out infinite;
        }
        .q-kaaba-pulse {
          animation: qKaabaPulse 2s ease-in-out infinite;
        }
        @keyframes qRouteFlow { to { stroke-dashoffset: -22; } }
        @keyframes qFig8 { to { stroke-dashoffset: -100; } }
        .q-route-flow { stroke-dasharray: 5 6; animation: qRouteFlow 2.2s linear infinite; }
        .q-fig8 { stroke-dasharray: 22 78; animation: qFig8 2.6s linear infinite; }
      `}</style>

      {/* ── Background pattern ── */}
      <div style={{ position:"absolute", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <GeoBg lightMode={lightMode}/>
      </div>

      {/* ══════════════════════════════════════════════════════
          HEADER
          ══════════════════════════════════════════════════════ */}
      <div style={{
        display:"flex", alignItems:"center",
        padding:"12px 16px",
        borderBottom:`1px solid ${goldBdr}`,
        background:headerBg, backdropFilter:"blur(14px)",
        flexShrink:0, position:"relative", zIndex:2,
      }}>
        {/* Hamburger — opens sidebar */}
        <button onClick={onOpenSidebar}
          style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>

        {/* Centered title + location */}
        <div style={{ flex:1, textAlign:"center", minWidth:0 }}>
          <div style={{ color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>
            Qibla Direction
          </div>
          {locationName && (
            <div style={{
              color:goldDim, fontSize:`${11*textSize}px`, marginTop:"2px",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>
              📍 {locationName}
            </div>
          )}
        </div>

        {/* City toggle + Back */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
          <button
            onClick={() => setShowCity(v => !v)}
            style={{
              background: showCity ? goldFaint : "transparent",
              border:`1px solid ${showCity ? gold : goldBdr}`,
              borderRadius:"8px", padding:"5px 10px",
              color: showCity ? gold : goldDim,
              fontSize:"11px", cursor:"pointer", fontFamily:"Nunito, sans-serif",
              transition:"all 0.2s", fontWeight: showCity ? 700 : 400,
            }}
          >
            📍
          </button>
          <button onClick={onBack}
            style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 4px" }}>
            ←
          </button>
        </div>
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
        alignItems:"center", justifyContent:"flex-start",
        padding:"14px 24px 32px",
        position:"relative", zIndex:1, overflowX:"hidden", overflowY:"auto",
        WebkitOverflowScrolling:"touch",
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

            <QiblaExtras
              t={{ gold, goldDim, goldBdr, goldFaint, textClr, textDim }}
              textSize={textSize}
              health={health}
              distanceKm={distanceKm}
              qiblaAngle={qiblaAngle}
              locationName={locationName}
              calDismissed={calDismissed}
              onDismissCal={() => setCalDismissed(true)}
            />
          </>
        ) : (
          /* ── No location state ──────────────────────────── */
          <div style={{ textAlign:"center", padding:"16px", margin:"auto 0" }}>
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
