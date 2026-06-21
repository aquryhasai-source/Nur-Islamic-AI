import { useState, useEffect } from "react";
import { HIJRI_MONTHS, ISLAMIC_EVENTS } from "./utils.js";

export default function IslamicCalendarPage({ onBack, lightMode, textSize = 1 }) {
  const [hijriToday, setHijriToday] = useState(null);
  const [calMonth,   setCalMonth]   = useState(null);
  const [loading,    setLoading]    = useState(true);

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.85)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.4)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const eventBg  = lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";

  useEffect(() => {
    const fetchHijri = async () => {
      try {
        const today = new Date();
        const dd   = String(today.getDate()).padStart(2, "0");
        const mm   = String(today.getMonth() + 1).padStart(2, "0");
        const yyyy = today.getFullYear();
        const res  = await fetch(`https://api.aladhan.com/v1/gToH?date=${dd}-${mm}-${yyyy}`);
        const data = await res.json();
        const h    = data.data.hijri;
        setHijriToday({ day: parseInt(h.day), month: h.month.number, year: parseInt(h.year), monthEn: h.month.en });

        // Fetch full month calendar for everyone
        const calRes  = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${mm}/${yyyy}`);
        const calData = await calRes.json();
        if (calData.code === 200) {
          const days = calData.data.map(d => ({
            gregorianDay: parseInt(d.gregorian.day),
            hijriDay:     parseInt(d.hijri.day),
            hijriMonth:   d.hijri.month.number,
            hijriYear:    parseInt(d.hijri.year),
          }));
          setCalMonth({ year: parseInt(h.year), month: h.month.number, monthEn: h.month.en, days });
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchHijri();
  }, []);

  const upcomingEvents = hijriToday
    ? Object.entries(ISLAMIC_EVENTS)
        .map(([key, name]) => {
          const [m, d] = key.split("-").map(Number);
          let daysAway = (m - hijriToday.month) * 30 + (d - hijriToday.day);
          if (daysAway < 0) daysAway += 354;
          return { name, hijriDate: `${HIJRI_MONTHS[m-1]} ${d}`, daysAway };
        })
        .sort((a, b) => a.daysAway - b.daysAway)
        .slice(0, 5)
    : [];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Islamic Calendar</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"0 0 40px" }}>

        {/* Today's Hijri date */}
        <div style={{ padding:"20px 20px 16px", textAlign:"center", borderBottom:`1px solid ${goldBdr}` }}>
          {loading ? (
            <div style={{ color:goldDim, fontSize:"13px" }}>Loading…</div>
          ) : hijriToday ? (
            <>
              <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"8px" }}>Today</div>
              <div style={{ color:gold, fontSize:`${36 * textSize}px`, fontWeight:900, lineHeight:1, marginBottom:"4px" }}>{hijriToday.day}</div>
              <div style={{ color:textClr, fontSize:`${16 * textSize}px`, fontWeight:700 }}>{hijriToday.monthEn} {hijriToday.year} AH</div>
              <div style={{ color:textDim, fontSize:`${11 * textSize}px`, marginTop:"4px" }}>{HIJRI_MONTHS[hijriToday.month - 1]}</div>
            </>
          ) : (
            <div style={{ color:"#e07b54", fontSize:"13px" }}>Could not load date</div>
          )}
        </div>

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <div style={{ padding:"18px 20px", borderBottom:`1px solid ${goldBdr}` }}>
            <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>Upcoming</div>
            {upcomingEvents.map((ev, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", marginBottom:"6px", background:eventBg, border:`1px solid ${goldBdr}`, borderRadius:"12px" }}>
                <div>
                  <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:600 }}>{ev.name}</div>
                  <div style={{ color:textDim, fontSize:`${11 * textSize}px`, marginTop:"2px" }}>{ev.hijriDate}</div>
                </div>
                <div style={{ color:gold, fontSize:`${12 * textSize}px`, fontWeight:700 }}>
                  {ev.daysAway === 0 ? "Today!" : `${ev.daysAway}d`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full calendar grid — shown to everyone */}
        {calMonth && (
          <div style={{ padding:"20px" }}>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ color:gold, fontSize:`${15 * textSize}px`, fontWeight:700 }}>{calMonth.monthEn} {calMonth.year} AH</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"4px", marginBottom:"8px" }}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                <div key={d} style={{ textAlign:"center", color:goldDim, fontSize:"11px", fontWeight:700, padding:"6px 0" }}>{d}</div>
              ))}
            </div>
            {(() => {
              const today = new Date();
              const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              const startDay = firstOfMonth.getDay();
              const cells = [...Array(startDay).fill(null), ...calMonth.days];
              return (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"4px" }}>
                  {cells.map((cell, i) => {
                    if (!cell) return <div key={i}/>;
                    const isToday = hijriToday && cell.hijriDay === hijriToday.day && cell.hijriMonth === hijriToday.month;
                    const eventKey = `${cell.hijriMonth}-${cell.hijriDay}`;
                    const hasEvent = ISLAMIC_EVENTS[eventKey];
                    return (
                      <div key={i} title={hasEvent || ""} style={{ aspectRatio:"1", borderRadius:"8px", background: isToday ? gold : hasEvent ? `${gold}22` : goldFaint, border:`1px solid ${isToday ? gold : goldBdr}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor: hasEvent ? "pointer" : "default" }}>
                        <span style={{ color: isToday ? (lightMode?"#fff":"#0d1f14") : textClr, fontSize:`${11 * textSize}px`, fontWeight: isToday ? 800 : 400 }}>{cell.hijriDay}</span>
                        {hasEvent && <div style={{ width:"4px", height:"4px", borderRadius:"50%", background:gold, marginTop:"2px" }}/>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
