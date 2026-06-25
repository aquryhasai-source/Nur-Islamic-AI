import { useState, useEffect } from "react";

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

// ── Main component ────────────────────────────────────────────────────────────
export default function IslamicCalendarPage({ onBack = ()=>{}, lightMode = false, textSize = 1 }) {
  const [hijriToday, setHijriToday] = useState(null);
  const [gregToday]                 = useState(() => new Date());
  const [viewMonth,  setViewMonth]  = useState(null);
  const [viewCal,    setViewCal]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [calLoading, setCalLoading] = useState(false);
  const [sheet,      setSheet]      = useState(null);
  const [moon]                      = useState(getMoonPhase);
  const ts = textSize;
  const lm = lightMode;

  // ── Colour tokens ────────────────────────────────────────────────────────
  const gold      = lm ? "#7a5810"                  : "#c9a84c";
  const goldDim   = lm ? "rgba(122,88,16,0.58)"     : "rgba(201,168,76,0.55)";
  const goldBdr   = lm ? "rgba(122,88,16,0.18)"     : "rgba(201,168,76,0.2)";
  const goldFaint = lm ? "rgba(122,88,16,0.07)"     : "rgba(201,168,76,0.07)";
  const goldHl    = lm ? "rgba(122,88,16,0.13)"     : "rgba(201,168,76,0.14)";
  const text      = lm ? "rgba(20,12,0,0.9)"        : "rgba(255,251,235,0.9)";
  const textMid   = lm ? "rgba(20,12,0,0.62)"       : "rgba(255,251,235,0.62)";
  const textDim   = lm ? "rgba(20,12,0,0.38)"       : "rgba(255,255,255,0.35)";
  const bg        = lm ? "#fdf8ed"                  : "#07100a";
  const cardBg    = lm ? "#ffffff"                  : "#0c1a0f";
  const headerBg  = lm ? "rgba(253,248,237,0.97)"   : "rgba(7,16,10,0.97)";
  const heroBg    = lm ? "linear-gradient(145deg,#243f1c,#182d10)" : "linear-gradient(145deg,#0d1f0f,#060d07)";
  const shadow    = lm ? "0 2px 12px rgba(0,0,0,0.07)" : "0 2px 16px rgba(0,0,0,0.32)";
  const progBg    = lm ? "rgba(122,88,16,0.1)"      : "rgba(255,255,255,0.08)";
  const divider   = lm ? "rgba(122,88,16,0.12)"     : "rgba(201,168,76,0.12)";
  const sheetBg   = lm ? "#fdf8ed"                  : "#0c1a0f";
  const cellBg    = lm ? "rgba(122,88,16,0.03)"     : "rgba(255,255,255,0.028)";
  const cellBdr   = lm ? "rgba(122,88,16,0.1)"      : "rgba(201,168,76,0.1)";

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
    cursor:"pointer", fontSize:"18px", display:"flex",
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",position:"relative"}}>
      <style>{`@keyframes cardShine{0%{left:-100%}60%,100%{left:200%}}`}</style>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 15px",borderBottom:`1px solid ${goldBdr}`,background:headerBg,backdropFilter:"blur(16px)",flexShrink:0,zIndex:20}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:gold,fontSize:"20px",cursor:"pointer",padding:"4px 6px",lineHeight:1}}>←</button>
        <span style={{color:gold,fontSize:`${16*ts}px`,fontWeight:700,letterSpacing:"0.3px"}}>Islamic Calendar</span>
        <button style={{background:"none",border:"none",color:goldDim,fontSize:"17px",cursor:"pointer",padding:"4px 6px",lineHeight:1}}>⚙</button>
      </div>

      {/* SCROLL */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 13px 48px"}}>

        {/* ═══ HERO CARD ═══ */}
        <div style={{background:heroBg,borderRadius:"20px",padding:"20px",marginBottom:"10px",border:"1px solid rgba(201,168,76,0.22)",boxShadow:"0 6px 30px rgba(0,0,0,0.45)",position:"relative",overflow:"hidden",isolation:"isolate"}}>
          <ShineLayer delay="0s"/>
          <div style={{position:"absolute",top:"-30%",right:"-15%",width:"65%",paddingBottom:"65%",borderRadius:"50%",background:"radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>
          <div style={{display:"flex",alignItems:"flex-start",gap:"10px",position:"relative",zIndex:2}}>
            <div style={{flex:1}}>
              <div style={{display:"inline-flex",alignItems:"center",background:"rgba(201,168,76,0.18)",border:"1px solid rgba(201,168,76,0.32)",borderRadius:"20px",padding:"3px 12px",marginBottom:"13px"}}>
                <span style={{color:"#c9a84c",fontSize:`${10*ts}px`,fontWeight:700,letterSpacing:"0.5px"}}>Today</span>
              </div>
              {loading?(
                <div style={{color:"rgba(201,168,76,0.45)",fontSize:`${13*ts}px`,paddingBottom:"8px"}}>Loading…</div>
              ):hijriToday?(
                <>
                  <div style={{color:"#f0d78c",fontSize:`${25*ts}px`,fontWeight:900,lineHeight:1.15,marginBottom:"7px"}}>{hijriToday.day} {hijriToday.monthEn} {hijriToday.year} AH</div>
                  <div style={{color:"rgba(240,215,140,0.6)",fontSize:`${12*ts}px`,marginBottom:"2px"}}>{G_DAY_S[(gregToday.getDay()+6)%7]}, {gregToday.getDate()} {G_MON_S[gregToday.getMonth()]} {gregToday.getFullYear()}</div>
                  <div style={{color:"rgba(240,215,140,0.38)",fontSize:`${11*ts}px`}}>{gregToday.toLocaleDateString("en-US",{weekday:"long"})}</div>
                </>
              ):(
                <div style={{color:"#e07b54",fontSize:`${13*ts}px`}}>Unable to load date</div>
              )}
              {nextEvent&&(
                <div style={{marginTop:"15px",paddingTop:"14px",borderTop:"1px solid rgba(201,168,76,0.18)"}}>
                  <div style={{color:"rgba(201,168,76,0.45)",fontSize:`${9*ts}px`,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>Next Event</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{color:"#c9a84c",fontSize:`${15*ts}px`,fontWeight:800}}>{nextEvent.name}</div>
                      <div style={{color:"rgba(201,168,76,0.45)",fontSize:`${11*ts}px`,marginTop:"2px"}}>{nextEvent.away===0?"Today!":`${nextEvent.away} days remaining`}</div>
                    </div>
                    <div style={{width:"34px",height:"34px",borderRadius:"10px",background:"rgba(201,168,76,0.14)",border:"1px solid rgba(201,168,76,0.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px"}}>📅</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{fontSize:"58px",lineHeight:1,filter:"drop-shadow(0 0 18px rgba(201,168,76,0.55))",flexShrink:0,marginTop:"4px"}}>🌙</div>
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
                      <span style={{color:isToday?(lm?"#fff":"#07100a"):isFri?gold:text,fontSize:`${13*ts}px`,fontWeight:isToday||hasEvt?700:500,lineHeight:1}}>{cell.hDay}</span>
                      <span style={{color:isToday?(lm?"rgba(255,255,255,0.6)":"rgba(7,16,10,0.55)"):textDim,fontSize:`${9*ts}px`,lineHeight:1,marginTop:"2px"}}>{cell.gDay}</span>
                      {hasEvt&&!isToday&&<div style={{position:"absolute",top:"3px",right:"3px",width:"5px",height:"5px",borderRadius:"50%",background:gold}}/>}
                      {isToday&&<div style={{position:"absolute",bottom:"2px",color:lm?"rgba(255,255,255,0.75)":"rgba(7,16,10,0.65)",fontSize:`${7*ts}px`}}>★</div>}
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
            <div style={{width:"46px",height:"46px",borderRadius:"50%",background:goldFaint,border:`1px solid ${goldBdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px",flexShrink:0,position:"relative",zIndex:2}}>🎯</div>
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
                  <div style={{fontSize:"20px",marginBottom:"7px"}}>{s.emoji}</div>
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
              <span style={{color:gold,fontSize:`${9*ts}px`,fontWeight:600,cursor:"pointer"}}>View all</span>
            </div>
            {upcoming.slice(0,2).map((ev,i)=>(
              <div key={ev.key} onClick={()=>setSheet(ev)} style={{cursor:"pointer",paddingBottom:i===0?"10px":"0",marginBottom:i===0?"10px":"0",borderBottom:i===0?`1px solid ${divider}`:"none",position:"relative",zIndex:2}}>
                <div style={{display:"flex",gap:"8px"}}>
                  <span style={{fontSize:"13px",marginTop:"1px",flexShrink:0}}>🌙</span>
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
            <div style={{fontSize:"48px",lineHeight:1,marginBottom:"8px",position:"relative",zIndex:2}}>{moon.emoji}</div>
            <div style={{color:text,fontSize:`${11*ts}px`,fontWeight:700,textAlign:"center",lineHeight:1.4,position:"relative",zIndex:2}}>{moon.name}</div>
            <div style={{color:textDim,fontSize:`${10*ts}px`,marginTop:"4px",position:"relative",zIndex:2}}>{moon.age} days old</div>
          </div>
        </div>

      </div>

      {/* ═══ EVENT BOTTOM SHEET ═══ */}
      {sheet&&(
        <div onClick={()=>setSheet(null)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",zIndex:50,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:sheetBg,borderRadius:"24px 24px 0 0",padding:"8px 18px 44px",maxHeight:"74%",overflowY:"auto",border:`1px solid ${goldBdr}`,position:"relative"}}>
            <div style={{width:"40px",height:"4px",borderRadius:"2px",background:divider,margin:"10px auto 18px"}}/>
            <button onClick={()=>setSheet(null)} style={{position:"absolute",top:"14px",right:"15px",background:goldFaint,border:`1px solid ${goldBdr}`,color:textDim,width:"28px",height:"28px",borderRadius:"50%",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center",outline:"none"}}>✕</button>
            <div style={{width:"58px",height:"58px",borderRadius:"16px",background:`linear-gradient(135deg,${gold},rgba(201,168,76,0.45))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",marginBottom:"14px",border:`1px solid ${gold}`,boxShadow:`0 4px 18px rgba(201,168,76,0.28)`}}>{EVENT_INFO[sheet.key]?.icon||"☪️"}</div>
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
                <div style={{color:gold,fontSize:"24px",lineHeight:1,marginBottom:"6px",fontFamily:"Georgia,serif"}}>"</div>
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
