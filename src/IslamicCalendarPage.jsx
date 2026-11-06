import { useState, useEffect } from "react";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

// ── Inline data ──────────────────────────────────────────────────────────────
const HIJRI_MONTHS = [
  "Muharram","Safar","Rabi al-Awwal","Rabi al-Thani",
  "Jumada al-Awwal","Jumada al-Thani","Rajab","Sha'ban",
  "Ramadan","Shawwal","Dhu al-Qi'dah","Dhu al-Hijjah",
];
const ISLAMIC_EVENTS = {
  "1-1":"Islamic New Year","1-10":"Day of Ashura","3-12":"Mawlid an-Nabi",
  "7-27":"Isra and Mi'raj","8-15":"Shab-e-Barat","9-1":"Start of Ramadan",
  "9-27":"Laylat al-Qadr","10-1":"Eid al-Fitr","12-10":"Eid al-Adha",
};
const EVENT_INFO = {
  "1-1": {icon:"🌙",desc:"The Islamic New Year marks the beginning of the Hijri calendar, commemorating the Hijra — Prophet Muhammad's ﷺ migration from Mecca to Medina in 622 CE.",verse:"Indeed, the number of months with Allah is twelve lunar months in the register of Allah from the day He created the heavens and the earth.",verseRef:"Qur'an 9:36"},
  "1-10":{icon:"🌙",desc:"The Day of Ashura falls on the 10th of Muharram — a day of deep historical and spiritual significance, observed through fasting and remembrance of Allah's mercy.",verse:"This is a great day — Allah saved Musa and his people, and drowned Pharaoh and his people on this day.",verseRef:"Sahih al-Bukhari 2004"},
  "3-12":{icon:"☪️",desc:"Mawlid an-Nabi commemorates the birth of our beloved Prophet Muhammad ﷺ. It is a day of joy, gratitude, and renewed love for the Messenger of Allah.",verse:"And We have not sent you, [O Muhammad], except as a mercy to the worlds.",verseRef:"Qur'an 21:107"},
  "7-27":{icon:"✨",desc:"Isra and Mi'raj marks the miraculous night journey of Prophet Muhammad ﷺ from Masjid al-Haram to Masjid al-Aqsa, and his ascension through the heavens.",verse:"Exalted is He who took His Servant by night from al-Masjid al-Haram to al-Masjid al-Aqsa, whose surroundings We have blessed.",verseRef:"Qur'an 17:1"},
  "8-15":{icon:"🌙",desc:"Shab-e-Barat, the Night of Forgiveness, falls on the 15th of Sha'ban. Muslims spend this night in prayer, seeking Allah's forgiveness before Ramadan.",verse:"Allah descends to the lowest heaven and asks: 'Who is supplicating to Me, so that I may respond?'",verseRef:"Sahih al-Bukhari 1145"},
  "9-1": {icon:"🌙",desc:"The blessed month of Ramadan begins — a time of fasting, prayer, and spiritual renewal. The Qur'an was first revealed in this sacred month.",verse:"The month of Ramadhan is that in which was revealed the Qur'an, a guidance for the people and clear proofs of guidance and criterion.",verseRef:"Qur'an 2:185"},
  "9-27":{icon:"✨",desc:"Laylat al-Qadr, the Night of Power, falls in the last ten odd nights of Ramadan. Worship on this night is better than a thousand months.",verse:"The Night of Decree is better than a thousand months. The angels and the Spirit descend therein by permission of their Lord.",verseRef:"Qur'an 97:3–4"},
  "10-1":{icon:"🎉",desc:"Eid al-Fitr marks the joyful end of Ramadan. Muslims celebrate with special prayers, feasting, family gatherings, and the giving of Zakat al-Fitr.",verse:"And complete the period and glorify Allah for that to which He has guided you; perhaps you will be grateful.",verseRef:"Qur'an 2:185"},
  "12-10":{icon:"🐑",desc:"Eid al-Adha commemorates Ibrahim's (AS) willingness to sacrifice his son in obedience to Allah. Muslims offer sacrifice and distribute the meat among family and the poor.",verse:"Their meat will not reach Allah, nor will their blood, but what reaches Him is piety from you.",verseRef:"Qur'an 22:37"},
};

// ── Moon phase ───────────────────────────────────────────────────────────────
function getMoonPhase() {
  const knownNew = new Date("2024-01-11T11:57:00Z").getTime();
  const cycle    = 29.53058867 * 86400000;
  const age      = (((Date.now()-knownNew)%cycle)+cycle)%cycle/86400000;
  const phases   = [
    {max:1.85,name:"New Moon",emoji:"🌑"},{max:7.38,name:"Waxing Crescent",emoji:"🌒"},
    {max:9.22,name:"First Quarter",emoji:"🌓"},{max:14.77,name:"Waxing Gibbous",emoji:"🌔"},
    {max:16.61,name:"Full Moon",emoji:"🌕"},{max:22.15,name:"Waning Gibbous",emoji:"🌖"},
    {max:23.99,name:"Last Quarter",emoji:"🌗"},{max:29.53,name:"Waning Crescent",emoji:"🌘"},
  ];
  return {...(phases.find(p=>age<p.max)||phases[7]),age:Math.round(age)};
}

const WDAY_MAP   = {Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};
const WDAY_S     = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const G_MON_S    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const G_DAY_S    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Shine overlay (renders a golden shimmer sweep) ───────────────────────────
function ShineLayer({ delay = "0s" }) {
  return (
    <div style={{
      position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
      background:"linear-gradient(90deg,transparent,rgba(201,168,76,0.06),transparent)",
      animation:`cardShine 8s ${delay} ease-in-out infinite`,
      pointerEvents:"none", zIndex:1,
    }}/>
  );
}


// ── Website-view helpers (stroke icons + moon disc) ──────────────────────────
const DK_MOON  = "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z";
const DK_CAL   = "M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5ZM4 10h16M8.5 3.5v4M15.5 3.5v4";
const DK_PREV  = "m15 6-6 6 6 6";
const DK_NEXT  = "m9 6 6 6-6 6";
function DkIco({ d, size = 20, sw = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
// Lit portion of the moon for a given age in days (display only)
function MoonDisc({ age, size = 56 }) {
  const f = Math.min(Math.max(age / 29.53058867, 0), 1);
  const r = 26, c = 30;
  const k = Math.cos(2 * Math.PI * f);
  const rx = Math.abs(k) * r;
  const waxing = f < 0.5;
  const sweep = waxing ? (k > 0 ? 0 : 1) : (k < 0 ? 0 : 1);
  const lit = waxing
    ? `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}A${rx} ${r} 0 0 ${sweep} ${c} ${c - r}Z`
    : `M${c} ${c - r}A${r} ${r} 0 0 0 ${c} ${c + r}A${rx} ${r} 0 0 ${sweep} ${c} ${c - r}Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true" style={{ flex:"none" }}>
      <circle cx={c} cy={c} r={r} fill="var(--lineSoft)"/>
      <path d={lit} fill="var(--gold)" opacity=".92"/>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IslamicCalendarPage({ onBack = ()=>{}, onOpenSidebar = ()=>{}, lightMode = false, textSize = 1 }) {
  const [hijriToday, setHijriToday] = useState(null);
  const [gregToday]                 = useState(() => new Date());
  const [viewMonth,  setViewMonth]  = useState(null);
  const [viewCal,    setViewCal]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [calLoading, setCalLoading] = useState(false);
  const [sheet,      setSheet]      = useState(null);
  const [showAll,    setShowAll]    = useState(false);
  const [moon]                      = useState(getMoonPhase);
  const docked                      = useMedia(DOCK_QUERY);
  const ts = textSize;
  const lm = lightMode;

  // ── Colour tokens ────────────────────────────────────────────────────────
  const gold      = "var(--gold)";
  const goldDim   = "var(--goldDim)";
  const goldBdr   = "var(--line)";
  const goldFaint = "var(--chip)";
  const goldHl    = "var(--active)";
  const text      = "var(--text)";
  const textMid   = "var(--dim)";
  const textDim   = "var(--faint)";
  const bg        = "var(--bgSolid)";
  const cardBg    = "var(--panel)";
  const headerBg  = "var(--head)";
  const heroBg    = "linear-gradient(145deg,#10265F,#0B4A47)";
  const shadow    = "none";
  const progBg    = "var(--lineSoft)";
  const divider   = "var(--lineSoft)";
  const sheetBg   = "var(--pop)";
  const cellBg    = "var(--panel)";
  const cellBdr   = "var(--lineSoft)";

  const card = (ex={}) => ({
    background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"16px",
    padding:"16px", marginBottom:"10px", boxShadow:shadow,
    position:"relative", overflow:"hidden", isolation:"isolate",
    ...ex,
  });
  const sLabel = {
    color:goldDim, fontSize:`${9*ts}px`, fontWeight:700,
    letterSpacing:"1.6px", textTransform:"uppercase", marginBottom:"11px",
  };
  const navBtn = {
    width:"32px", height:"32px", borderRadius:"50%",
    background:goldFaint, border:`1px solid ${goldBdr}`, color:gold,
    cursor:"pointer", fontSize:"calc(18px * var(--ts, 1))", display:"flex",
    alignItems:"center", justifyContent:"center", outline:"none", flexShrink:0,
  };

  // ── Fetch today's Hijri date ─────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      try{
        const now=new Date();
        const dd=String(now.getDate()).padStart(2,"0");
        const mm=String(now.getMonth()+1).padStart(2,"0");
        const r=await fetch(`https://api.aladhan.com/v1/gToH?date=${dd}-${mm}-${now.getFullYear()}`);
        const d=await r.json();
        const h=d.data.hijri;
        const ht={day:+h.day,month:h.month.number,year:+h.year,monthEn:h.month.en};
        setHijriToday(ht);
        setViewMonth({month:ht.month,year:ht.year,monthEn:ht.monthEn});
      }catch(e){console.warn(e);}
      finally{setLoading(false);}
    })();
  },[]);

  // ── Fetch calendar for viewed Hijri month ────────────────────────────────
  useEffect(()=>{
    if(!viewMonth)return;
    (async()=>{
      setCalLoading(true); setViewCal(null);
      try{
        const r=await fetch(`https://api.aladhan.com/v1/hToGCalendar/${viewMonth.month}/${viewMonth.year}`);
        const d=await r.json();
        if(d.code===200){
          setViewCal(d.data.map(e=>({
            hDay:+e.hijri.day, hMonth:e.hijri.month.number, hYear:+e.hijri.year,
            gDay:+e.gregorian.day,
            gMonth:e.gregorian.month?.number||parseInt(e.gregorian.date?.split("-")[1])||1,
            gYear:+e.gregorian.year,
            wday:WDAY_MAP[e.gregorian.weekday?.en]??0,
          })));
        }
      }catch(e){console.warn(e);}
      finally{setCalLoading(false);}
    })();
  },[viewMonth?.month,viewMonth?.year]);

  // ── Derived values ───────────────────────────────────────────────────────
  const upcoming = hijriToday
    ? Object.entries(ISLAMIC_EVENTS).map(([k,name])=>{
        const [m,d]=k.split("-").map(Number);
        let away=(m-hijriToday.month)*30+(d-hijriToday.day);
        if(away<0)away+=354;
        const yr=hijriToday.year+(m<hijriToday.month?1:0);
        return{key:k,name,away,hDateStr:`${d} ${HIJRI_MONTHS[m-1]} ${yr} AH`,hShort:`${d} ${HIJRI_MONTHS[m-1]}`};
      }).sort((a,b)=>a.away-b.away).slice(0,5)
    : [];
  const nextEvent    = upcoming[0];
  const isCurrMonth  = viewMonth&&hijriToday&&viewMonth.month===hijriToday.month&&viewMonth.year===hijriToday.year;
  const totalDays    = viewCal?.length||29;
  const doneDays     = isCurrMonth?(hijriToday?.day||0):totalDays;
  const remDays      = Math.max(0,totalDays-doneDays);
  const progress     = totalDays>0?(doneDays/totalDays)*100:0;
  const evtCount     = viewMonth?Object.keys(ISLAMIC_EVENTS).filter(k=>k.startsWith(`${viewMonth.month}-`)).length:0;
  const firstDow     = viewCal?.[0]?.wday??0;
  const gregMonths   = viewCal?[...new Set(viewCal.map(c=>G_MON_S[c.gMonth-1]))].join("–"):"";
  const gregYears    = viewCal?[...new Set(viewCal.map(c=>c.gYear))].join("/"):"";
  const gregLabel    = gregMonths?`${gregMonths} ${gregYears}`:"";

  const navMonth = (dir)=>{
    if(!viewMonth)return;
    let m=viewMonth.month+dir,y=viewMonth.year;
    if(m<1){m=12;y--;}else if(m>12){m=1;y++;}
    setViewMonth({month:m,year:y,monthEn:HIJRI_MONTHS[m-1]});
  };
  const goToToday = ()=>{
    if(hijriToday)setViewMonth({month:hijriToday.month,year:hijriToday.year,monthEn:hijriToday.monthEn});
  };

  // ── Website view body (matches the approved desktop design) ─────────────────
  const dkLbl  = { fontSize:"calc(10.5px * var(--ts, 1))", fontWeight:600, letterSpacing:"1.6px", color:"var(--faint)", textTransform:"uppercase" };
  const dkSel  = sheet || (nextEvent ? nextEvent : null);
  const dkMonthEvents = viewMonth
    ? Object.entries(ISLAMIC_EVENTS).filter(([k])=>k.startsWith(`${viewMonth.month}-`)).map(([k,name])=>{
        const d=+k.split("-")[1];
        return { key:k, name, day:d, away:-1, hDateStr:`${d} ${HIJRI_MONTHS[viewMonth.month-1]} ${viewMonth.year} AH`, hShort:`${d} ${HIJRI_MONTHS[viewMonth.month-1]}` };
      })
    : [];
  const dkUpcoming = showAll ? upcoming : upcoming.slice(0,3);

  const dockedBody = (
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 380px",gap:"20px",alignItems:"start"}}>

      {/* ── Left column ── */}
      <div style={{display:"flex",flexDirection:"column",gap:"22px",minWidth:0}}>
        <section className="card" style={{padding:"24px 26px 22px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",marginBottom:"18px"}}>
            <button onClick={()=>navMonth(-1)} aria-label="Previous month" style={{width:"40px",height:"40px",borderRadius:"50%",border:`1px solid ${goldBdr}`,background:goldFaint,color:gold,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><DkIco d={DK_PREV} size={20} sw={2}/></button>
            <div style={{textAlign:"center"}}>
              <div className="h2" style={{fontSize:"calc(28px * var(--ts, 1))",lineHeight:1.1}}>{viewMonth ? `${viewMonth.monthEn} ${viewMonth.year} AH` : "—"}</div>
              {gregLabel&&<div style={{marginTop:"3px",fontSize:"calc(12.5px * var(--ts, 1))",fontWeight:600,color:textDim}}>{gregLabel}</div>}
            </div>
            <button onClick={()=>navMonth(+1)} aria-label="Next month" style={{width:"40px",height:"40px",borderRadius:"50%",border:`1px solid ${goldBdr}`,background:goldFaint,color:gold,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><DkIco d={DK_NEXT} size={20} sw={2}/></button>
          </div>

          {calLoading ? (
            <div style={{textAlign:"center",color:goldDim,padding:"60px 0",fontSize:"calc(13px * var(--ts, 1))"}}>Loading calendar…</div>
          ) : viewCal ? (
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:"6px",marginBottom:"6px"}}>
                {WDAY_S.map((d,i)=>(<div key={d} style={{textAlign:"center",fontSize:"calc(10.5px * var(--ts, 1))",fontWeight:700,letterSpacing:"1.4px",color:i===5?gold:textDim}}>{d}</div>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:"6px"}}>
                {Array(firstDow).fill(null).map((_,i)=><div key={`g${i}`}/>)}
                {viewCal.map((cell,idx)=>{
                  const isToday=isCurrMonth&&hijriToday&&cell.hDay===hijriToday.day;
                  const evKey=`${cell.hMonth}-${cell.hDay}`;
                  const hasEvt=ISLAMIC_EVENTS[evKey];
                  const isFri=(firstDow+idx)%7===5;
                  const Cell=hasEvt?"button":"div";
                  return (
                    <Cell key={idx}
                      {...(hasEvt?{onClick:()=>setSheet({key:evKey,name:hasEvt,away:-1,hDateStr:`${cell.hDay} ${HIJRI_MONTHS[cell.hMonth-1]} ${cell.hYear} AH`,hShort:`${cell.hDay} ${HIJRI_MONTHS[cell.hMonth-1]}`}),"aria-label":`${hasEvt}, ${cell.hDay} ${HIJRI_MONTHS[cell.hMonth-1]}`}:{})}
                      style={{position:"relative",height:"clamp(70px, 5.4vw, 96px)",padding:"8px 9px",borderRadius:"11px",
                        border:isToday?`1px solid ${gold}`:hasEvt?`1px solid ${goldBdr}`:`1px solid ${cellBdr}`,
                        background:isToday?"var(--goldFill)":hasEvt?goldHl:cellBg,
                        color:text,fontFamily:"inherit",textAlign:"left",cursor:hasEvt?"pointer":"default"}}>
                      <span style={{display:"block",fontFamily:"var(--font-head)",fontSize:"calc(21px * var(--ts, 1))",fontWeight:700,lineHeight:1,color:isToday?"var(--onGold)":isFri?gold:text}}>{cell.hDay}</span>
                      <span style={{position:"absolute",right:"9px",top:"9px",fontSize:"calc(10.5px * var(--ts, 1))",fontWeight:600,color:isToday?"var(--onGold)":textDim}}>{cell.gDay}</span>
                      {hasEvt&&(<span style={{position:"absolute",left:"9px",bottom:"8px",display:"flex",alignItems:"center",gap:"5px",fontSize:"calc(10px * var(--ts, 1))",fontWeight:700,color:isToday?"var(--onGold)":gold}}><span style={{width:"7px",height:"7px",borderRadius:"50%",background:isToday?"var(--onGold)":gold}}/>Event</span>)}
                    </Cell>
                  );
                })}
              </div>
            </>
          ) : null}

          <div style={{marginTop:"16px",paddingTop:"14px",borderTop:`1px solid ${divider}`,display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={dkLbl}>This month contains</span>
            {dkMonthEvents.length>0 ? dkMonthEvents.map(e=>(
              <button key={e.key} className="cb" onClick={()=>setSheet(e)} style={{height:"30px",padding:"0 12px",borderRadius:"10px",border:`1px solid ${goldBdr}`,background:goldFaint,color:gold,fontFamily:"inherit",fontSize:"calc(12px * var(--ts, 1))",fontWeight:700,cursor:"pointer"}}>{e.name} · {e.day}</button>
            )) : (<span style={{fontSize:"calc(12.5px * var(--ts, 1))",fontWeight:600,color:textDim}}>No major events this month</span>)}
          </div>
        </section>

        {/* Coming up: the next four dates as cards */}
        {upcoming.length>0&&(
          <>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:"-8px"}}>
              <span style={dkLbl}>Coming up</span>
              <span style={{fontSize:"calc(11.5px * var(--ts, 1))",color:"var(--faint)"}}>Dates can shift by a day with moon sighting</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:"16px"}}>
              {upcoming.slice(0,4).map(ev=>(
                <button key={ev.key} className="pc card" onClick={()=>setSheet(ev)} style={{display:"flex",flexDirection:"column",gap:"8px",padding:"18px 20px",textAlign:"left",color:text,fontFamily:"inherit",cursor:"pointer"}}>
                  <span style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px"}}>
                    <span style={dkLbl}>{ev.hShort}</span>
                    <span style={{fontSize:"calc(11px * var(--ts, 1))",fontWeight:700,letterSpacing:".6px",color:gold}}>{ev.away===0?"Today!":`in ${ev.away} days`}</span>
                  </span>
                  <span className="h2" style={{fontSize:"calc(19px * var(--ts, 1))",lineHeight:1.2,color:text}}>{ev.name}</span>
                  {EVENT_INFO[ev.key]?.desc&&<span style={{fontSize:"calc(12.5px * var(--ts, 1))",lineHeight:1.6,fontWeight:500,color:textDim,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{EVENT_INFO[ev.key].desc}</span>}
                  <span style={{marginTop:"auto",fontSize:"calc(11.5px * var(--ts, 1))",fontWeight:600,color:"var(--faint)"}}>{ev.hDateStr}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Right column ── */}
      <div style={{display:"flex",flexDirection:"column",gap:"16px",minWidth:0}}>
        {dkSel&&(
          <section className="card" aria-live="polite" style={{padding:"24px 26px 22px",background:"linear-gradient(160deg,var(--active),var(--panel))"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                <span style={{width:"50px",height:"50px",borderRadius:"11px",border:`1px solid ${goldBdr}`,background:goldFaint,display:"flex",alignItems:"center",justifyContent:"center",color:gold}}><DkIco d={DK_MOON} size={26}/></span>
                <div>
                  <div className="h2" style={{fontSize:"calc(26px * var(--ts, 1))",lineHeight:1.1,color:text}}>{dkSel.name}</div>
                  <div style={{marginTop:"2px",fontSize:"calc(12.5px * var(--ts, 1))",fontWeight:600,color:textDim}}>{dkSel.hDateStr}</div>
                </div>
              </div>
              {dkSel.away>=0&&(<span style={{fontSize:"calc(11.5px * var(--ts, 1))",fontWeight:700,letterSpacing:".6px",padding:"5px 12px",borderRadius:"9px",color:"var(--onGold)",background:"var(--goldFill)"}}>{dkSel.away===0?"Today!":`In ${dkSel.away} days`}</span>)}
            </div>
            {EVENT_INFO[dkSel.key]?.desc&&<p style={{margin:"16px 0 0",fontSize:"calc(14px * var(--ts, 1))",lineHeight:1.8,fontWeight:500,color:textMid}}>{EVENT_INFO[dkSel.key].desc}</p>}
            {EVENT_INFO[dkSel.key]?.verse&&(
              <div style={{marginTop:"16px",padding:"16px 18px",borderRadius:"13px",border:`1px solid ${goldBdr}`,background:goldFaint}}>
                <div style={{fontSize:"calc(14px * var(--ts, 1))",lineHeight:1.75,fontWeight:600,fontStyle:"italic",color:text}}>“{EVENT_INFO[dkSel.key].verse}”</div>
                <div style={{marginTop:"6px",fontSize:"calc(12px * var(--ts, 1))",fontWeight:700,color:gold}}>— {EVENT_INFO[dkSel.key].verseRef}</div>
              </div>
            )}
          </section>
        )}
        {nextEvent&&(
          <section className="card" style={{padding:"20px 22px",background:"var(--panel2)"}}>
            <div style={dkLbl}>Next important date</div>
            <div style={{marginTop:"10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
              <div>
                <div className="h2" style={{fontSize:"calc(21px * var(--ts, 1))",lineHeight:1.15,color:text}}>{nextEvent.name}</div>
                <div style={{marginTop:"3px",fontSize:"calc(12.5px * var(--ts, 1))",fontWeight:600,color:textDim}}>{nextEvent.hDateStr}</div>
              </div>
              <div style={{textAlign:"center",flex:"none",padding:"8px 14px",borderRadius:"11px",border:`1px solid ${goldBdr}`,background:goldFaint}}>
                <div style={{fontSize:"calc(24px * var(--ts, 1))",fontWeight:600,lineHeight:1,color:gold,fontVariantNumeric:"tabular-nums"}}>{nextEvent.away}</div>
                <div style={{marginTop:"3px",fontSize:"calc(9.5px * var(--ts, 1))",fontWeight:700,letterSpacing:"1px",color:textDim}}>DAYS LEFT</div>
              </div>
            </div>
          </section>
        )}

        <section className="card" style={{display:"flex",alignItems:"center",gap:"16px",padding:"16px 20px"}}>
          <MoonDisc age={moon.age}/>
          <div>
            <div style={dkLbl}>Moon phase</div>
            <div className="h2" style={{marginTop:"3px",fontSize:"calc(19px * var(--ts, 1))",color:text}}>{moon.name}</div>
            <div style={{fontSize:"calc(12px * var(--ts, 1))",fontWeight:600,color:textDim}}>{moon.age} days old</div>
          </div>
        </section>

      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",position:"relative"}}>
      <style>{`@keyframes cardShine{0%{left:-100%}60%,100%{left:200%}}`}</style>

      {/* HEADER */}
      <div className="nur-ph" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 15px",borderBottom:`1px solid ${goldBdr}`,background:headerBg,backdropFilter:"blur(16px)",flexShrink:0,zIndex:20,position:"relative"}}>
        {/* Hamburger — opens sidebar */}
        <button className="nur-ph-menu" onClick={onOpenSidebar} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",display:"flex",flexDirection:"column",gap:"4px",flexShrink:0,position:"relative",zIndex:1}}>
          <div style={{width:"18px",height:"2px",background:gold,borderRadius:"2px"}}/>
          <div style={{width:"13px",height:"2px",background:gold,borderRadius:"2px"}}/>
          <div style={{width:"18px",height:"2px",background:gold,borderRadius:"2px"}}/>
        </button>
        <span className="nur-ph-title" style={{position:"absolute",left:"50%",transform:"translateX(-50%)",color:gold,fontSize:`${16*ts}px`,fontWeight:700,letterSpacing:"0.3px",whiteSpace:"nowrap"}}>{docked ? (<><div>Islamic Calendar</div>{hijriToday&&<div>Today · {hijriToday.day} {hijriToday.monthEn} {hijriToday.year} AH · {gregToday.toLocaleDateString("en-US",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>}</>) : "Islamic Calendar"}</span>
        <button className="nur-ph-back" onClick={onBack} style={{background:"none",border:"none",color:gold,fontSize:"calc(20px * var(--ts, 1))",cursor:"pointer",padding:"4px 6px",lineHeight:1,position:"relative",zIndex:1}}>←</button>
        {docked&&<button onClick={goToToday} style={{display:"flex",alignItems:"center",gap:"8px",height:"40px",padding:"0 16px",borderRadius:"12px",border:`1px solid ${goldBdr}`,background:goldFaint,color:gold,fontFamily:"inherit",fontSize:"calc(13px * var(--ts, 1))",fontWeight:700,cursor:"pointer",flexShrink:0}}><DkIco d={DK_CAL} size={16}/>Jump to today</button>}
      </div>

      {/* SCROLL */}
      <div style={{flex:1,overflowY:"auto",padding:docked?"10px 40px 52px":"12px 13px 48px"}}>
      {docked ? dockedBody : (<>

        {/* ═══ HERO CARD ═══ */}
        <div style={{background:heroBg,borderRadius:"20px",padding:"20px",marginBottom:"10px",border:"1px solid rgba(201,168,76,0.22)",boxShadow:"0 6px 30px rgba(0,0,0,0.45)",position:"relative",overflow:"hidden",isolation:"isolate"}}>
          <ShineLayer delay="0s"/>
          <div style={{position:"absolute",top:"-30%",right:"-15%",width:"65%",paddingBottom:"65%",borderRadius:"50%",background:"radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>
          <div style={{display:"flex",alignItems:"flex-start",gap:"10px",position:"relative",zIndex:2}}>
            <div style={{flex:1}}>
              <div style={{display:"inline-flex",alignItems:"center",background:"rgba(201,168,76,0.18)",border:"1px solid rgba(201,168,76,0.32)",borderRadius:"20px",padding:"3px 12px",marginBottom:"13px"}}>
                <span style={{color:"#E4C173",fontSize:`${10*ts}px`,fontWeight:700,letterSpacing:"0.5px"}}>Today</span>
              </div>
              {loading?(
                <div style={{color:"rgba(228,193,115,0.72)",fontSize:`${13*ts}px`,paddingBottom:"8px"}}>Loading…</div>
              ):hijriToday?(
                <>
                  <div style={{color:"#f0d78c",fontSize:`${25*ts}px`,fontWeight:900,lineHeight:1.15,marginBottom:"7px"}}>{hijriToday.day} {hijriToday.monthEn} {hijriToday.year} AH</div>
                  <div style={{color:"rgba(240,215,140,0.6)",fontSize:`${12*ts}px`,marginBottom:"2px"}}>{G_DAY_S[gregToday.getDay()]}, {gregToday.getDate()} {G_MON_S[gregToday.getMonth()]} {gregToday.getFullYear()}</div>
                  <div style={{color:"rgba(240,215,140,0.62)",fontSize:`${11*ts}px`}}>{gregToday.toLocaleDateString("en-US",{weekday:"long"})}</div>
                </>
              ):(
                <div style={{color:"var(--warn)",fontSize:`${13*ts}px`}}>Unable to load date</div>
              )}
              {nextEvent&&(
                <div style={{marginTop:"15px",paddingTop:"14px",borderTop:"1px solid rgba(201,168,76,0.18)"}}>
                  <div style={{color:"rgba(228,193,115,0.72)",fontSize:`${9*ts}px`,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>Next Event</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{color:"#E4C173",fontSize:`${15*ts}px`,fontWeight:800}}>{nextEvent.name}</div>
                      <div style={{color:"rgba(228,193,115,0.72)",fontSize:`${11*ts}px`,marginTop:"2px"}}>{nextEvent.away===0?"Today!":`${nextEvent.away} days remaining`}</div>
                    </div>
                    <div style={{width:"34px",height:"34px",borderRadius:"10px",background:"rgba(201,168,76,0.14)",border:"1px solid rgba(201,168,76,0.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(16px * var(--ts, 1))"}}>⏳</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{fontSize:"calc(58px * var(--ts, 1))",lineHeight:1,filter:"drop-shadow(0 0 18px rgba(201,168,76,0.55))",flexShrink:0,marginTop:"4px"}}>🌙</div>
          </div>
        </div>

        {/* ═══ MONTH NAVIGATOR ═══ */}
        {viewMonth&&(
          <div style={card()}>
            <ShineLayer delay="2s"/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",position:"relative",zIndex:2}}>
              <button style={navBtn} onClick={()=>navMonth(-1)}>‹</button>
              <span style={{color:text,fontSize:`${14*ts}px`,fontWeight:700}}>{viewMonth.monthEn} {viewMonth.year} AH</span>
              <button style={navBtn} onClick={()=>navMonth(+1)}>›</button>
            </div>
            <div style={{height:"5px",borderRadius:"3px",background:progBg,overflow:"hidden",marginBottom:"8px",position:"relative",zIndex:2}}>
              <div style={{width:`${progress}%`,height:"100%",borderRadius:"3px",background:`linear-gradient(90deg,${gold},rgba(201,168,76,0.45))`,transition:"width 0.5s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",position:"relative",zIndex:2}}>
              <span style={{color:textDim,fontSize:`${10*ts}px`}}>{doneDays} / {totalDays} days completed</span>
              <span style={{color:textDim,fontSize:`${10*ts}px`}}>{remDays} days remaining</span>
            </div>
          </div>
        )}

        {/* ═══ CALENDAR GRID ═══ */}
        <div style={{...card(),padding:"14px"}}>
          <ShineLayer delay="4s"/>
          {/* Month name bar inside calendar */}
          {viewMonth&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px",paddingBottom:"10px",borderBottom:`1px solid ${divider}`,position:"relative",zIndex:2}}>
              <span style={{color:gold,fontSize:`${12*ts}px`,fontWeight:700}}>{viewMonth.monthEn} {viewMonth.year} AH</span>
              {gregLabel&&<span style={{color:textDim,fontSize:`${10*ts}px`}}>{gregLabel}</span>}
            </div>
          )}
          {calLoading?(
            <div style={{textAlign:"center",color:goldDim,padding:"28px 0",fontSize:`${12*ts}px`}}>Loading calendar…</div>
          ):viewCal?(
            <div style={{position:"relative",zIndex:2}}>
              {/* Day headers */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:"6px"}}>
                {WDAY_S.map((d,i)=>(
                  <div key={d} style={{textAlign:"center",color:i===5?gold:goldDim,fontSize:`${10*ts}px`,fontWeight:700,padding:"4px 0"}}>{d}</div>
                ))}
              </div>
              {/* Date cells — each in its own box */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
                {Array(firstDow).fill(null).map((_,i)=><div key={`g${i}`}/>)}
                {viewCal.map((cell,idx)=>{
                  const isToday=isCurrMonth&&hijriToday&&cell.hDay===hijriToday.day;
                  const evKey=`${cell.hMonth}-${cell.hDay}`;
                  const hasEvt=ISLAMIC_EVENTS[evKey];
                  const dow=(firstDow+idx)%7;
                  const isFri=dow===5;
                  return (
                    <div key={idx} onClick={()=>hasEvt&&setSheet({key:evKey,name:hasEvt,away:-1,hDateStr:`${cell.hDay} ${HIJRI_MONTHS[cell.hMonth-1]} ${cell.hYear} AH`,hShort:`${cell.hDay} ${HIJRI_MONTHS[cell.hMonth-1]}`})}
                      style={{
                        aspectRatio:"1",borderRadius:"10px",position:"relative",
                        background:isToday?gold:hasEvt?goldHl:cellBg,
                        border:isToday?`2px solid ${gold}`:hasEvt?`1.5px solid ${goldBdr}`:`1px solid ${cellBdr}`,
                        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                        cursor:hasEvt?"pointer":"default",
                        boxShadow:isToday?`0 0 14px rgba(201,168,76,0.4)`:"none",
                      }}>
                      <span style={{color:isToday?"var(--onGold)":isFri?gold:text,fontSize:`${13*ts}px`,fontWeight:isToday||hasEvt?700:500,lineHeight:1}}>{cell.hDay}</span>
                      <span style={{color:isToday?"var(--onGold)":textDim,fontSize:`${9*ts}px`,lineHeight:1,marginTop:"2px"}}>{cell.gDay}</span>
                      {hasEvt&&!isToday&&<div style={{position:"absolute",top:"3px",right:"3px",width:"5px",height:"5px",borderRadius:"50%",background:gold}}/>}
                      {isToday&&<div style={{position:"absolute",bottom:"2px",color:"var(--onGold)",fontSize:`${7*ts}px`}}>★</div>}
                    </div>
                  );
                })}
              </div>
              {/* Go to Today */}
              <div style={{textAlign:"center",marginTop:"14px"}}>
                <button onClick={goToToday} style={{
                  background:!isCurrMonth?goldFaint:"transparent",
                  border:`1px solid ${!isCurrMonth?goldBdr:"rgba(255,255,255,0.08)"}`,
                  color:!isCurrMonth?gold:textDim,
                  borderRadius:"20px",padding:"7px 22px",fontSize:`${11*ts}px`,fontWeight:600,
                  cursor:!isCurrMonth?"pointer":"default",letterSpacing:"0.5px",outline:"none",
                  opacity:isCurrMonth?0.45:1,transition:"all 0.2s",
                }}>● Go to Today</button>
              </div>
            </div>
          ):null}
        </div>

        {/* ═══ NEXT IMPORTANT DATE ═══ */}
        {nextEvent&&(
          <div style={{...card(),display:"flex",alignItems:"center",gap:"14px"}}>
            <ShineLayer delay="1s"/>
            <div style={{width:"46px",height:"46px",borderRadius:"50%",background:goldFaint,border:`1px solid ${goldBdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(22px * var(--ts, 1))",flexShrink:0,position:"relative",zIndex:2}}>🎯</div>
            <div style={{flex:1,minWidth:0,position:"relative",zIndex:2}}>
              <div style={{...sLabel,marginBottom:"4px"}}>Next Important Date</div>
              <div style={{color:text,fontSize:`${14*ts}px`,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nextEvent.name}</div>
              <div style={{color:textDim,fontSize:`${11*ts}px`,marginTop:"2px"}}>{nextEvent.hDateStr}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,position:"relative",zIndex:2}}>
              <div style={{color:gold,fontSize:`${30*ts}px`,fontWeight:900,lineHeight:1}}>{nextEvent.away}</div>
              <div style={{color:textDim,fontSize:`${9*ts}px`,lineHeight:1.4}}>days<br/>remaining</div>
            </div>
          </div>
        )}

        {/* ═══ THIS MONTH CONTAINS ═══ */}
        <div style={card()}>
          <ShineLayer delay="3s"/>
          <div style={{...sLabel,position:"relative",zIndex:2}}>This Month Contains</div>
          <div style={{display:"flex",alignItems:"stretch",position:"relative",zIndex:2}}>
            {[{emoji:"📅",val:evtCount,lbl:"Events"},{emoji:"🌙",val:totalDays,lbl:"Days"},{emoji:"⏳",val:Math.max(0,remDays),lbl:"Days Remaining"}].map((s,i)=>(
              <div key={s.lbl} style={{flex:1,display:"flex"}}>
                {i>0&&<div style={{width:"1px",background:divider,margin:"0 6px",flexShrink:0}}/>}
                <div style={{flex:1,textAlign:"center",padding:"4px 0"}}>
                  <div style={{fontSize:"calc(20px * var(--ts, 1))",marginBottom:"7px"}}>{s.emoji}</div>
                  <div style={{color:text,fontSize:`${22*ts}px`,fontWeight:900,lineHeight:1}}>{s.val}</div>
                  <div style={{color:textDim,fontSize:`${10*ts}px`,marginTop:"5px",lineHeight:1.3}}>{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ UPCOMING EVENTS + MOON PHASE ═══ */}
        <div style={{display:"grid",gridTemplateColumns:"1.25fr 0.75fr",gap:"10px",marginBottom:"10px"}}>
          <div style={{background:cardBg,border:`1px solid ${goldBdr}`,borderRadius:"16px",padding:"14px",boxShadow:shadow,position:"relative",overflow:"hidden",isolation:"isolate"}}>
            <ShineLayer delay="5s"/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",position:"relative",zIndex:2}}>
              <span style={{...sLabel,marginBottom:0}}>Upcoming Events</span>
              <span onClick={()=>setShowAll(true)} style={{color:gold,fontSize:`${9*ts}px`,fontWeight:600,cursor:"pointer"}}>View all</span>
            </div>
            {upcoming.slice(0,2).map((ev,i)=>(
              <div key={ev.key} onClick={()=>setSheet(ev)} style={{cursor:"pointer",paddingBottom:i===0?"10px":"0",marginBottom:i===0?"10px":"0",borderBottom:i===0?`1px solid ${divider}`:"none",position:"relative",zIndex:2}}>
                <div style={{display:"flex",gap:"8px"}}>
                  <span style={{fontSize:"calc(13px * var(--ts, 1))",marginTop:"1px",flexShrink:0}}>🌙</span>
                  <div>
                    <div style={{color:text,fontSize:`${11*ts}px`,fontWeight:700,lineHeight:1.3}}>{ev.name}</div>
                    <div style={{color:textDim,fontSize:`${9*ts}px`,marginTop:"2px"}}>{ev.hShort}</div>
                    <div style={{marginTop:"5px",background:goldFaint,border:`1px solid ${goldBdr}`,borderRadius:"6px",padding:"2px 7px",display:"inline-flex"}}>
                      <span style={{color:gold,fontSize:`${9*ts}px`,fontWeight:700}}>{ev.away===0?"Today!":`${ev.away} days remaining`}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:cardBg,border:`1px solid ${goldBdr}`,borderRadius:"16px",padding:"14px",boxShadow:shadow,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",overflow:"hidden",isolation:"isolate"}}>
            <ShineLayer delay="2.5s"/>
            <div style={{...sLabel,alignSelf:"flex-start",marginBottom:"10px",position:"relative",zIndex:2}}>Moon Phase</div>
            <div style={{fontSize:"calc(48px * var(--ts, 1))",lineHeight:1,marginBottom:"8px",position:"relative",zIndex:2}}>{moon.emoji}</div>
            <div style={{color:text,fontSize:`${11*ts}px`,fontWeight:700,textAlign:"center",lineHeight:1.4,position:"relative",zIndex:2}}>{moon.name}</div>
            <div style={{color:textDim,fontSize:`${10*ts}px`,marginTop:"4px",position:"relative",zIndex:2}}>{moon.age} days old</div>
          </div>
        </div>

      </>)}
      </div>

      {/* ═══ VIEW ALL EVENTS SHEET ═══ */}
      {showAll&&!docked&&(
        <div onClick={()=>setShowAll(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",zIndex:50,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:sheetBg,borderRadius:"24px 24px 0 0",padding:"8px 18px 44px",maxHeight:"80%",overflowY:"auto",border:`1px solid ${goldBdr}`,position:"relative"}}>
            <div style={{width:"40px",height:"4px",borderRadius:"2px",background:divider,margin:"10px auto 0"}}/>
            <button onClick={()=>setShowAll(false)} style={{position:"absolute",top:"14px",right:"15px",background:goldFaint,border:`1px solid ${goldBdr}`,color:textDim,width:"28px",height:"28px",borderRadius:"50%",cursor:"pointer",fontSize:"calc(13px * var(--ts, 1))",display:"flex",alignItems:"center",justifyContent:"center",outline:"none"}}>✕</button>
            {/* Sheet header */}
            <div style={{padding:"18px 0 14px"}}>
              <div style={{color:goldDim,fontSize:`${9*ts}px`,fontWeight:700,letterSpacing:"1.6px",textTransform:"uppercase",marginBottom:"4px"}}>All Upcoming Events</div>
              <div style={{color:textDim,fontSize:`${10*ts}px`}}>Next {upcoming.length} Islamic occasions</div>
            </div>
            {/* Event list */}
            {upcoming.map((ev,i)=>(
              <div key={ev.key}
                onClick={()=>{ setShowAll(false); setSheet(ev); }}
                style={{
                  display:"flex",alignItems:"center",gap:"14px",
                  padding:"13px 0",
                  borderTop:`1px solid ${divider}`,
                  cursor:"pointer",
                }}>
                {/* Icon circle */}
                <div style={{width:"42px",height:"42px",borderRadius:"50%",background:goldFaint,border:`1px solid ${goldBdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(20px * var(--ts, 1))",flexShrink:0}}>
                  {EVENT_INFO[ev.key]?.icon||"🌙"}
                </div>
                {/* Text */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:text,fontSize:`${13*ts}px`,fontWeight:700,marginBottom:"3px"}}>{ev.name}</div>
                  <div style={{color:textDim,fontSize:`${10*ts}px`}}>{ev.hDateStr}</div>
                </div>
                {/* Countdown */}
                <div style={{textAlign:"right",flexShrink:0}}>
                  {ev.away===0?(
                    <div style={{background:goldFaint,border:`1px solid ${goldBdr}`,borderRadius:"12px",padding:"3px 10px"}}>
                      <span style={{color:gold,fontSize:`${10*ts}px`,fontWeight:700}}>Today!</span>
                    </div>
                  ):(
                    <>
                      <div style={{color:gold,fontSize:`${16*ts}px`,fontWeight:900,lineHeight:1}}>{ev.away}</div>
                      <div style={{color:textDim,fontSize:`${9*ts}px`,marginTop:"1px"}}>days</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ EVENT BOTTOM SHEET ═══ */}
      {sheet&&!docked&&(
        <div onClick={()=>setSheet(null)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",zIndex:50,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:sheetBg,borderRadius:"24px 24px 0 0",padding:"8px 18px 44px",maxHeight:"74%",overflowY:"auto",border:`1px solid ${goldBdr}`,position:"relative"}}>
            <div style={{width:"40px",height:"4px",borderRadius:"2px",background:divider,margin:"10px auto 18px"}}/>
            <button onClick={()=>setSheet(null)} style={{position:"absolute",top:"14px",right:"15px",background:goldFaint,border:`1px solid ${goldBdr}`,color:textDim,width:"28px",height:"28px",borderRadius:"50%",cursor:"pointer",fontSize:"calc(13px * var(--ts, 1))",display:"flex",alignItems:"center",justifyContent:"center",outline:"none"}}>✕</button>
            <div style={{width:"58px",height:"58px",borderRadius:"16px",background:`linear-gradient(135deg,${gold},rgba(201,168,76,0.45))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"calc(28px * var(--ts, 1))",marginBottom:"14px",border:`1px solid ${gold}`,boxShadow:`0 4px 18px rgba(201,168,76,0.28)`}}>{EVENT_INFO[sheet.key]?.icon||"☪️"}</div>
            <div style={{color:text,fontSize:`${20*ts}px`,fontWeight:800,marginBottom:"4px"}}>{sheet.name}</div>
            <div style={{color:textDim,fontSize:`${12*ts}px`,marginBottom:"12px"}}>{sheet.hDateStr}</div>
            {sheet.away>=0&&(
              <div style={{display:"inline-flex",background:goldFaint,border:`1px solid ${goldBdr}`,borderRadius:"20px",padding:"4px 14px",marginBottom:"16px"}}>
                <span style={{color:gold,fontSize:`${11*ts}px`,fontWeight:700}}>{sheet.away===0?"Today!":`${sheet.away} days remaining`}</span>
              </div>
            )}
            {EVENT_INFO[sheet.key]?.desc&&<div style={{color:textMid,fontSize:`${13*ts}px`,lineHeight:1.75,marginBottom:"16px"}}>{EVENT_INFO[sheet.key].desc}</div>}
            {EVENT_INFO[sheet.key]?.verse&&(
              <div style={{background:goldFaint,border:`1px solid ${goldBdr}`,borderRadius:"14px",padding:"16px",borderLeft:`3px solid ${gold}`,borderTopLeftRadius:"0",borderBottomLeftRadius:"0"}}>
                <div style={{color:gold,fontSize:"calc(24px * var(--ts, 1))",lineHeight:1,marginBottom:"6px",fontFamily:"var(--font-ar)"}}>"</div>
                <div style={{color:textMid,fontSize:`${12*ts}px`,lineHeight:1.8,fontStyle:"italic",marginBottom:"10px"}}>{EVENT_INFO[sheet.key].verse}</div>
                <div style={{color:gold,fontSize:`${11*ts}px`,fontWeight:700}}>— {EVENT_INFO[sheet.key].verseRef}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
