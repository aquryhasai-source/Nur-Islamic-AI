import { useMemo, useState } from "react";
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
  ["Hyderabad","India",17.385,78.4867],["Karachi","Pakistan",24.8607,67.0011],["Dhaka","Bangladesh",23.8103,90.4125],
  ["Kuala Lumpur","Malaysia",3.139,101.6869],["Jakarta","Indonesia",-6.2088,106.8456],["Dubai","UAE",25.2048,55.2708],
  ["Cairo","Egypt",30.0444,31.2357],["Istanbul","Türkiye",41.0082,28.9784],["London","United Kingdom",51.5074,-0.1278],
  ["Johannesburg","South Africa",-26.2041,28.0473],["New York","United States",40.7128,-74.006],["Sydney","Australia",-33.8688,151.2093],
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

export default function QiblaWeb({ userPos, locationName, textSize = 1 }) {
  const [preview, setPreview] = useState(null);   // a CITIES row, or null for "my location"
  const here = preview ? { name:preview[0], lat:preview[2], lon:preview[3] } : { name:locationName || "Your location", lat:userPos.lat, lon:userPos.lon };
  const cur = info(here.lat, here.lon);
  const rows = CITIES.map(c => ({ c, ...info(c[2], c[3]) }));
  const stat = (label, value, extra) => (
    <div style={{ flex:1, padding:"14px 18px" }}>
      <div className="lbl">{label}</div>
      <div style={{ marginTop:"4px", fontFamily:"var(--font-head)", fontWeight:700, fontSize:`${26*textSize}px`, color:"var(--text)", display:"flex", alignItems:"center", gap:"10px" }}>{value}{extra}</div>
    </div>
  );
  return (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.55fr) minmax(300px,1fr)", gap:"20px", alignItems:"start", width:"100%", maxWidth:"1120px", margin:"0 auto" }}>
      <section className="card" style={{ overflow:"hidden", gridColumn:"span 1" }}>
        <QiblaMap lat={here.lat} lon={here.lon} name={here.name}/>
        <div style={{ display:"flex", borderTop:"1px solid var(--lineSoft)" }}>
          {stat("BEARING", Math.round(cur.b) + "°", <MiniCompass deg={cur.b} size={Math.round(24*textSize)}/>)}
          <div style={{ width:1, background:"var(--lineSoft)" }}/>
          {stat("DISTANCE", fmt(cur.km) + " km")}
          <div style={{ width:1, background:"var(--lineSoft)" }}/>
          {stat("DIRECTION", <span style={{ fontSize:`${19*textSize}px`, lineHeight:1.2 }}>{cur.dir}</span>)}
        </div>
        {preview && (
          <div style={{ padding:"10px 18px", borderTop:"1px solid var(--lineSoft)", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:`${13*textSize}px`, color:"var(--dim)" }}>
            <span>Previewing {preview[0]}, not your location.</span>
            <button className="cb" onClick={() => setPreview(null)} style={{ border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", borderRadius:"10px", padding:"6px 12px", fontWeight:700, cursor:"pointer", fontSize:`${12.5*textSize}px` }}>Back to my location</button>
          </div>
        )}
      </section>

      <section className="card" style={{ padding:"18px 8px 10px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:"12px", padding:"0 12px 10px" }}>
          <span className="lbl">QIBLA FROM MAJOR CITIES</span>
          <span style={{ fontSize:"11.5px", fontWeight:500, color:"var(--faint)" }}>Select a city to preview its map</span>
        </div>
        <div role="list">
          {rows.map(({ c, b, km }) => {
            const on = preview && preview[0] === c[0];
            return (
              <button key={c[0]} role="listitem" className="pc" aria-pressed={!!on} onClick={() => setPreview(on ? null : c)}
                style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) auto auto", alignItems:"center", gap:"14px", width:"100%", padding:"10px 12px", border:`1px solid ${on ? "var(--gold)" : "transparent"}`, borderRadius:"12px", background:on ? "var(--active)" : "transparent", color:"var(--text)", textAlign:"left", cursor:"pointer" }}>
                <span style={{ minWidth:0 }}>
                  <span style={{ display:"block", fontSize:`${14*textSize}px`, fontWeight:700 }}>{c[0]}</span>
                  <span style={{ display:"block", fontSize:`${12*textSize}px`, color:"var(--faint)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c[1]}</span>
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:`${14*textSize}px`, fontWeight:700, color:"var(--gold)" }}>{Math.round(b)}°<MiniCompass deg={b} size={Math.round(16*textSize)}/></span>
                <span style={{ fontSize:`${12.5*textSize}px`, color:"var(--dim)", minWidth:"72px", textAlign:"right" }}>{fmt(km)} km</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
