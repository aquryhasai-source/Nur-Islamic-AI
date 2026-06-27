import { useState, useEffect, useRef } from "react";
import { KEYS, getPrayerTimes, getPrayerTimesByCity, getCountdownTo } from "./utils.js";

const PRAYER_LIST = [
  { key:"Fajr",    label:"Fajr",    arabic:"الفجر",  icon:"🌙", hasAlarm:true  },
  { key:"Sunrise", label:"Sunrise", arabic:"الشروق", icon:"🌅", hasAlarm:false },
  { key:"Dhuhr",   label:"Dhuhr",   arabic:"الظهر",  icon:"☀️",  hasAlarm:true  },
  { key:"Asr",     label:"Asr",     arabic:"العصر",  icon:"🌤️",  hasAlarm:true  },
  { key:"Maghrib", label:"Maghrib", arabic:"المغرب", icon:"🌇", hasAlarm:true  },
  { key:"Isha",    label:"Isha",    arabic:"العشاء", icon:"🌙", hasAlarm:true  },
];

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
  // Use ServiceWorker showNotification for PWA (body shows reliably)
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => { try { new Notification(title, opts); } catch {} });
  } else {
    try { new Notification(title, opts); } catch {}
  }
}

function getNextPrayerKey(prayerTimes) {
  if (!prayerTimes) return null;
  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const prayers = PRAYER_LIST.filter(p => p.hasAlarm).map(p => {
    const [h, m] = (prayerTimes[p.key] || "00:00").split(":").map(Number);
    return { key: p.key, totalMins: h * 60 + m };
  });
  return (prayers.find(p => p.totalMins > nowMins) || prayers[0])?.key;
}

function getCurrentPrayerKey(prayerTimes) {
  if (!prayerTimes) return null;
  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
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

export default function PrayerTimesPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const [prayerTimes,   setPrayerTimes]   = useState(null);
  const [alarms,        setAlarms]        = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEYS.PRAYER_ALARMS) || "{}"); }
    catch { return {}; }
  });
  const [locationName,  setLocationName]  = useState("");
  const [loading,       setLoading]       = useState(true);
  const [locError,      setLocError]      = useState(null);
  const [showCityInput, setShowCityInput] = useState(false);
  const [city,          setCity]          = useState(localStorage.getItem(KEYS.CITY) || "");
  const [notifPerm,     setNotifPerm]     = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [permError,     setPermError]     = useState("");
  const [nextKey,       setNextKey]       = useState(null);
  const [currentKey,    setCurrentKey]    = useState(null);
  const [countdown,     setCountdown]     = useState("--:--:--");
  const firedAlarms = useRef(new Set());

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.85)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.4)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.06)";

  useEffect(() => {
    const loadByCity = async (cityName) => {
      try {
        const times = await getPrayerTimesByCity(cityName);
        setPrayerTimes(times);
        setLocationName(cityName);
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

  useEffect(() => {
    if (!prayerTimes) return;
    const tick = () => {
      const nk = getNextPrayerKey(prayerTimes);
      const ck = getCurrentPrayerKey(prayerTimes);
      setNextKey(nk);
      setCurrentKey(ck);
      if (nk) {
        const c = getCountdownTo(prayerTimes[nk]);
        setCountdown(`${String(c.hours).padStart(2,"0")}:${String(c.mins).padStart(2,"0")}:${String(c.secs).padStart(2,"0")}`);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [prayerTimes]);

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
          if (Notification.permission === "granted") {
            fireNotification(prayer.label, pTime, fireKey);
          }
        }
      });
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [prayerTimes, alarms]);

  const toggleAlarm = async (prayerKey) => {
    setPermError("");
    if (!alarms[prayerKey]) {
      if (notifPerm === "denied") {
        setPermError("Notifications are blocked. Enable them in your browser settings.");
        return;
      }
      if (notifPerm === "default") {
        try {
          const perm = await Notification.requestPermission();
          setNotifPerm(perm);
          if (perm !== "granted") {
            setPermError("Permission denied. Allow notifications to enable alarms.");
            return;
          }
        } catch {
          setPermError("Could not request notification permission.");
          return;
        }
      }
    }
    const updated = { ...alarms, [prayerKey]: !alarms[prayerKey] };
    setAlarms(updated);
    localStorage.setItem(KEYS.PRAYER_ALARMS, JSON.stringify(updated));
  };

  const lookupCity = async () => {
    if (!city.trim()) return;
    setLoading(true); setLocError(null);
    try {
      const times = await getPrayerTimesByCity(city.trim());
      setPrayerTimes(times);
      setLocationName(city.trim());
      localStorage.setItem(KEYS.CITY, city.trim());
      setShowCityInput(false);
    } catch { setLocError("City not found. Try a nearby major city."); }
    finally { setLoading(false); }
  };

  const nextPrayer = PRAYER_LIST.find(p => p.key === nextKey);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Prayer Times</div>
          {locationName && <div style={{ color:goldDim, fontSize:`${11*textSize}px` }}>{locationName}</div>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
          <button onClick={() => setShowCityInput(v => !v)}
            style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"8px", padding:"5px 10px", color:goldDim, fontSize:`${11*textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
            📍
          </button>
          <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 4px", flexShrink:0 }}>←</button>
        </div>
      </div>

      {/* City input */}
      {showCityInput && (
        <div style={{ padding:"10px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, flexShrink:0 }}>
          <div style={{ display:"flex", gap:"8px" }}>
            <input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key==="Enter" && lookupCity()}
              placeholder="e.g. London, Cairo, Karachi…"
              style={{ flex:1, background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"10px", padding:"9px 12px", color:textClr, fontSize:`${13*textSize}px`, outline:"none", fontFamily:"Nunito,sans-serif" }}/>
            <button onClick={lookupCity}
              style={{ padding:"9px 18px", borderRadius:"10px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, border:"none", color:lightMode?"#fff":"#0d1f14", fontSize:`${13*textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              Go
            </button>
          </div>
          {locError && <div style={{ color:"#e07b54", fontSize:`${12*textSize}px`, marginTop:"8px" }}>{locError}</div>}
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 40px" }}>

        {loading && (
          <div style={{ display:"flex", justifyContent:"center", padding:"50px", gap:"6px" }}>
            {[0,1,2].map(d => <div key={d} style={{ width:"8px", height:"8px", borderRadius:"50%", background:gold, animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
          </div>
        )}

        {!loading && !prayerTimes && (
          <div style={{ textAlign:"center", color:textDim, padding:"32px 20px", fontSize:`${13 * textSize}px` }}>
            {locError || "Could not load prayer times."}
          </div>
        )}

        {prayerTimes && (
          <>
            {nextPrayer && (
              <div style={{ background:`linear-gradient(135deg,${goldFaint},transparent)`, border:`1px solid ${goldBdr}`, borderRadius:"16px", padding:"20px", marginBottom:"16px", textAlign:"center" }}>
                <div style={{ color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"6px" }}>
                  Next Prayer · {nextPrayer.label} {nextPrayer.arabic}
                </div>
                <div style={{ color:gold, fontSize:`${34 * textSize}px`, fontWeight:900, fontVariantNumeric:"tabular-nums", letterSpacing:"3px" }}>
                  {countdown}
                </div>
                <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginTop:"4px" }}>
                  {prayerTimes[nextPrayer.key]}
                </div>
              </div>
            )}

            {permError && (
              <div style={{ background:"rgba(224,123,84,0.08)", border:"1px solid rgba(224,123,84,0.25)", borderRadius:"12px", padding:"10px 14px", marginBottom:"12px", fontSize:`${12 * textSize}px`, color:"#e07b54" }}>
                {permError}
              </div>
            )}

            {notifPerm === "denied" && !permError && (
              <div style={{ background:"rgba(224,123,84,0.06)", border:"1px solid rgba(224,123,84,0.2)", borderRadius:"12px", padding:"10px 14px", marginBottom:"12px", fontSize:`${11 * textSize}px`, color:"rgba(224,123,84,0.7)", textAlign:"center" }}>
                Notifications blocked in browser settings — alarms won't fire in background
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {PRAYER_LIST.map(prayer => {
                const time      = prayerTimes[prayer.key];
                const isNext    = prayer.key === nextKey;
                const isCurrent = prayer.key === currentKey;
                const alarmOn   = !!alarms[prayer.key];

                return (
                  <div key={prayer.key}
                    style={{ display:"flex", alignItems:"center", gap:"14px", padding:"13px 16px", background: isNext ? `${gold}10` : cardBg, border:`1px solid ${isNext ? `${gold}60` : goldBdr}`, borderRadius:"14px", transition:"all 0.2s" }}>
                    <div style={{ width:"40px", height:"40px", borderRadius:"11px", background: isCurrent ? `${gold}20` : goldFaint, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
                      {prayer.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ color: isNext ? gold : textClr, fontSize:`${14 * textSize}px`, fontWeight: isNext ? 800 : 600 }}>
                        {prayer.label}
                        {isCurrent && <span style={{ marginLeft:"8px", fontSize:`${10*textSize}px`, color:gold, background:`${gold}15`, padding:"2px 7px", borderRadius:"6px" }}>Now</span>}
                      </div>
                      <div style={{ color:goldDim, fontSize:`${11 * textSize}px`, fontFamily:"Georgia,serif", marginTop:"1px" }}>{prayer.arabic}</div>
                    </div>
                    <div style={{ color: isNext ? gold : textClr, fontSize:`${16 * textSize}px`, fontWeight:700, fontVariantNumeric:"tabular-nums", marginRight: prayer.hasAlarm ? "10px" : "0" }}>
                      {time || "--:--"}
                    </div>
                    {prayer.hasAlarm && (
                      <button onClick={() => toggleAlarm(prayer.key)}
                        title={alarmOn ? "Disable alarm" : "Enable alarm"}
                        style={{ width:"46px", height:"27px", borderRadius:"14px", border:`1px solid ${alarmOn ? gold : goldBdr}`, background: alarmOn ? gold : lightMode?"rgba(0,0,0,0.07)":"rgba(255,255,255,0.07)", cursor:"pointer", position:"relative", transition:"all 0.25s", flexShrink:0 }}>
                        <div style={{ position:"absolute", top:"3px", left: alarmOn ? "22px" : "3px", width:"21px", height:"21px", borderRadius:"50%", background: alarmOn ? (lightMode?"#fff":"#0d1f14") : goldDim, transition:"left 0.25s" }}/>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign:"center", marginTop:"20px", color:textDim, fontSize:`${11*textSize}px`, lineHeight:1.8 }}>
              Alarms fire while the app is open or installed on your home screen.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
