import { useMemo, useState } from "react";
import { QR_PATH, QR_SIZE } from "./qrPath.js";
import { geoAzimuthalEquidistant, geoPath } from "d3-geo";
import { merge, mesh } from "topojson-client";
import world from "world-atlas/countries-110m.json";

// ─── Website-view Qibla: offline map + city bearings ─────────────────────────
// Presentation only. It reads the position/bearing the Qibla page already has
// and draws them; no network calls, nothing is stored.
const LAND    = merge(world, world.objects.countries.geometries);
const BORDERS = mesh(world, world.objects.countries, (a, b) => a !== b);
const W = 756, H = 480, CX = 378, CY = 236, R = 6371;
const KAABA = [39.826206, 21.422487];            // [lon, lat]
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const WINDS = ["North","North-northeast","Northeast","East-northeast","East","East-southeast","Southeast","South-southeast","South","South-southwest","Southwest","West-southwest","West","West-northwest","Northwest","North-northwest"];

export const CITIES = [
  ["Hyderabad","India",17.385,78.4867,"Asia/Kolkata"],["Karachi","Pakistan",24.8607,67.0011,"Asia/Karachi"],["Dhaka","Bangladesh",23.8103,90.4125,"Asia/Dhaka"],
  ["Kuala Lumpur","Malaysia",3.139,101.6869,"Asia/Kuala_Lumpur"],["Jakarta","Indonesia",-6.2088,106.8456,"Asia/Jakarta"],["Dubai","UAE",25.2048,55.2708,"Asia/Dubai"],
  ["Cairo","Egypt",30.0444,31.2357,"Africa/Cairo"],["Istanbul","Türkiye",41.0082,28.9784,"Europe/Istanbul"],["London","United Kingdom",51.5074,-0.1278,"Europe/London"],
  ["Johannesburg","South Africa",-26.2041,28.0473,"Africa/Johannesburg"],["New York","United States",40.7128,-74.006,"America/New_York"],["Sydney","Australia",-33.8688,151.2093,"Australia/Sydney"],
];

function bearingTo(lat1, lon1, lat2, lon2) {
  const f1 = rad(lat1), f2 = rad(lat2), dl = rad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
function arc(lat1, lon1, lat2, lon2) {
  const f1 = rad(lat1), f2 = rad(lat2), dl = rad(lon2 - lon1);
  const a = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const info = (lat, lon) => {
  const b = bearingTo(lat, lon, KAABA[1], KAABA[0]);
  return { b, km: arc(lat, lon, KAABA[1], KAABA[0]) * R, dir: WINDS[Math.round(b / 22.5) % 16] };
};
const fmt = n => Math.round(n).toLocaleString("en-US");

// Small compass: north on top, gold pointer at the bearing
export function MiniCompass({ deg: d, size = 16 }) {
  return (
    <span role="img" aria-label={`Qibla ${Math.round(d)} degrees on a compass`} style={{ position:"relative", display:"inline-block", flex:"none", width:size, height:size, color:"var(--dim)", verticalAlign:"-0.22em" }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" style={{ position:"absolute", inset:0 }}>
        <circle cx="12" cy="12" r="10.2" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5"/>
        <path d="M12 1.8V5M12 19V22.2M1.8 12H5M19 12H22.2" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M12 .6L14.1 4.6H9.9Z" fill="currentColor" fillOpacity=".9"/>
      </svg>
      <span style={{ position:"absolute", inset:0, transform:`rotate(${d}deg)` }}>
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display:"block" }}>
          <path d="M12 3.8L15.6 12H8.4Z" fill="var(--gold)"/>
          <path d="M12 20.2L15.6 12H8.4Z" fill="currentColor" fillOpacity=".35"/>
          <circle cx="12" cy="12" r="1.3" fill="var(--bgSolid)" stroke="var(--gold)" strokeWidth=".8"/>
        </svg>
      </span>
    </span>
  );
}

function QiblaMap({ lat, lon, name }) {
  const m = useMemo(() => {
    const { b, km } = info(lat, lon);
    const th = km / R;
    const sinb = Math.abs(Math.sin(rad(b))), cosb = Math.abs(Math.cos(rad(b)));
    const rpx = Math.min(300, (CX - 90) / Math.max(sinb, 1e-6), (CY - 70) / Math.max(cosb, 1e-6), 275);
    const scale = rpx / Math.max(th, 1e-6);
    const proj = geoAzimuthalEquidistant().rotate([-lon, -lat]).scale(scale).translate([CX, CY]).clipAngle(179.9).clipExtent([[0, 0], [W, H]]);
    const gp = geoPath(proj).digits(0);
    const mk = proj(KAABA) || [CX, CY];
    const steps = [250, 500, 1000, 2000, 2500, 5000, 10000];
    const stepKm = steps.find(s => scale * s / R >= 85) || 10000;
    const stepPx = scale * stepKm / R;
    const opp = rad((b + 180) % 360);
    const rings = [];
    for (let k = 1; k <= 5; k++) {
      const r = stepPx * k; if (r > 330) break;
      const lx = CX + r * Math.sin(opp), ly = CY - r * Math.cos(opp);
      rings.push({ r, label: fmt(stepKm * k) + " km", show: lx > 40 && lx < W - 40 && ly > 24 && ly < H - 20, lx, ly });
    }
    const ar = 46, ex = CX + ar * Math.sin(rad(b)), ey = CY - ar * Math.cos(rad(b));
    const mid = rad(b / 2);
    return { b, km, land: gp(LAND) || "", borders: gp(BORDERS) || "", mk, rings, arcD: `M${CX} ${CY - ar} A${ar} ${ar} 0 ${b > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`, lx: CX + 66 * Math.sin(mid), ly: CY - 66 * Math.cos(mid) + 4 };
  }, [lat, lon]);
  const halo = { paintOrder:"stroke", stroke:"var(--mapBg)", strokeWidth:"4px", strokeLinejoin:"round" };
  const t = { fontFamily:"Nunito, sans-serif" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Map centred on ${name}. A straight line runs ${Math.round(m.b)} degrees from North to the Kaaba in Makkah, ${fmt(m.km)} kilometres away.`} style={{ display:"block" }}>
      <rect width={W} height={H} fill="var(--mapBg)"/>
      <path d={m.land} fill="var(--land)"/>
      <path d={m.borders} fill="none" stroke="var(--coast)" strokeWidth=".6"/>
      {m.rings.map((r, i) => <circle key={i} cx={CX} cy={CY} r={r.r} fill="none" stroke="var(--ring)" strokeWidth="1" strokeDasharray="2 5"/>)}
      {m.rings.map((r, i) => r.show && <text key={"l"+i} x={r.lx} y={r.ly} textAnchor="middle" style={{ ...t, ...halo }} fontSize="10.5" fontWeight="600" fill="var(--faint)">{r.label}</text>)}
      <line x1={CX} y1={CY} x2={CX} y2={CY - 84} stroke="var(--faint)" strokeWidth="1" strokeDasharray="3 4"/>
      <path d={m.arcD} fill="none" stroke="var(--gold)" strokeWidth="1.2" opacity=".75"/>
      <text x={m.lx} y={m.ly} textAnchor="middle" style={{ ...t, ...halo }} fontSize="12" fontWeight="700" fill="var(--gold)">{Math.round(m.b)}°</text>
      <line className="flow" x1={CX} y1={CY} x2={m.mk[0]} y2={m.mk[1]} stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx={CX} cy={CY} r="11" fill="none" stroke="var(--gold)" opacity=".35"/>
      <circle cx={CX} cy={CY} r="5" fill="var(--gold)"/>
      <text x={CX + 14} y={CY + 20} style={{ ...t, ...halo }} fontSize="12" fontWeight="700" fill="var(--text)">{name}</text>
      <g transform={`translate(${m.mk[0]} ${m.mk[1]})`}><rect x="-9" y="-10" width="18" height="20" rx="2.5" fill="#16140F" stroke="var(--gold)" strokeWidth="1.6"/><rect x="-9" y="-5" width="18" height="3.5" fill="var(--gold)"/></g>
      <text x={m.mk[0]} y={m.mk[1] + 25} textAnchor="middle" style={{ ...t, ...halo }} fontSize="12" fontWeight="700" fill="var(--text)">Makkah</text>
      <g transform={`translate(${W - 34} 40)`}><path d="M0 -15 L6.5 7 L0 3 L-6.5 7Z" fill="var(--gold)"/><text y="23" textAnchor="middle" style={t} fontSize="11" fontWeight="700" fill="var(--dim)">N</text></g>
    </svg>
  );
}

// ── "Check it yourself": the sun stands over the Kaaba twice a year ───────────
// 27/28 May (~09:17 UTC) and 15/16 July (~09:28 UTC). Times are shown in the
// viewer's own zone; the dates are worked out from today, nothing is stored.
const SUN_EVENTS = [{ m: 4, d: [28, 27], utc: 9.283 }, { m: 6, d: [16, 15], utc: 9.467 }];
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const MONTHS3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function clock12(h) {
  h = ((h % 24) + 24) % 24;
  let H = Math.floor(h), M = Math.round((h - H) * 60);
  if (M === 60) { H = (H + 1) % 24; M = 0; }
  return (H % 12 || 12) + ":" + String(M).padStart(2, "0") + " " + (H >= 12 ? "PM" : "AM");
}
function zoneOffsetHours(zone, atMs) {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(new Date(atMs));
    const v = (p.find(x => x.type === "timeZoneName") || {}).value || "GMT";
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(v);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0));
  } catch { return -new Date(atMs).getTimezoneOffset() / 60; }
}
function nextSunEvents(now = new Date()) {
  const out = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2]) {
    for (const e of SUN_EVENTS) {
      const day = isLeap(y) ? e.d[1] : e.d[0];
      const at = Date.UTC(y, e.m, day, Math.floor(e.utc), Math.round((e.utc % 1) * 60));
      if (at > now.getTime()) out.push({ at, label: `${day} ${MONTHS3[e.m]} ${y}`, utc: e.utc });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 2);
}
function sunLine(name, lon, zone) {
  const [e1, e2] = nextSunEvents();
  const solar = (((e1.utc + lon / 15) % 24) + 24) % 24;
  if (!(solar > 6.5 && solar < 17.5)) {
    return `This happens twice a year, in late May and mid July. The sun is not up in ${name} at that moment, so this check will not work here.`;
  }
  const t = e => clock12(e.utc + zoneOffsetHours(zone, e.at));
  return `Next: ${e1.label}, about ${t(e1)} local time, then ${e2.label}, about ${t(e2)}. Your shadow points directly away from the Qibla.`;
}

const CSS = `
.qw-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:20px;align-items:start;width:100%;max-width:1480px;margin:0 auto}
.qw-cities{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:20px}
@media (min-width:1800px){.qw-cities{grid-template-columns:repeat(3,minmax(0,1fr));column-gap:16px}}
@media (max-width:1359px){.qw-cities{grid-template-columns:minmax(0,1fr)}}
@media (max-width:1199px){.qw-grid{grid-template-columns:minmax(0,1fr)}}
`;

const Ico = ({ size = 16, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export default function QiblaWeb({ userPos, locationName, textSize = 1 }) {
  const ts = textSize || 1;
  const [preview, setPreview] = useState(null);   // a CITIES row, or null for "my location"
  const [copied, setCopied] = useState(false);
  const myZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } })();
  const here = preview
    ? { name:preview[0], lat:preview[2], lon:preview[3], zone:preview[4] }
    : { name:locationName || "Your location", lat:userPos.lat, lon:userPos.lon, zone:myZone };
  const cur = info(here.lat, here.lon);
  const rows = CITIES.map(c => ({ c, ...info(c[2], c[3]) }));
  const bearingTxt = Math.round(cur.b);

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${bearingTxt}° from True North (${cur.dir})`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  const tile = (icon, title, body, last) => (
    <div style={{ display:"flex", gap:"12px", padding:"12px 0", borderBottom: last ? "none" : "1px solid var(--lineSoft)" }}>
      <span style={{ flex:"none", width:"32px", height:"32px", borderRadius:"10px", border:"1px solid var(--lineSoft)", background:"var(--chip)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gold)" }}>{icon}</span>
      <div>
        <div style={{ fontSize:`${13*ts}px`, fontWeight:600 }}>{title}</div>
        <div style={{ marginTop:"2px", fontSize:`${12*ts}px`, lineHeight:1.55, fontWeight:500, color:"var(--dim)" }}>{body}</div>
      </div>
    </div>
  );

  return (
    <div className="qw-grid">
      <style>{CSS}</style>

      <div style={{ display:"flex", flexDirection:"column", gap:"20px", minWidth:0 }}>
        <section className="card" style={{ overflow:"hidden" }}>
          <QiblaMap lat={here.lat} lon={here.lon} name={here.name}/>
          {preview && (
            <div style={{ padding:"10px 16px", borderTop:"1px solid var(--lineSoft)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", fontSize:`${12.5*ts}px`, color:"var(--dim)" }}>
              <span>Previewing {preview[0]}, not your location.</span>
              <button className="cb" onClick={() => setPreview(null)} style={{ border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", borderRadius:"9px", padding:"5px 12px", fontFamily:"inherit", fontWeight:700, cursor:"pointer", fontSize:`${12*ts}px` }}>Back to my location</button>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", padding:"10px 16px", borderTop:"1px solid var(--lineSoft)", fontSize:`${11.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>
            <span>Centred on {here.name} · north is up · rings show distance</span>
            <span style={{ display:"flex", alignItems:"center", gap:"6px", flex:"none" }}><span style={{ width:"14px", height:0, borderTop:"2px dashed var(--gold)" }}/>Qibla line</span>
          </div>
        </section>

        <section className="card" style={{ padding:"18px 20px 14px" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:"12px" }}>
            <span className="lbl">Qibla from major cities</span>
            <span style={{ fontSize:`${11.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>Select a city to preview its map</span>
          </div>
          <div className="qw-cities" style={{ marginTop:"10px" }}>
            {rows.map(({ c, b, km }) => {
              const on = !!preview && preview[0] === c[0];
              return (
                <button key={c[0]} className="pc" aria-pressed={on} onClick={() => setPreview(on ? null : c)}
                  style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%", height:"42px", padding:"0 10px", borderRadius:"10px", border:`1px solid ${on ? "var(--gold)" : "transparent"}`, background: on ? "var(--active)" : "transparent", color:"var(--text)", fontFamily:"inherit", textAlign:"left", cursor:"pointer" }}>
                  <span style={{ flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontSize:`${13*ts}px`, fontWeight:600 }}>{c[0]}<span style={{ marginLeft:"8px", fontSize:`${11.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>{c[1]}</span></span>
                  <MiniCompass deg={b} size={18}/>
                  <span style={{ flex:"none", width:"36px", textAlign:"right", fontSize:`${13*ts}px`, fontWeight:600, fontVariantNumeric:"tabular-nums", color:"var(--gold)" }}>{Math.round(b)}°</span>
                  <span style={{ flex:"none", width:"64px", textAlign:"right", fontSize:`${12*ts}px`, fontWeight:500, fontVariantNumeric:"tabular-nums", color:"var(--dim)" }}>{fmt(km)} km</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:"16px", minWidth:0 }}>
        <section className="card" style={{ padding:"20px 22px 18px", background:"var(--panel2)" }}>
          <div className="lbl">Qibla bearing</div>
          <div style={{ marginTop:"8px", display:"flex", alignItems:"baseline", gap:"10px" }}>
            <span style={{ fontSize:`${46*ts}px`, fontWeight:600, lineHeight:1, letterSpacing:"-0.5px", fontVariantNumeric:"tabular-nums" }}>{bearingTxt}°</span>
            <span style={{ alignSelf:"center", display:"inline-flex", marginLeft:"2px" }}><MiniCompass deg={cur.b} size={40}/></span>
            <span style={{ fontSize:`${12.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>from True North</span>
          </div>
          <div style={{ marginTop:"6px", fontSize:`${14*ts}px`, fontWeight:600, color:"var(--gold)" }}>{cur.dir}</div>
          <div style={{ height:"1px", background:"var(--lineSoft)", margin:"16px 0 14px" }}/>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
            <div>
              <div className="lbl">Distance</div>
              <div style={{ marginTop:"3px", fontSize:`${17*ts}px`, fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fmt(cur.km)} <span style={{ fontSize:`${12*ts}px`, fontWeight:500, color:"var(--faint)" }}>km, great-circle</span></div>
            </div>
            <button className="cb" onClick={copy} style={{ display:"flex", alignItems:"center", gap:"7px", height:"34px", padding:"0 12px", borderRadius:"10px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontFamily:"inherit", fontSize:`${12*ts}px`, fontWeight:600, cursor:"pointer" }}>
              <Ico size={14}><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></Ico>{copied ? "Copied" : "Copy bearing"}
            </button>
          </div>
        </section>

        <section className="card" style={{ padding:"18px 20px 6px" }}>
          <div className="lbl">Check it yourself</div>
          <div style={{ marginTop:"8px", display:"flex", flexDirection:"column" }}>
            {tile(<Ico size={17}><path d="M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></Ico>, "Sun over the Kaaba", sunLine(here.name, here.lon, here.zone))}
            {tile(<Ico size={17}><path d="M6 20V10a6 6 0 0 1 12 0v10M4 20h16M10 20v-5a2 2 0 0 1 4 0v5"/></Ico>, "A nearby mosque", "The mihrab marks the Qibla, though a few mosques are built a few degrees off.")}
            {tile(<Ico size={17}><path d="M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0M15.5 8.5l-2 5-5 2 2-5 5-2Z"/></Ico>, "A magnetic compass", <>Set it to <MiniCompass deg={cur.b} size={14}/> {bearingTxt}° True North, then correct for your local magnetic declination.</>, true)}
          </div>
        </section>

        <section className="card" style={{ display:"flex", alignItems:"center", gap:"16px", padding:"16px 18px" }}>
          <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} width="76" height="76" role="img" aria-label="QR code that opens NŪR on a phone" style={{ display:"block", flex:"none", borderRadius:"8px" }}>
            <rect width={QR_SIZE} height={QR_SIZE} fill="#FFFFFF"/>
            <path d={QR_PATH} fill="#0A1236"/>
          </svg>
          <div>
            <div style={{ fontSize:`${13*ts}px`, fontWeight:600 }}>Live compass on your phone</div>
            <div style={{ marginTop:"3px", fontSize:`${12*ts}px`, lineHeight:1.55, fontWeight:500, color:"var(--dim)" }}>Scan to open NŪR on your phone. The compass starts on its own.</div>
            <div style={{ marginTop:"5px", fontSize:`${11*ts}px`, fontWeight:600, color:"var(--faint)" }}>nurislamicai.app/app</div>
          </div>
        </section>
      </div>
    </div>
  );
}
