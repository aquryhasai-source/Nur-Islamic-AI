import { useState, useEffect, useRef } from "react";
import { KEYS, getPrayerTimes, getPrayerTimesByCity, getCountdownTo } from "./utils.js";
import { syncPrayerLocation, subscribeToPush, getPushPermissionState } from "./lib/pushNotifications.js";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

// ── Prayer list ───────────────────────────────────────────────────────────────
const PRAYER_LIST = [
  { key:"Fajr",    label:"Fajr",    arabic:"الفجر",  icon:"🌙", hasAlarm:true  },
  { key:"Sunrise", label:"Sunrise", arabic:"الشروق", icon:"🌅", hasAlarm:false },
  { key:"Dhuhr",   label:"Dhuhr",   arabic:"الظهر",  icon:"☀️",  hasAlarm:true  },
  { key:"Asr",     label:"Asr",     arabic:"العصر",  icon:"🌤️",  hasAlarm:true  },
  { key:"Maghrib", label:"Maghrib", arabic:"المغرب", icon:"🌇", hasAlarm:true  },
  { key:"Isha",    label:"Isha",    arabic:"العشاء", icon:"🌙", hasAlarm:true  },
];

// ── Prayer detail data ────────────────────────────────────────────────────────
const PRAYER_INFO = {
  Fajr:    { rakats:"2 Fard · 2 Sunnah",          desc:"The dawn prayer, performed before sunrise. A blessed and serene start to each day.", adhkar:"سُبْحَانَ اللَّه وَبِحَمْدِه\nSubhanAllah wa bihamdih — 33×" },
  Sunrise: { rakats:"—",                           desc:"Sunrise is not a formal prayer. It is a recommended time for dhikr and morning supplications.", adhkar:"Recite Ayat al-Kursi and the morning adhkar for protection throughout the day." },
  Dhuhr:   { rakats:"4 Fard · 4 Sunnah + 2 Nafl", desc:"The midday prayer performed after the sun passes its zenith. Begin with 4 Sunnah before the Fard.", adhkar:"سُبْحَانَ اللَّه وَبِحَمْدِه\nSubhanAllah wa bihamdih — 33×" },
  Asr:     { rakats:"4 Fard",                      desc:"The afternoon prayer. The Prophet ﷺ warned strongly against missing or delaying Asr.", adhkar:"سُبْحَانَ اللَّه وَبِحَمْدِه\nSubhanAllah wa bihamdih — 33×" },
  Maghrib: { rakats:"3 Fard · 2 Sunnah",          desc:"The sunset prayer — offered right after the sun sets. It is best not to delay it.", adhkar:"سُبْحَانَ اللَّه وَبِحَمْدِه\nSubhanAllah wa bihamdih — 33×" },
  Isha:    { rakats:"4 Fard · 2 Sunnah + 3 Witr", desc:"The night prayer. Conclude your day with Witr, a highly recommended sunnah prayer.", adhkar:"سُبْحَانَ اللَّه وَبِحَمْدِه\nSubhanAllah wa bihamdih — 33×" },
};

// ── Daily insights (rotated by day of month) ──────────────────────────────────
const INSIGHTS = [
  { text:"The most beloved deeds to Allah are those done consistently, even if they are small.", source:"Sahih Bukhari" },
  { text:"No fatigue, disease, or grief afflicts a Muslim but Allah expiates some of his sins through it.", source:"Sahih Bukhari" },
  { text:"Whoever believes in Allah and the Last Day should speak good or remain silent.", source:"Sahih Bukhari" },
  { text:"Make things easy and do not make them difficult. Spread glad tidings; do not repel people.", source:"Sahih Bukhari" },
  { text:"The strong person is not the one who can wrestle others, but the one who controls himself in anger.", source:"Sahih Bukhari" },
  { text:"None of you will truly believe until you love for your brother what you love for yourself.", source:"Sahih Bukhari" },
  { text:"Verily, with every hardship comes ease.", source:"Quran 94:6" },
  { text:"He who does not thank people has not thanked Allah.", source:"Abu Dawud" },
  { text:"A good word is charity.", source:"Sahih Bukhari" },
  { text:"The best of you are those who are best to their families.", source:"Tirmidhi" },
];

// ── Alarm sound ───────────────────────────────────────────────────────────────
function playAlarmSound() {
  const audio = new Audio("/azan.mp3");
  audio.play().catch(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.55, 1.1].forEach(t => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 660;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.5);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.55);
      });
    } catch {}
  });
}

// ── Notification ──────────────────────────────────────────────────────────────
function fireNotification(label, pTime, fireKey) {
  const title = `🕌 ${label} — Time to Pray`;
  const opts  = {
    body:  `It is ${pTime} — time for ${label} prayer`,
    icon:  "/icon-192.png",
    badge: "/icon-192.png",
    tag:   fireKey,
    requireInteraction: false,
    silent: false,
  };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => { try { new Notification(title, opts); } catch {} });
  } else { try { new Notification(title, opts); } catch {} }
}

// ── Prayer key helpers ────────────────────────────────────────────────────────
function getNextPrayerKey(prayerTimes) {
  if (!prayerTimes) return null;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const prayers = PRAYER_LIST.filter(p => p.hasAlarm).map(p => {
    const [h, m] = (prayerTimes[p.key] || "00:00").split(":").map(Number);
    return { key: p.key, totalMins: h * 60 + m };
  });
  return (prayers.find(p => p.totalMins > nowMins) || prayers[0])?.key;
}

function getCurrentPrayerKey(prayerTimes) {
  if (!prayerTimes) return null;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const prayers = PRAYER_LIST.filter(p => p.hasAlarm).map(p => {
    const [h, m] = (prayerTimes[p.key] || "00:00").split(":").map(Number);
    return { key: p.key, totalMins: h * 60 + m };
  });
  let current = prayers[prayers.length - 1];
  for (let i = 0; i < prayers.length; i++) {
    if (nowMins < prayers[i].totalMins) {
      current = i > 0 ? prayers[i - 1] : prayers[prayers.length - 1];
      break;
    }
  }
  return current?.key;
}

// ── Hijri date (algorithmic approximation) ────────────────────────────────────
function getHijriDate() {
  const now = new Date();
  const D = now.getDate(), M = now.getMonth() + 1, Y = now.getFullYear();
  const JD = Math.floor((1461 * (Y + 4800 + Math.floor((M - 14) / 12))) / 4)
           + Math.floor((367 * (M - 2 - 12 * Math.floor((M - 14) / 12))) / 12)
           - Math.floor((3 * Math.floor((Y + 4900 + Math.floor((M - 14) / 12)) / 100)) / 4)
           + D - 32075;
  const l  = JD - 1948440 + 10632;
  const n  = Math.floor((l - 1) / 10631);
  const l1 = l - 10631 * n + 354;
  const j  = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719)
           + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
            - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hMonth = Math.floor((24 * l2) / 709);
  const hDay   = l2 - Math.floor((709 * hMonth) / 24);
  const hYear  = 30 * n + j - 30;
  const months = [
    "Muharram","Safar","Rabi al-Awwal","Rabi al-Thani",
    "Jumada al-Awwal","Jumada al-Thani","Rajab","Sha'ban",
    "Ramadan","Shawwal","Dhul Qi'dah","Dhul Hijjah",
  ];
  return `${hDay} ${months[hMonth - 1]} ${hYear} AH`;
}

// ── Prayer window progress (0–100) ────────────────────────────────────────────
function calcProgress(pt, curKey, nxtKey) {
  if (!pt || !curKey || !nxtKey) return 0;
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const [ch, cm] = (pt[curKey] || "00:00").split(":").map(Number);
  const [nh, nm] = (pt[nxtKey] || "00:00").split(":").map(Number);
  let curMin = ch * 60 + cm, nxtMin = nh * 60 + nm, elapsed = nowMin - curMin;
  if (nxtMin <= curMin) nxtMin  += 1440;
  if (elapsed  < 0)    elapsed += 1440;
  const total = nxtMin - curMin;
  return total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
}

// ── Mini countdown label ("In 3h 16m") ───────────────────────────────────────
function miniCd(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  let diff  = h * 60 + m - now.getHours() * 60 - now.getMinutes();
  if (diff <= 0) diff += 1440;
  const hrs = Math.floor(diff / 60), mins = diff % 60;
  return hrs > 0 ? `In ${hrs}h ${mins}m` : `In ${mins}m`;
}

// ── Format HH:MM:SS countdown to "3h 16m" ────────────────────────────────────
function fmtCd(hms) {
  if (!hms || hms === "--:--:--") return "—";
  const [h, m] = hms.split(":").map(Number);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Website-view helpers (stroke icons + 12h clock) ──────────────────────────
const DK_ICON = {
  Fajr:    "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z",
  Sunrise: "M3 19h18M7 19a5 5 0 0 1 10 0M12 5v5m-2.5-2.5L12 5l2.5 2.5M4.8 12.2l1.4 1.4M19.2 12.2l-1.4 1.4",
  Dhuhr:   "M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4",
  Asr:     "M8 19h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 12 3.5 3.5 0 0 0 8 19ZM9 6.5 8 5M5 9.5 3.5 9M13 5.5V4",
  Maghrib: "M3 19h18M7 19a5 5 0 0 1 10 0M12 5v5m-2.5-.5L12 12l2.5-2.5M4.8 12.2l1.4 1.4M19.2 12.2l-1.4 1.4",
  Isha:    "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5ZM17.5 3v4M15.5 5h4",
};
const DK_BELL    = "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0";
const DK_BELLOFF = DK_BELL + "M4 4l16 16";
const DK_PIN     = "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM9.6 10a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0";
const DK_QUOTE   = "M9.5 7.5C6.5 8 5 10 5 13v3.5h5V12H7.5c0-1.7.8-2.7 2-3.2V7.5ZM18.5 7.5c-3 .5-4.5 2.5-4.5 5.5v3.5h5V12h-2.5c0-1.7.8-2.7 2-3.2V7.5Z";
const DK_COMPASS = "M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0M15.5 8.5l-2 5-5 2 2-5 5-2Z";
const DK_CHEV    = "m9 6 6 6-6 6";
const DK_INFO    = "M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0M12 11v5M12 8v.1";

function DkIco({ d, size = 20, sw = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// "17:42" → { t:"5:42", ap:"PM" }  (display only; stored/alarm times stay 24h)
function to12(hhmm) {
  const m = /(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return { t: "--:--", ap: "" };
  const h = Number(m[1]);
  return { t: `${h % 12 || 12}:${m[2]}`, ap: h >= 12 ? "PM" : "AM" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PrayerTimesPage({
  onBack,
  onOpenSidebar,
  navigateTo = () => {},
  lightMode,
  textSize = 1,
}) {
  const [prayerTimes,    setPrayerTimes]    = useState(null);
  const [alarms,         setAlarms]         = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEYS.PRAYER_ALARMS) || "{}"); }
    catch { return {}; }
  });
  const [locationName,   setLocationName]   = useState("");
  const [loading,        setLoading]        = useState(true);
  const [locError,       setLocError]       = useState(null);
  const [showCityInput,  setShowCityInput]  = useState(false);
  const [city,           setCity]           = useState(localStorage.getItem(KEYS.CITY) || "");
  const [locCoords,      setLocCoords]      = useState(null); // { lat, lon } or { city } — for syncing once push gets enabled
  const [notifPerm,      setNotifPerm]      = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [permError,      setPermError]      = useState("");
  const [nextKey,        setNextKey]        = useState(null);
  const [currentKey,     setCurrentKey]     = useState(null);
  const [countdown,      setCountdown]      = useState("--:--:--");
  const [selectedPrayer, setSelectedPrayer] = useState(null);
  const firedAlarms = useRef(new Set());
  const docked = useMedia(DOCK_QUERY);

  // ── Palette ──────────────────────────────────────────────────────────────────
  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const cardBg = "var(--panel)";
  const inputBg = "var(--panel2)";
  const green = "var(--green)";
  const modalBg   = "var(--pop)";
  const pageBg    = "var(--bgSolid)";

  // ── Load prayer times ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadByCity = async (cityName) => {
      try {
        const times = await getPrayerTimesByCity(cityName);
        setPrayerTimes(times);
        setLocationName(cityName);
        setLocCoords({ city: cityName });
        syncPrayerLocation({ city: cityName });
      } catch {
        setLocError("Could not load times. Enter your city.");
        setShowCityInput(true);
      }
      setLoading(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            const times = await getPrayerTimes(coords.latitude, coords.longitude);
            setPrayerTimes(times);
            setLocationName("Current Location");
            setLocCoords({ lat: coords.latitude, lon: coords.longitude });
            syncPrayerLocation({ lat: coords.latitude, lon: coords.longitude });
          } catch {
            const saved = localStorage.getItem(KEYS.CITY);
            if (saved) await loadByCity(saved);
            else { setLocError("Could not get location. Enter your city."); setShowCityInput(true); }
          }
          setLoading(false);
        },
        async () => {
          const saved = localStorage.getItem(KEYS.CITY);
          if (saved) await loadByCity(saved);
          else { setLocError("Location denied. Enter your city."); setShowCityInput(true); setLoading(false); }
        }
      );
    } else {
      const saved = localStorage.getItem(KEYS.CITY);
      if (saved) loadByCity(saved);
      else { setLocError("Enter your city to load prayer times."); setShowCityInput(true); setLoading(false); }
    }
  }, []);

  // ── Tick: current/next/countdown every second ─────────────────────────────────
  useEffect(() => {
    if (!prayerTimes) return;
    const tick = () => {
      const nk = getNextPrayerKey(prayerTimes);
      const ck = getCurrentPrayerKey(prayerTimes);
      setNextKey(nk);
      setCurrentKey(ck);
      if (nk) {
        const c = getCountdownTo(prayerTimes[nk]);
        setCountdown(
          `${String(c.hours).padStart(2,"0")}:${String(c.mins).padStart(2,"0")}:${String(c.secs).padStart(2,"0")}`
        );
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [prayerTimes]);

  // ── Alarm checker every 30 s ──────────────────────────────────────────────────
  useEffect(() => {
    if (!prayerTimes) return;
    const check = () => {
      const now  = new Date();
      const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const date = now.toLocaleDateString("en-CA");
      PRAYER_LIST.forEach(prayer => {
        if (!prayer.hasAlarm || !alarms[prayer.key]) return;
        const pTime   = prayerTimes[prayer.key];
        const fireKey = `${prayer.key}-${date}-${pTime}`;
        if (pTime === time && !firedAlarms.current.has(fireKey)) {
          firedAlarms.current.add(fireKey);
          playAlarmSound();
          if (Notification.permission === "granted") fireNotification(prayer.label, pTime, fireKey);
        }
      });
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [prayerTimes, alarms]);

  // ── Toggle alarm ──────────────────────────────────────────────────────────────
  const toggleAlarm = async (prayerKey) => {
    setPermError("");
    if (!alarms[prayerKey]) {
      const state = getPushPermissionState();
      if (state === "denied") {
        setPermError("Notifications are blocked. Enable them in your browser settings.");
        return;
      }
      if (state === "unsupported") {
        setPermError("Notifications aren't supported in this browser.");
        return;
      }
      if (state === "default") {
        setPermError("Notifications are off — enabling now…");
        try {
          await subscribeToPush();
          setNotifPerm("granted");
          setPermError("");
          if (locCoords) syncPrayerLocation(locCoords); // attach location to the subscription just created
        } catch (err) {
          setNotifPerm(getPushPermissionState());
          setPermError(err.message || "Could not enable notifications.");
          return;
        }
      }
    }
    const updated = { ...alarms, [prayerKey]: !alarms[prayerKey] };
    setAlarms(updated);
    localStorage.setItem(KEYS.PRAYER_ALARMS, JSON.stringify(updated));
  };

  // ── City lookup ───────────────────────────────────────────────────────────────
  const lookupCity = async () => {
    if (!city.trim()) return;
    setLoading(true); setLocError(null);
    try {
      const times = await getPrayerTimesByCity(city.trim());
      setPrayerTimes(times);
      setLocationName(city.trim());
      localStorage.setItem(KEYS.CITY, city.trim());
      setLocCoords({ city: city.trim() });
      syncPrayerLocation({ city: city.trim() });
      setShowCityInput(false);
    } catch { setLocError("City not found. Try a nearby major city."); }
    finally { setLoading(false); }
  };

  // ── Derived values ────────────────────────────────────────────────────────────
  const today           = new Date();
  const hijriDate       = getHijriDate();
  const insight         = INSIGHTS[today.getDate() % INSIGHTS.length];
  const currentPrayer   = PRAYER_LIST.find(p => p.key === currentKey);
  const nextPrayer      = PRAYER_LIST.find(p => p.key === nextKey);
  const progress        = calcProgress(prayerTimes, currentKey, nextKey);
  const todayStr        = today.toLocaleDateString("en-US", {
    weekday:"short", day:"numeric", month:"long", year:"numeric",
  });
  const curIdx          = PRAYER_LIST.findIndex(p => p.key === currentKey);
  const pastPrayers     = curIdx >= 0 ? PRAYER_LIST.slice(0, curIdx) : [];
  const upcomPrayers    = curIdx >= 0 ? PRAYER_LIST.slice(curIdx + 1) : [];
  const curPrayerArr    = curIdx >= 0 ? [PRAYER_LIST[curIdx]] : [];
  const selInfo         = selectedPrayer ? PRAYER_INFO[selectedPrayer.key] : null;
  const totalGroups     = pastPrayers.length + curPrayerArr.length + upcomPrayers.length;

  // ── Prayer row render function ────────────────────────────────────────────────
  const renderPrayerRow = (prayer, status, rowIndex) => {
    const time    = prayerTimes?.[prayer.key];
    const alarmOn = !!alarms[prayer.key];
    const isPast     = status === "past";
    const isCurrent  = status === "current";
    const isUpcoming = status === "upcoming";
    const isLastRow  = rowIndex === totalGroups - 1;

    const dotBg  = isPast ? `color-mix(in srgb,${green} 13%,transparent)`  : isCurrent ? gold : "transparent";
    const dotBrd = isPast ? green         : isCurrent ? gold : goldDim;
    const dotClr = isPast ? green         : isCurrent ? "var(--onGold)" : "transparent";

    return (
      <div key={prayer.key} style={{ display:"flex", gap:"8px" }}
        onClick={() => setSelectedPrayer(prayer)}>

        {/* ── Timeline column ── */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"22px", flexShrink:0 }}>
          <div style={{
            width:"1.5px", height:"14px", flexShrink:0,
            background: isPast ? `color-mix(in srgb,${green} 33%,transparent)` : goldBdr,
          }} />
          <div style={{
            width:"20px", height:"20px", borderRadius:"50%", flexShrink:0,
            border:`2px solid ${dotBrd}`, background:dotBg,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"10px", fontWeight:800, color:dotClr,
          }}>
            {isPast ? "✓" : ""}
          </div>
          {!isLastRow && (
            <div style={{
              width:"1.5px", flex:1, minHeight:"14px",
              background: isPast ? `color-mix(in srgb,${green} 25%,transparent)` : isCurrent ? `color-mix(in srgb,${gold} 25%,transparent)` : goldBdr,
            }} />
          )}
        </div>

        {/* ── Prayer card ── */}
        <div style={{
          flex:1, display:"flex", alignItems:"center", gap:"10px",
          padding:"11px 13px", marginBottom:"7px",
          background: isCurrent
            ? `linear-gradient(135deg,color-mix(in srgb,${gold} 10%,transparent),color-mix(in srgb,${gold} 3%,transparent))`
            : isPast ? "transparent" : cardBg,
          border:`1px solid ${isCurrent ? gold+"55" : isPast ? goldBdr+"88" : goldBdr}`,
          borderRadius:"14px", cursor:"pointer",
          transition:"opacity 0.2s",
          boxShadow: isCurrent ? `0 2px 22px color-mix(in srgb,${gold} 13%,transparent)` : "none",
          opacity: isPast ? 0.6 : 1,
        }}>

          {/* Icon */}
          <div style={{
            width:"36px", height:"36px", borderRadius:"10px", flexShrink:0,
            background: isCurrent ? `color-mix(in srgb,${gold} 16%,transparent)` : goldFaint,
            border:`1px solid ${goldBdr}`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px",
          }}>
            {prayer.icon}
          </div>

          {/* Name + arabic + countdown */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
              <span style={{
                color: isCurrent ? gold : isPast ? textDim : textClr,
                fontSize:`${14*textSize}px`, fontWeight: isCurrent ? 800 : 600,
              }}>
                {prayer.label}
              </span>
              {isCurrent && (
                <span style={{
                  fontSize:`${8.5*textSize}px`,
                  color: "var(--onGold)",
                  background: gold, padding:"2px 7px", borderRadius:"5px",
                  fontWeight:800, letterSpacing:"0.5px",
                }}>
                  CURRENT
                </span>
              )}
            </div>
            <div style={{ color:goldDim, fontSize:`${11*textSize}px`, fontFamily:"var(--font-ar)", marginTop:"1px" }}>
              {prayer.arabic}
            </div>
            {isUpcoming && time && (
              <div style={{ color:goldDim, fontSize:`${10.5*textSize}px`, marginTop:"3px" }}>
                ⏱ {miniCd(time)}
              </div>
            )}
          </div>

          {/* Time + alarm toggle */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px", flexShrink:0 }}>
            <div style={{
              color: isCurrent ? gold : isPast ? textDim : textClr,
              fontSize:`${14*textSize}px`, fontWeight:700, fontVariantNumeric:"tabular-nums",
              display:"flex", alignItems:"center", gap:"4px",
            }}>
              <span style={{ fontSize:"12px", opacity:0.6 }}>🕐</span>
              {time || "--:--"}
            </div>
            {prayer.hasAlarm && (
              <button
                onClick={e => { e.stopPropagation(); toggleAlarm(prayer.key); }}
                title={alarmOn ? "Disable alarm" : "Enable alarm"}
                style={{
                  display:"flex", alignItems:"center", gap:"3px",
                  background:"none",
                  border:`1px solid ${alarmOn ? gold : goldBdr}`,
                  borderRadius:"7px", padding:"2px 8px",
                  cursor:"pointer",
                  color: alarmOn ? gold : textDim,
                  fontSize:`${10*textSize}px`,
                  transition:"color 0.2s, border-color 0.2s",
                  lineHeight:1.4, fontFamily:"Nunito,sans-serif",
                }}>
                🔔 {alarmOn ? "On" : "Off"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Section label ─────────────────────────────────────────────────────────────
  const renderSectionLabel = (label) => (
    <div style={{
      fontSize:`${10*textSize}px`, fontWeight:700, letterSpacing:"1.5px",
      color:textDim, marginBottom:"6px", marginTop:"2px",
      paddingLeft:"30px", textTransform:"uppercase",
    }}>
      {label}
    </div>
  );

  // ── Website view body (matches the approved desktop design) ─────────────────
  const dkStatus  = (i) => curIdx < 0 ? "upcoming" : i < curIdx ? "past" : i === curIdx ? "current" : "upcoming";
  const dkDetail  = selectedPrayer || currentPrayer || PRAYER_LIST[0];
  const dkInfo    = PRAYER_INFO[dkDetail.key];
  const dkLines   = dkInfo?.adhkar ? dkInfo.adhkar.split("\n") : [];
  const dkCur     = to12(prayerTimes?.[currentKey]);
  const dkNxt     = to12(prayerTimes?.[nextKey]);
  const dkDetTime = to12(prayerTimes?.[dkDetail.key]);
  const dkLbl     = { fontSize:"10.5px", fontWeight:600, letterSpacing:"1.6px", color:"var(--faint)", textTransform:"uppercase" };
  const dkBox     = (sz, r) => ({ width:sz, height:sz, borderRadius:r, border:"1px solid var(--line)", background:"var(--chip)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gold)", flex:"none" });

  const dockedBody = prayerTimes ? (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 360px", gap:"24px", alignItems:"start" }}>

      {/* ── Left column ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:"22px", minWidth:0 }}>
        {permError && (
          <div style={{ background:"color-mix(in srgb,var(--warn) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 25%,transparent)", borderRadius:"12px", padding:"10px 14px", fontSize:"12.5px", color:"var(--warn)" }}>{permError}</div>
        )}
        {notifPerm === "denied" && !permError && (
          <div style={{ border:"1px solid var(--lineSoft)", background:"var(--panel)", borderRadius:"12px", padding:"10px 14px", fontSize:"12px", color:"var(--warn)" }}>Notifications blocked — alarms won't fire in the background.</div>
        )}

        {/* Hero */}
        <section className="card" style={{ padding:"26px 26px 22px", background:"linear-gradient(160deg,var(--active),var(--panel))" }}>
          <div style={{ display:"grid", gridTemplateColumns: nextPrayer ? "minmax(0,1fr) 260px" : "minmax(0,1fr)", alignItems:"stretch", gap:"24px" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
                <span style={dkBox("58px","13px")}><DkIco d={DK_ICON[currentKey] || DK_ICON.Dhuhr} size={30}/></span>
                <div>
                  <span style={{ display:"inline-block", fontSize:"9.5px", fontWeight:700, letterSpacing:"1px", color:"var(--onGold)", background:"var(--goldFill)", padding:"3px 9px", borderRadius:"7px" }}>CURRENT PRAYER</span>
                  <div style={{ marginTop:"4px" }}>
                    <span className="h2" style={{ fontSize:"32px", lineHeight:1, color:"var(--text)" }}>{currentPrayer?.label || "—"}</span>
                    <span lang="ar" style={{ marginLeft:"12px", fontFamily:"var(--font-ar)", fontSize:"21px", color:"var(--gold)" }}>{currentPrayer?.arabic}</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:"18px", display:"flex", alignItems:"baseline", gap:"10px", color:"var(--gold)", fontVariantNumeric:"tabular-nums" }}>
                <span style={{ fontSize:"44px", fontWeight:700, letterSpacing:"2px", lineHeight:1 }}>{dkCur.t}</span>
                <span style={{ fontSize:"18px", fontWeight:700 }}>{dkCur.ap}</span>
              </div>
            </div>
            {nextPrayer && (
              <div style={{ padding:"18px 20px", borderRadius:"14px", border:"1px solid var(--line)", background:"var(--panel2)", display:"flex", flexDirection:"column", justifyContent:"center" }}>
                <div style={dkLbl}>Next prayer</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:"10px", marginTop:"6px" }}>
                  <span className="h2" style={{ fontSize:"22px", color:"var(--text)" }}>{nextPrayer.label}</span>
                  <span lang="ar" style={{ fontFamily:"var(--font-ar)", fontSize:"19px", color:"var(--gold)" }}>{nextPrayer.arabic}</span>
                  <span style={{ marginLeft:"auto", fontSize:"14px", fontWeight:700, color:"var(--gold)", fontVariantNumeric:"tabular-nums" }}>{dkNxt.t} {dkNxt.ap}</span>
                </div>
                <div style={{ height:"1px", background:"var(--lineSoft)", margin:"14px 0" }}/>
                <div style={dkLbl}>Remaining</div>
                <div style={{ marginTop:"2px", fontSize:"26px", fontWeight:600, color:"var(--gold)", fontVariantNumeric:"tabular-nums", letterSpacing:"1px" }}>{countdown}</div>
              </div>
            )}
          </div>
          <div style={{ marginTop:"22px", height:"6px", borderRadius:"3px", background:"var(--lineSoft)", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress.toFixed(1)}%`, borderRadius:"3px", background:"var(--gold)", opacity:.9, transition:"width 1s linear" }}/>
          </div>
          <div style={{ marginTop:"8px", fontSize:"12px", fontWeight:600, color:"var(--faint)" }}>{Math.round(progress)}% of {currentPrayer?.label} time has passed</div>
        </section>

        {/* Prayer cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:"14px" }}>
          {PRAYER_LIST.map((prayer, i) => {
            const st     = dkStatus(i);
            const isCur  = st === "current";
            const isSel  = dkDetail.key === prayer.key && !!selectedPrayer;
            const t12    = to12(prayerTimes[prayer.key]);
            const on     = !!alarms[prayer.key];
            const chip   = st === "past" ? "Completed" : isCur ? "CURRENT" : miniCd(prayerTimes[prayer.key]);
            return (
              <article key={prayer.key} className="pc" style={{ position:"relative", padding:"16px 16px 14px", borderRadius:"14px", border:`1px solid ${isSel ? "var(--gold)" : isCur ? "var(--line)" : "var(--lineSoft)"}`, background: isCur ? "var(--active)" : "var(--panel)", opacity: st === "past" ? 0.7 : 1 }}>
                <button onClick={() => setSelectedPrayer(prayer)} aria-label={`Show details for ${prayer.label}`} aria-pressed={isSel}
                  style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:0, borderRadius:"inherit", background:"transparent", cursor:"pointer" }}/>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px" }}>
                  <span style={dkBox("40px","12px")}><DkIco d={DK_ICON[prayer.key]} size={21}/></span>
                  <span style={{ fontSize:"10.5px", fontWeight:700, letterSpacing:".6px", padding:"3px 9px", borderRadius:"7px", color: st === "past" ? "var(--green)" : isCur ? "var(--onGold)" : "var(--faint)", background: isCur ? "var(--goldFill)" : "transparent" }}>{chip}</span>
                </div>
                <div style={{ display:"flex", alignItems:"baseline", gap:"10px", marginTop:"12px" }}>
                  <span className="h2" style={{ fontSize:"21px", lineHeight:1.1, color: isCur ? "var(--gold)" : "var(--text)" }}>{prayer.label}</span>
                  <span lang="ar" style={{ fontFamily:"var(--font-ar)", fontSize:"17px", color:"var(--gold)" }}>{prayer.arabic}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", marginTop:"8px" }}>
                  <span style={{ whiteSpace:"nowrap", fontSize:"17px", fontWeight:600, fontVariantNumeric:"tabular-nums", color: isCur ? "var(--gold)" : "var(--text)" }}>{t12.t}<span style={{ fontSize:"11.5px", fontWeight:700, color:"var(--faint)" }}> {t12.ap}</span></span>
                  {prayer.hasAlarm && (
                    <button onClick={() => toggleAlarm(prayer.key)} aria-pressed={on} aria-label={`${on ? "Disable" : "Enable"} ${prayer.label} alarm`}
                      style={{ position:"relative", zIndex:2, display:"flex", alignItems:"center", gap:"5px", height:"28px", padding:"0 9px", borderRadius:"9px", border:`1px solid ${on ? "var(--gold)" : "var(--line)"}`, background: on ? "var(--chip)" : "transparent", color: on ? "var(--gold)" : "var(--faint)", fontFamily:"inherit", fontSize:"10.5px", fontWeight:700, cursor:"pointer" }}>
                      <DkIco d={on ? DK_BELL : DK_BELLOFF} size={14} sw={2}/>{on ? "On" : "Off"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Right column ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:"16px", minWidth:0 }}>
        <section className="card" aria-live="polite" style={{ padding:"22px 22px 20px", background:"var(--panel2)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <span style={dkBox("46px","10px")}><DkIco d={DK_ICON[dkDetail.key]} size={24}/></span>
              <div>
                <div className="h2" style={{ fontSize:"22px", lineHeight:1.1, color:"var(--text)" }}>{dkDetail.label}</div>
                <div lang="ar" style={{ fontFamily:"var(--font-ar)", fontSize:"18px", color:"var(--gold)" }}>{dkDetail.arabic}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={dkLbl}>Time</div>
              <div style={{ fontSize:"17px", fontWeight:600, color:"var(--gold)", fontVariantNumeric:"tabular-nums" }}>{dkDetTime.t} {dkDetTime.ap}</div>
            </div>
          </div>
          <div style={{ height:"1px", background:"var(--lineSoft)", margin:"16px 0" }}/>
          <div style={dkLbl}>Rakats</div>
          <div style={{ marginTop:"4px", fontSize:"14px", fontWeight:700, color:"var(--gold)" }}>{dkInfo?.rakats}</div>
          <div style={{ ...dkLbl, marginTop:"14px" }}>About</div>
          <div style={{ marginTop:"4px", fontSize:"13.5px", lineHeight:1.7, fontWeight:500, color:"var(--dim)" }}>{dkInfo?.desc}</div>
          {dkLines.length > 0 && (
            <div style={{ marginTop:"16px", padding:"14px 16px", borderRadius:"11px", border:"1px solid var(--line)", background:"var(--chip)" }}>
              <div style={dkLbl}>Recommended adhkar</div>
              {dkLines.map((line, i) => i === 0 ? (
                <div key={i} lang="ar" dir="rtl" style={{ marginTop:"8px", fontFamily:"var(--font-ar)", fontSize:"22px", lineHeight:1.6, color:"var(--gold)" }}>{line}</div>
              ) : (
                <div key={i} style={{ marginTop:"4px", fontSize:"12.5px", lineHeight:1.6, fontWeight:600, color:"var(--text)" }}>{line}</div>
              ))}
            </div>
          )}
        </section>

        {(prayerTimes.Sunrise || prayerTimes.Sunset) && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            {[["Sunrise", prayerTimes.Sunrise, DK_ICON.Sunrise], ["Sunset", prayerTimes.Sunset, DK_ICON.Maghrib]].map(([lab, val, ic]) => val && (
              <div key={lab} className="card" style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", borderRadius:"13px" }}>
                <span style={{ color:"var(--gold)" }}><DkIco d={ic} size={26}/></span>
                <div>
                  <div style={{ fontSize:"10.5px", fontWeight:600, color:"var(--faint)" }}>{lab}</div>
                  <div style={{ fontSize:"14.5px", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{to12(val).t} {to12(val).ap}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="card" style={{ display:"flex", gap:"12px", padding:"16px 18px", borderRadius:"13px", background:"var(--chip)" }}>
          <span style={{ flex:"none", color:"var(--gold)", marginTop:"1px" }}><DkIco d={DK_QUOTE} size={22}/></span>
          <div>
            <div style={{ fontSize:"13.5px", lineHeight:1.65, fontWeight:600 }}>{insight.text}</div>
            <div style={{ marginTop:"6px", fontSize:"11.5px", fontWeight:700, color:"var(--gold)" }}>— {insight.source}</div>
          </div>
        </section>

        <button className="cb" onClick={() => navigateTo("qibla")} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", height:"56px", padding:"0 18px", borderRadius:"13px", border:"1px solid var(--line)", background:"var(--panel)", color:"var(--text)", fontFamily:"inherit", fontSize:"13.5px", fontWeight:700, cursor:"pointer" }}>
          <span style={{ display:"flex", alignItems:"center", gap:"12px" }}><span style={{ color:"var(--gold)", display:"flex" }}><DkIco d={DK_COMPASS} size={22}/></span>Open Qibla Direction</span>
          <span style={{ color:"var(--faint)", display:"flex" }}><DkIco d={DK_CHEV} size={18} sw={2}/></span>
        </button>

        <div style={{ display:"flex", gap:"10px", padding:"12px 14px", borderRadius:"11px", border:"1px solid var(--lineSoft)", background:"var(--panel)", fontSize:"11.5px", lineHeight:1.55, fontWeight:600, color:"var(--faint)" }}>
          <span style={{ flex:"none", display:"flex" }}><DkIco d={DK_INFO} size={16}/></span>
          Browser alarms work best when the app is installed to your Home Screen.
        </div>
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:pageBg }}>

      <style>{`
        @keyframes pulse   { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="nur-ph" style={{
        display:"flex", alignItems:"center", padding:"12px 16px",
        borderBottom:`1px solid ${goldBdr}`, background:headerBg,
        backdropFilter:"blur(14px)", flexShrink:0, gap:"10px",
      }}>
        <button className="nur-ph-menu" onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center" }}>
          <div style={{ color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"0.5px" }}>Prayer Times</div>
          {locationName && (
            <div style={{ color:goldDim, fontSize:`${11*textSize}px`, display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>{docked ? <DkIco d={DK_PIN} size={15}/> : "📍"} {locationName}</span>
              {docked && <><span>{todayStr}</span><span aria-hidden="true">·</span><span>{hijriDate}</span></>}
            </div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
          <button onClick={() => setShowCityInput(v => !v)} title="Change city"
            style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius: docked ? "12px" : "8px", padding: docked ? "0 16px" : "5px 10px", height: docked ? "40px" : "auto", display:"flex", alignItems:"center", gap:"8px", color: docked ? gold : goldDim, fontSize: docked ? "13px" : `${13*textSize}px`, fontWeight: docked ? 700 : 400, cursor:"pointer" }}>
            {docked ? <><DkIco d={DK_PIN} size={16}/>Change city</> : "📍"}
          </button>
          <button className="nur-ph-back" onClick={onBack}
            style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", padding:"4px", flexShrink:0 }}>
            ←
          </button>
        </div>
      </div>

      {/* ── City input ─────────────────────────────────────────────────────── */}
      {showCityInput && (
        <div style={{ padding: docked ? "4px 40px 16px" : "10px 16px", borderBottom: docked ? "none" : `1px solid ${goldBdr}`, background: docked ? "transparent" : headerBg, flexShrink:0, maxWidth: docked ? "600px" : "none" }}>
          <div style={{ display:"flex", gap:"8px" }}>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupCity()}
              placeholder="e.g. Hyderabad, India · London, UK"
              style={{ flex:1, background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"10px", padding:"9px 12px", color:textClr, fontSize:`${13*textSize}px`, outline:"none", fontFamily:"Nunito,sans-serif" }}
            />
            <button onClick={lookupCity} style={{ padding:"9px 18px", borderRadius:"10px", background:"var(--goldFill)", border:"none", color:"var(--onGold)", fontSize:`${13*textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              Go
            </button>
          </div>
          {locError && (
            <div style={{ color:"var(--warn)", fontSize:`${12*textSize}px`, marginTop:"8px" }}>{locError}</div>
          )}
        </div>
      )}

      {/* ── Scroll body ────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:"auto", padding: docked ? "10px 40px 52px" : "14px 16px 52px" }}>

        {/* Loading dots */}
        {loading && (
          <div style={{ display:"flex", justifyContent:"center", padding:"60px", gap:"6px" }}>
            {[0,1,2].map(d => (
              <div key={d} style={{ width:"8px", height:"8px", borderRadius:"50%", background:gold, animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>
            ))}
          </div>
        )}

        {/* No data state */}
        {!loading && !prayerTimes && (
          <div style={{ textAlign:"center", color:textDim, padding:"32px 20px", fontSize:`${13*textSize}px` }}>
            {locError || "Could not load prayer times."}
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        {prayerTimes && (docked ? dockedBody : (
          <>

            {/* ── Hero card ──────────────────────────────────────────────── */}
            <div style={{
              background:"var(--panel2)",
              border:`1px solid color-mix(in srgb,${gold} 27%,transparent)`,
              borderRadius:"20px", padding:"20px",
              marginBottom:"12px",
              boxShadow:`0 4px 32px color-mix(in srgb,${gold} 9%,transparent)`,
            }}>

              {/* Current prayer name row */}
              <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
                <span style={{ fontSize:"30px", lineHeight:1 }}>{currentPrayer?.icon || "🕌"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                    <span style={{ color:textClr, fontSize:`${21*textSize}px`, fontWeight:800 }}>
                      {currentPrayer?.label || "—"}
                    </span>
                    <span style={{
                      fontSize:`${8.5*textSize}px`, fontWeight:800, letterSpacing:"0.6px",
                      color: "var(--onGold)",
                      background:gold, padding:"3px 8px", borderRadius:"6px",
                    }}>
                      CURRENT PRAYER
                    </span>
                  </div>
                  <div style={{ color:goldDim, fontSize:`${13*textSize}px`, fontFamily:"var(--font-ar)", marginTop:"2px" }}>
                    {currentPrayer?.arabic}
                  </div>
                </div>
              </div>

              {/* Big prayer time */}
              <div style={{
                color:gold, fontSize:`${44*textSize}px`, fontWeight:900,
                fontVariantNumeric:"tabular-nums", letterSpacing:"4px",
                lineHeight:1, marginBottom:"16px",
              }}>
                {prayerTimes[currentKey] || "--:--"}
              </div>

              {/* Progress bar */}
              <div style={{ height:"5px", borderRadius:"3px", background: "var(--panel2)", marginBottom:"6px", overflow:"hidden" }}>
                <div style={{
                  height:"100%", borderRadius:"3px",
                  width:`${progress.toFixed(1)}%`,
                  background:`linear-gradient(90deg,color-mix(in srgb,${gold} 53%,transparent),${gold})`,
                  transition:"width 1s linear",
                }}/>
              </div>
              <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginBottom:"14px" }}>
                {Math.round(progress)}% of {currentPrayer?.label} time has passed
              </div>

              {/* Next prayer + countdown pill */}
              {nextPrayer && (
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"12px 14px",
                  background: "var(--panel)",
                  border:`1px solid ${goldBdr}`, borderRadius:"12px",
                  marginBottom:"14px",
                }}>
                  <div>
                    <div style={{ color:textDim, fontSize:`${10*textSize}px`, marginBottom:"3px" }}>Next Prayer</div>
                    <div style={{ color:textClr, fontSize:`${14*textSize}px`, fontWeight:700 }}>
                      {nextPrayer.label}{" "}
                      <span style={{ color:goldDim, fontFamily:"var(--font-ar)", fontWeight:400, fontSize:`${12*textSize}px` }}>
                        {nextPrayer.arabic}
                      </span>
                    </div>
                    <div style={{ color:gold, fontSize:`${13*textSize}px`, fontWeight:700, fontVariantNumeric:"tabular-nums", marginTop:"2px" }}>
                      🕐 {prayerTimes[nextKey]}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:textDim, fontSize:`${10*textSize}px`, marginBottom:"3px" }}>Remaining</div>
                    <div style={{ color:gold, fontSize:`${19*textSize}px`, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                      ⏳ {fmtCd(countdown)}
                    </div>
                  </div>
                </div>
              )}

              {/* Gregorian + Hijri date */}
              <div style={{ color:textDim, fontSize:`${11*textSize}px`, textAlign:"center" }}>
                {todayStr} · {hijriDate}
              </div>
            </div>

            {/* ── Sunrise / Sunset card ───────────────────────────────────── */}
            {(prayerTimes.Sunrise || prayerTimes.Sunset) && (
              <div style={{ display:"flex", gap:"10px", marginBottom:"12px" }}>
                {prayerTimes.Sunrise && (
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:"10px", padding:"12px 14px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
                    <span style={{ fontSize:"22px", flexShrink:0 }}>🌅</span>
                    <div>
                      <div style={{ color:textDim, fontSize:`${10*textSize}px`, marginBottom:"2px" }}>Sunrise</div>
                      <div style={{ color:textClr, fontSize:`${15*textSize}px`, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>
                        {prayerTimes.Sunrise}
                      </div>
                    </div>
                  </div>
                )}
                {prayerTimes.Sunset && (
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:"10px", padding:"12px 14px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
                    <span style={{ fontSize:"22px", flexShrink:0 }}>🌇</span>
                    <div>
                      <div style={{ color:textDim, fontSize:`${10*textSize}px`, marginBottom:"2px" }}>Sunset</div>
                      <div style={{ color:textClr, fontSize:`${15*textSize}px`, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>
                        {prayerTimes.Sunset}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Daily insight card ──────────────────────────────────────── */}
            <div style={{
              background: "var(--chip)",
              border:`1px solid ${goldBdr}`, borderRadius:"14px",
              padding:"14px 16px", marginBottom:"16px",
            }}>
              <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                <span style={{ fontSize:"22px", lineHeight:1, flexShrink:0, marginTop:"2px", color:gold }}>❝</span>
                <div>
                  <div style={{ color:textClr, fontSize:`${13*textSize}px`, lineHeight:1.6, marginBottom:"6px" }}>
                    {insight.text}
                  </div>
                  <div style={{ color:goldDim, fontSize:`${11*textSize}px` }}>— {insight.source}</div>
                </div>
              </div>
            </div>

            {/* ── Permission errors ───────────────────────────────────────── */}
            {permError && (
              <div style={{ background:"color-mix(in srgb,var(--warn) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 25%,transparent)", borderRadius:"12px", padding:"10px 14px", marginBottom:"12px", fontSize:`${12*textSize}px`, color:"var(--warn)" }}>
                {permError}
              </div>
            )}
            {notifPerm === "denied" && !permError && (
              <div style={{ background:"color-mix(in srgb,var(--warn) 6%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 18%,transparent)", borderRadius:"12px", padding:"10px 14px", marginBottom:"12px", fontSize:`${11*textSize}px`, color:"color-mix(in srgb,var(--warn) 70%,transparent)", textAlign:"center" }}>
                Notifications blocked — alarms won't fire in the background.
              </div>
            )}

            {/* ── Prayer list with timeline ───────────────────────────────── */}
            <div style={{ marginBottom:"14px" }}>
              {/* COMPLETED */}
              {pastPrayers.length > 0 && (
                <>
                  {renderSectionLabel("Completed")}
                  {pastPrayers.map((p, i) => renderPrayerRow(p, "past", i))}
                </>
              )}

              {/* CURRENT */}
              {curPrayerArr.length > 0 && (
                <>
                  {renderSectionLabel("Current")}
                  {curPrayerArr.map((p, i) =>
                    renderPrayerRow(p, "current", pastPrayers.length + i)
                  )}
                </>
              )}

              {/* UPCOMING */}
              {upcomPrayers.length > 0 && (
                <>
                  {renderSectionLabel("Upcoming")}
                  {upcomPrayers.map((p, i) =>
                    renderPrayerRow(p, "upcoming", pastPrayers.length + curPrayerArr.length + i)
                  )}
                </>
              )}
            </div>

            {/* ── Qibla shortcut ─────────────────────────────────────────── */}
            <button onClick={() => navigateTo("qibla")} style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"14px 18px", background:cardBg,
              border:`1px solid ${goldBdr}`, borderRadius:"14px",
              cursor:"pointer", marginBottom:"12px",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"20px" }}>🧭</span>
                <span style={{ fontSize:`${14*textSize}px`, fontWeight:600, color:textClr }}>Open Qibla Compass</span>
              </div>
              <span style={{ color:goldDim, fontSize:"18px", lineHeight:1 }}>›</span>
            </button>

            {/* ── PWA hint ───────────────────────────────────────────────── */}
            <div style={{
              display:"flex", gap:"8px", alignItems:"flex-start",
              padding:"10px 14px",
              background: "var(--panel)",
              border:`1px solid ${goldBdr}`, borderRadius:"12px",
            }}>
              <span style={{ fontSize:"14px", flexShrink:0, marginTop:"1px" }}>ℹ️</span>
              <span style={{ color:textDim, fontSize:`${11*textSize}px`, lineHeight:1.55 }}>
                Browser alarms work best when the app is installed to your Home Screen.
              </span>
            </div>

          </>
        ))}
      </div>

      {/* ── Prayer detail bottom sheet ────────────────────────────────────── */}
      {selectedPrayer && !docked && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedPrayer(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:900, animation:"fadeIn 0.2s ease" }}
          />

          {/* Sheet */}
          <div style={{
            position:"fixed", bottom:0, left:0, right:0,
            background:modalBg,
            borderRadius:"22px 22px 0 0",
            padding:"8px 20px 44px",
            zIndex:901,
            boxShadow:"0 -8px 40px rgba(0,0,0,0.45)",
            animation:"slideUp 0.28s ease",
            maxHeight:"82vh", overflowY:"auto",
          }}>

            {/* Drag handle */}
            <div style={{ width:"40px", height:"4px", borderRadius:"2px", background:goldDim, margin:"8px auto 18px" }} />

            {/* Prayer header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"50px", height:"50px", borderRadius:"14px", background:`color-mix(in srgb,${gold} 13%,transparent)`, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"26px", flexShrink:0 }}>
                  {selectedPrayer.icon}
                </div>
                <div>
                  <div style={{ color:textClr, fontSize:`${21*textSize}px`, fontWeight:800 }}>{selectedPrayer.label}</div>
                  <div style={{ color:goldDim, fontSize:`${15*textSize}px`, fontFamily:"var(--font-ar)" }}>{selectedPrayer.arabic}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:textDim, fontSize:`${10*textSize}px`, marginBottom:"3px" }}>Time</div>
                <div style={{ color:gold, fontSize:`${19*textSize}px`, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                  {prayerTimes[selectedPrayer.key] || "--:--"}
                </div>
              </div>
            </div>

            <div style={{ height:"1px", background:goldBdr, marginBottom:"18px" }} />

            {/* Rakats */}
            <div style={{ marginBottom:"16px" }}>
              <div style={{ color:textDim, fontSize:`${10*textSize}px`, letterSpacing:"1.2px", textTransform:"uppercase", marginBottom:"6px" }}>Rakats</div>
              <div style={{ color:gold, fontSize:`${15*textSize}px`, fontWeight:700 }}>{selInfo?.rakats}</div>
            </div>

            {/* About */}
            <div style={{ marginBottom:"18px" }}>
              <div style={{ color:textDim, fontSize:`${10*textSize}px`, letterSpacing:"1.2px", textTransform:"uppercase", marginBottom:"6px" }}>About</div>
              <div style={{ color:textClr, fontSize:`${13*textSize}px`, lineHeight:1.65 }}>{selInfo?.desc}</div>
            </div>

            {/* Recommended Adhkar */}
            {selInfo?.adhkar && (
              <div style={{ background: "var(--chip)", border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"14px 16px", marginBottom:"8px" }}>
                <div style={{ color:textDim, fontSize:`${10*textSize}px`, letterSpacing:"1.2px", textTransform:"uppercase", marginBottom:"10px" }}>Recommended Adhkar</div>
                {selInfo.adhkar.split("\n").map((line, i) => (
                  <div key={i} style={{
                    color: i === 0 ? gold : textClr,
                    fontSize: i === 0 ? `${17*textSize}px` : `${12*textSize}px`,
                    fontFamily: i === 0 ? "Georgia,serif" : "inherit",
                    lineHeight: 1.7,
                    marginBottom: i === 0 ? "4px" : 0,
                  }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Close */}
            <button
              onClick={() => setSelectedPrayer(null)}
              style={{ width:"100%", marginTop:"16px", padding:"13px", background:`color-mix(in srgb,${gold} 9%,transparent)`, border:`1px solid ${goldBdr}`, borderRadius:"12px", color:gold, fontSize:`${14*textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
