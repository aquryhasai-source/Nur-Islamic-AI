// One line-icon set for the whole app: 24px grid, 1.8 stroke, round caps, colour from the surrounding text (currentColor).
// Use <Icon n="close" size={16}/>. Inside an <svg> use <IconG n="kaaba" x={..} y={..} size={..}/>.
// Never use emoji or text glyphs (✦ ✕ ← → ✓ 🌙 …) as icons; add a name here instead.

const P = {
  back:       <path d="M19 12H5M11 6l-6 6 6 6"/>,
  forward:    <path d="M5 12h14M13 6l6 6-6 6"/>,
  close:      <path d="M6 6l12 12M18 6 6 18"/>,
  check:      <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  plus:       <path d="M12 5v14M5 12h14"/>,
  chevronDown:<path d="m6 9 6 6 6-6"/>,
  chevronRight:<path d="m9 6 6 6-6 6"/>,
  spark:      <path d="M12 3c.6 4.6 3.4 7.4 9 9-5.6 1.6-8.4 4.4-9 9-.6-4.6-3.4-7.4-9-9 5.6-1.6 8.4-4.4 9-9Z"/>,
  moon:       <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>,
  crescentStar: <><path d="M16 13.5A6.5 6.5 0 0 1 8.5 5 6.5 6.5 0 1 0 16 13.5Z"/><path d="m17.5 5 .9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z"/></>,
  sun:        <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></>,
  sunrise:    <><path d="M6 17a6 6 0 0 1 12 0M3 17h18M12 6v3M5.2 10.2l1.4 1.4M18.8 10.2l-1.4 1.4M9 5l3-2.5L15 5"/></>,
  sunset:     <><path d="M6 17a6 6 0 0 1 12 0M3 17h18M12 6v3M5.2 10.2l1.4 1.4M18.8 10.2l-1.4 1.4M9 3.5 12 6l3-2.5"/></>,
  sunCloud:   <><circle cx="8" cy="8" r="2.6"/><path d="M8 2.8v.9M2.8 8h.9M4.3 4.3l.7.7M11.7 4.3 11 5"/><path d="M8 19a3.6 3.6 0 0 1 .4-7.2 5 5 0 0 1 9.4 1.3A3 3 0 0 1 17.5 19Z"/></>,
  pin:        <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/></>,
  compass:    <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/></>,
  kaaba:      <><rect x="4.5" y="5.5" width="15" height="14" rx="1.2"/><path d="M4.5 10h15M10.5 19.5v-5h3v5"/></>,
  mosque:     <><path d="M4 21v-8.5h16V21M2.5 21h19M7.5 12.5C7.5 8 10 5.5 12 3c2 2.5 4.5 5 4.5 9.5M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21"/></>,
  clock:      <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  hourglass:  <path d="M7 3h10M7 21h10M8 3c0 5 4 5 4 9s-4 4-4 9M16 3c0 5-4 5-4 9s4 4 4 9"/>,
  bell:       <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20.5a2 2 0 0 0 4 0"/>,
  bookmark:   <path d="M7 3.5h10v17l-5-3.8-5 3.8Z"/>,
  heart:      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>,
  star:       <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8L12 3.5Z"/>,
  gift:       <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7C10 4 7 4 7 6s3 1 5 1ZM12 7c2-3 5-3 5-1s-3 1-5 1Z"/>,
  bug:        <path d="M9 7.5a3 3 0 0 1 6 0M8 10.5h8v4.5a4 4 0 0 1-8 0ZM12 10.5V19M4.5 11.5l3.5 1.5M19.5 11.5 16 13M4.5 18.5 8 16.5M19.5 18.5 16 16.5"/>,
  bulb:       <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>,
  book:       <path d="M5 5.5A2 2 0 0 1 7 3.5h11v15H7a2 2 0 0 0-2 2v-15ZM5 20.5h13"/>,
  chat:       <path d="M4.5 5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16h-1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>,
  camera:     <><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4Z"/><circle cx="12" cy="13.3" r="3.2"/></>,
  calendar:   <path d="M5 5.5h14v14H5ZM5 10h14M9 3.5v4M15 3.5v4"/>,
  target:     <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/></>,
  download:   <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>,
  upload:     <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>,
  sprout:     <path d="M12 21v-9M12 12c0-4 2.5-6 7-6 0 4-2.5 6-7 6ZM12 15c0-3-2-5-6-5 0 3 2 5 6 5Z"/>,
  info:       <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  warning:    <><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.2M12 17h.01"/></>,
  quote:      <path d="M9.5 7H5.5v5H8c0 2-.8 3-2.5 3.5M18.5 7h-4v5H17c0 2-.8 3-2.5 3.5"/>,
  refresh:    <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4.5h-4.5"/>,
  undo:       <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/>,
  share:      <path d="M12 15V4M8 7.5l4-4 4 4M6 11H5v9h14v-9h-1"/>,
  lock:       <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></>,
  ban:        <><circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/></>,
  infinity:   <path d="M12 12c-1.5-2.2-3-3.5-4.8-3.5a3.5 3.5 0 1 0 0 7c1.8 0 3.3-1.3 4.8-3.5Zm0 0c1.5 2.2 3 3.5 4.8 3.5a3.5 3.5 0 1 0 0-7c-1.8 0-3.3 1.3-4.8 3.5Z"/>,
};

export const ICON_NAMES = Object.keys(P);

export function Icon({ n, size = 18, sw = 1.8, style, className }) {
  const g = P[n];
  if (!g) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      style={{ flex: "none", display: "inline-block", verticalAlign: "-0.18em", ...style }}>{g}</svg>
  );
}

// For use inside an existing <svg>: draws icon `n` with its top-left at (x, y), `size` px wide.
export function IconG({ n, x = 0, y = 0, size = 18, sw = 1.8, color = "currentColor" }) {
  const g = P[n];
  if (!g) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth={sw * 24 / size}
      strokeLinecap="round" strokeLinejoin="round">{g}</g>
  );
}

// Moon phase 0..7 (0 new, 2 first quarter, 4 full, 6 last quarter), drawn from the lit fraction.
export function MoonPhase({ i = 0, size = 18, sw = 1.6, style }) {
  const r = 9, c = 12;
  const waxing = i <= 4;
  const frac = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25][i] ?? 0;       // lit share of the disc
  const k = Math.cos(Math.PI * frac);                                      // terminator curve, +1 crescent … -1 gibbous edge
  const rx = Math.abs(1 - 2 * frac) * r;
  let lit = null;
  if (frac >= 1) lit = <circle cx={c} cy={c} r={r} fill="currentColor" stroke="none"/>;
  else if (frac > 0) {
    const outer = waxing ? 1 : 0;                                          // sweep of the outer limb
    const inner = (frac < 0.5) === waxing ? 0 : 1;                         // terminator bulges toward / away from the limb
    lit = <path fill="currentColor" stroke="none" d={`M${c} ${c - r}A${r} ${r} 0 0 ${outer} ${c} ${c + r}A${rx} ${r} 0 0 ${inner} ${c} ${c - r}Z`}/>;
  }
  void k;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} aria-hidden="true"
      style={{ flex: "none", display: "inline-block", verticalAlign: "-0.18em", ...style }}>
      <circle cx={c} cy={c} r={r}/>{lit}
    </svg>
  );
}
