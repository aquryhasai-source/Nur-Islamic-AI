import { useState, useEffect, useRef } from "react";
import {
  PROXY_URL, deviceHeaders, DAILY_LIMIT, KEYS, getAgePrefix, getCachedRemaining, getLocalDate,
  setCachedRemaining, checkIfRamadan, getPrayerTimes,
  getPrayerTimesByCity, getCountdownTo, getLastLocation, saveLastLocation, getDevicePosition,
} from "./utils.js";
import CityBox from "./CityBox.jsx";
import { getCitationText } from "./citeText.js";
import { resolveCity } from "./cities.js";
import { SADAQAH_ENABLED } from "./sadaqah.js";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

const StarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--gold)"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
const SendIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>;
const UserIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>;

const SUGGESTIONS = [
  "What does the Quran say about patience?",
  "How should I perform Salah correctly?",
  "What are the pillars of Islam?",
  "What does Islam say about kindness to parents?",
  "Explain the concept of Tawakkul",
];

// ─── Ramadan Banner ───────────────────────────────────────────────────────────
function RamadanBanner({ prayerTimes, hijriDay, onRequestCity }) {
  const [info, setInfo] = useState({ label:"", time:"" });
  useEffect(() => {
    if (!prayerTimes) return;
    const tick = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [fH, fM] = prayerTimes.Fajr.split(":").map(Number);
      const [mH, mM] = prayerTimes.Maghrib.split(":").map(Number);
      const isFasting = nowMins >= fH*60+fM && nowMins < mH*60+mM;
      const c = getCountdownTo(isFasting ? prayerTimes.Maghrib : prayerTimes.Fajr);
      setInfo({ label: isFasting ? "Iftar in" : "Suhoor in", time:`${String(c.hours).padStart(2,"0")}:${String(c.mins).padStart(2,"0")}:${String(c.secs).padStart(2,"0")}` });
    };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [prayerTimes]);

  return (
    <div style={{ background:"linear-gradient(135deg,color-mix(in srgb,var(--gold) 12%,transparent),color-mix(in srgb,var(--gold) 4%,transparent))", borderBottom:"1px solid color-mix(in srgb,var(--gold) 20%,transparent)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ fontSize:"calc(18px * var(--ts, 1))" }}>☽</span>
        <div>
          <div style={{ color:"var(--gold)", fontSize:"calc(12px * var(--ts, 1))", fontWeight:700 }}>Ramadan Mubarak · Day {hijriDay}</div>
          {prayerTimes
            ? <div style={{ color:"color-mix(in srgb,var(--gold) 65%,transparent)", fontSize:"calc(12px * var(--ts, 1))", marginTop:"2px" }}>{info.label} <strong style={{ color:"var(--gold)", fontVariantNumeric:"tabular-nums" }}>{info.time}</strong></div>
            : <button onClick={onRequestCity} style={{ background:"none", border:"none", color:"color-mix(in srgb,var(--gold) 55%,transparent)", fontSize:"calc(11px * var(--ts, 1))", cursor:"pointer", textDecoration:"underline", padding:0, fontFamily:"Nunito,sans-serif" }}>Add city for Iftar times</button>}
        </div>
      </div>
      {prayerTimes && <div style={{ color:"color-mix(in srgb,var(--gold) 35%,transparent)", fontSize:"calc(10px * var(--ts, 1))", textAlign:"right", lineHeight:1.8 }}>Suhoor: {prayerTimes.Fajr}<br/>Iftar: {prayerTimes.Maghrib}</div>}
    </div>
  );
}

function CityModal({ onSubmit, onClose }) {
  const [city, setCity] = useState("");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async (p) => {
    setBusy(true); setErr("");
    try {
      const t = await getPrayerTimes(p.lat, p.lon);
      localStorage.setItem(KEYS.CITY, p.country ? `${p.name}, ${p.country}` : p.name);
      saveLastLocation({ lat: p.lat, lon: p.lon, name: p.label, manual: true });
      onSubmit(t);
    } catch { setErr("Could not load times. Check your connection and try again."); }
    finally { setBusy(false); }
  };
  const submit = async (text = city) => {
    if (!text.trim()) return;
    setBusy(true); setErr("");
    const p = await resolveCity(text);
    if (!p) { setBusy(false); setErr("No city matches that. Pick one from the suggestions, or try a nearby larger city."); return; }
    await pick(p);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"var(--pop)", border:"1px solid color-mix(in srgb,var(--gold) 25%,transparent)", borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"340px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <span style={{ color:"var(--gold)", fontSize:"calc(16px * var(--ts, 1))", fontWeight:700 }}>Your City</span>
          <button onClick={onClose} aria-label="Close" style={{ background:"none", border:"none", color:"color-mix(in srgb,var(--gold) 40%,transparent)", fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer" }}>✕</button>
        </div>
        <CityBox value={city} onChange={setCity} onPick={pick} onSubmit={submit} autoFocus
          placeholder="Search a city, e.g. Istanbul, Karachi"
          wrapStyle={{ flex:"none", marginBottom:"12px" }}
          inputStyle={{ width:"100%", background:"color-mix(in srgb,var(--text) 5%,transparent)", border:"1px solid color-mix(in srgb,var(--gold) 25%,transparent)", borderRadius:"10px", padding:"12px 14px", color:"var(--text)", fontSize:"calc(15px * var(--ts, 1))", outline:"none", fontFamily:"Nunito,sans-serif", boxSizing:"border-box" }}/>
        {err && <div style={{ color:"var(--warn)", fontSize:"calc(13px * var(--ts, 1))", marginBottom:"10px" }}>{err}</div>}
        <button onClick={() => submit()} disabled={!city.trim() || busy}
          style={{ width:"100%", padding:"12px", borderRadius:"10px", background:city.trim()?"var(--goldFill)":"color-mix(in srgb,var(--gold) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--gold) 30%,transparent)", color:city.trim()?"var(--onGold)":"color-mix(in srgb,var(--gold) 30%,transparent)", fontSize:"calc(14px * var(--ts, 1))", fontWeight:700, cursor:city.trim()?"pointer":"not-allowed", fontFamily:"Nunito,sans-serif" }}>
          {busy ? "Finding times…" : "Get Prayer Times"}
        </button>
      </div>
    </div>
  );
}

function LockedBanner({ navigateTo, lightMode, textSize = 1 }) {
  const gold = "var(--gold)";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 28px", textAlign:"center", flex:1 }}>
      <div style={{ fontSize:"calc(28px * var(--ts, 1))", color:gold, fontFamily:"var(--font-ar)", marginBottom:"8px" }}>طَلَبُ الْعِلْمِ فَرِيضَةٌ</div>
      <div style={{ color:"var(--line)", fontSize:"calc(11px * var(--ts, 1))", letterSpacing:"1.5px", marginBottom:"24px" }}>"Seeking knowledge is an obligation" — Ibn Mājah</div>
      <div style={{ color:"var(--dim)", fontSize:`${14 * textSize}px`, lineHeight:1.8, marginBottom:"28px" }}>
        You've used all your free reflections today.
      </div>
      <button onClick={() => navigateTo("getpro")}
        style={{ padding:"15px 40px", borderRadius:"50px", background:"var(--goldFill)", border:"none", color:"var(--onGold)", fontSize:`${16 * textSize}px`, fontWeight:800, cursor:"pointer", fontFamily:"Nunito,sans-serif", boxShadow:`0 6px 28px ${"var(--line)"}` }}>
        🌙 Get Pro
      </button>
      <div style={{ color:"var(--dim)", fontSize:"calc(12px * var(--ts, 1))", marginTop:"12px" }}>or wait — resets at midnight</div>
      {SADAQAH_ENABLED && (
        <button onClick={() => navigateTo("support")}
          style={{ marginTop:"22px", background:"none", border:"none", cursor:"pointer", color:gold, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif", textDecoration:"underline", opacity:0.85 }}>
          💛 Or give sadaqah to keep NŪR free for everyone
        </button>
      )}
    </div>
  );
}

// Citation chips inside an answer (look only — click handlers are unchanged)
const CITE_STYLE = { display:"inline-block", margin:"1px 2px", padding:"1px 9px", borderRadius:"8px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontWeight:700, fontSize:"0.88em", cursor:"pointer", lineHeight:1.5 };

const QURAN_CITATION  = /\[[^\]]*?(\d{1,3}):(\d{1,3})[^\]]*\]/g;
const HADITH_CITATION = /\[((?:Sahih\s+)?(?:Bukhari|Muslim|Abu\s+Dawud|Tirmidhi|An-Nasai|Nasai|Ibn\s+Majah|Jami'[^\]]*?))[^\]]*?(\d+)\]/gi;

const COLLECTION_MAP = {
  bukhari: "bukhari", muslim: "muslim", dawud: "abudawud",
  tirmidhi: "tirmidhi", nasai: "nasai", majah: "ibnmajah",
};

function resolveCollection(name) {
  const lower = name.toLowerCase();
  for (const [key, id] of Object.entries(COLLECTION_MAP)) {
    if (lower.includes(key)) return id;
  }
  return null;
}

// Lists every citation mentioned in the conversation (for the side panel).
function collectCitations(messages) {
  const out = []; const seen = new Set();
  messages.filter(m => m.role === "assistant").forEach(m => {
    const t = m.content || "";
    let x;
    QURAN_CITATION.lastIndex = 0;
    while ((x = QURAN_CITATION.exec(t)) !== null) {
      const k = `q${x[1]}:${x[2]}`;
      if (!seen.has(k)) { seen.add(k); out.push({ key:k, type:"quran", raw:x[0].replace(/[\[\]]/g,""), surah:parseInt(x[1]), ayah:parseInt(x[2]) }); }
    }
    HADITH_CITATION.lastIndex = 0;
    while ((x = HADITH_CITATION.exec(t)) !== null) {
      const coll = resolveCollection(x[1]); const num = parseInt(x[2], 10);
      const k = `h${coll}:${num}`;
      if (!seen.has(k)) { seen.add(k); out.push({ key:k, type:"hadith", raw:x[0].replace(/[\[\]]/g,""), collection:coll, number:num }); }
    }
  });
  return out;
}

// One entry in the Citations panel: the reference, the passage itself, and a button to open it in full.
function CiteCard({ c, onOpen }) {
  const [d, setD] = useState(null);
  const [state, setState] = useState("loading");
  const [more, setMore] = useState(false);
  useEffect(() => {
    let live = true; setState("loading");
    getCitationText(c).then(r => { if (live) { setD(r); setState("ok"); } }).catch(() => { if (live) setState("err"); });
    return () => { live = false; };
  }, [c.key]);
  const LIM = 260;
  const long = d && d.text.length > LIM;
  return (
    <div style={{ padding:"13px 15px", borderRadius:"14px", border:"1px solid var(--lineSoft)", background:"var(--panel)", color:"var(--text)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <span style={{ flex:1, fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:700 }}>{c.raw}</span>
        <button className="cb" onClick={() => onOpen(c)} style={{ background:"none", border:0, padding:0, cursor:"pointer", fontFamily:"inherit", fontSize:"calc(12px * var(--ts, 1))", fontWeight:700, color:"var(--gold)" }}>Open →</button>
      </div>
      {state === "loading" && <div style={{ marginTop:"10px", color:"var(--faint)", fontSize:"calc(12.5px * var(--ts, 1))" }}>Loading text…</div>}
      {state === "err" && <div style={{ marginTop:"10px", color:"var(--faint)", fontSize:"calc(12.5px * var(--ts, 1))" }}>Text unavailable right now. Use Open to read it.</div>}
      {state === "ok" && d && (
        <div style={{ marginTop:"10px", borderTop:"1px solid var(--lineSoft)", paddingTop:"10px" }}>
          {d.arabic && <div dir="rtl" style={{ fontFamily:"var(--font-ar)", fontSize:"calc(20px * var(--ts, 1))", lineHeight:2, color:"var(--gold)", marginBottom:"6px" }}>{d.arabic}</div>}
          <div style={{ fontSize:"calc(13px * var(--ts, 1))", lineHeight:1.7, color:"var(--dim)" }}>
            {long && !more ? `${d.text.slice(0, LIM).trim()}…` : d.text}
            {long && <button className="cb" onClick={() => setMore(m => !m)} style={{ background:"none", border:0, padding:"0 0 0 6px", cursor:"pointer", fontFamily:"inherit", fontSize:"inherit", fontWeight:700, color:"var(--gold)" }}>{more ? "Less" : "More"}</button>}
          </div>
          {d.grade && <div style={{ marginTop:"6px", fontSize:"calc(11px * var(--ts, 1))", fontWeight:700, letterSpacing:"1px", color:"var(--faint)" }}>{d.grade.toUpperCase()}</div>}
        </div>
      )}
    </div>
  );
}

export default function ChatTab({ session, onSessionUpdate, onNewChat, remaining, setRemaining, unlocked, setUnlocked, profile, deviceId, lightMode, textSize = 1, navigateTo, onSwitchTab, onQuranSurah, onHadithNav }) {
  const docked = useMedia(DOCK_QUERY);
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [ramadan,       setRamadan]       = useState(null);
  const [prayerTimes,   setPrayerTimes]   = useState(null);
  const [showCityModal, setShowCityModal] = useState(false);
  const [citeKind,      setCiteKind]      = useState("quran");   // side-panel filter (display only)
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  const gold = "var(--gold)";
  const goldDim  = "var(--goldDim)";
  const textClr = "var(--text)";
  const inputBg = "var(--panel2)";
  const inputBdr = "var(--active)";
  const inpFldBg = "var(--panel2)";
  const inpFldBdr= "var(--line)";

  // Restore messages from session, or reset when session changes
  useEffect(() => {
    setMessages(session?.messages || []);
    setError(null);
  }, [session?.id]);

  useEffect(() => {
    (async () => {
      try {
        const r = await checkIfRamadan();
        if (!r.isRamadan) return;
        setRamadan(r);
        
        const loadFallback = () => {
          const city = localStorage.getItem(KEYS.CITY); 
          if (city) getPrayerTimesByCity(city).then(setPrayerTimes).catch(() => {});
        };

        const last = getLastLocation();
        if (last) { try { setPrayerTimes(await getPrayerTimes(last.lat, last.lon)); return; } catch {} }
        try { const pos = await getDevicePosition(); setPrayerTimes(await getPrayerTimes(pos.lat, pos.lon)); }
        catch { loadFallback(); }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const today = getLocalDate();
      if (localStorage.getItem(KEYS.DATE) !== today) { 
        setRemaining(DAILY_LIMIT); 
        setCachedRemaining(DAILY_LIMIT); 
        localStorage.setItem(KEYS.DATE, today);
      }
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

    const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading || (!unlocked && remaining <= 0)) return;
    setInput(""); setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const agePrefix   = getAgePrefix(profile.yearOfBirth);
    const prefixed    = agePrefix ? `[Context: ${agePrefix}]\n\n${userText}` : userText;
    const newMessages = [...messages, { role:"user", content:prefixed, display:userText }];
    setMessages(newMessages);
    setLoading(true);

    // 1. Optimistic Local Decrement: Instantly lower the count in the UI and Cache
    let localRemaining = remaining;
    if (!unlocked && remaining !== 999) {
      localRemaining = Math.max(0, remaining - 1);
      setRemaining(localRemaining);
      setCachedRemaining(localRemaining);
    }

    try {
      const res  = await fetch(PROXY_URL, { 
        method:"POST", 
        headers:deviceHeaders({"Content-Type":"application/json"}), 
        body:JSON.stringify({ device_id:deviceId, local_date:getLocalDate(), messages:newMessages.map(m => ({ role:m.role, content:m.content })) }) 
      });
      const data = await res.json();
      
      if (res.status === 429) { setRemaining(0); setCachedRemaining(0); return; }
      
      // Throw error to trigger the catch block and rollback local limit
      if (!res.ok) { throw new Error(data.error || res.status); } 
      
      if (data.unlocked) { setUnlocked(true); localStorage.setItem(KEYS.UNLOCKED,"true"); }

      // 2. Safe Backend Sync: Guard against stale proxy responses
      if (data.remaining !== undefined) {
        const nr = data.remaining === 999 ? 999 : Number(data.remaining);
        
        // Only accept the backend limit if it unlocks Pro (999) or is stricter than our local count
        if (nr === 999 || nr < localRemaining) {
          setRemaining(nr);
          if (nr !== 999) setCachedRemaining(nr);
        }
      }

      const reply = data.reply;
      const updatedMessages = [...newMessages, { role:"assistant", content:reply }];
      setMessages(updatedMessages);
      onSessionUpdate(updatedMessages);
      
    } catch (err) {
      setError(`Connection error: ${err.message}`);
      // 3. Rollback: If the API fails, restore the lost token to the user
      setRemaining(remaining);
      setCachedRemaining(remaining);
    }
    finally { setLoading(false); }
  };

  const handleKeyDown = e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const renderMessage = (text) => {
    const segments = [];
    let lastIndex  = 0;
    const combined = text;
    const allMatches = [];

    let m;
    QURAN_CITATION.lastIndex = 0;
    while ((m = QURAN_CITATION.exec(combined)) !== null) {
      allMatches.push({ index:m.index, end:m.index+m[0].length, raw:m[0], type:"quran", surah:parseInt(m[1]), ayah:parseInt(m[2]) });
    }
    HADITH_CITATION.lastIndex = 0;
    while ((m = HADITH_CITATION.exec(combined)) !== null) {
      const collId = resolveCollection(m[1]);
      const num    = parseInt(m[2], 10);
      allMatches.push({ index:m.index, end:m.index+m[0].length, raw:m[0], type:"hadith", collection:collId, number:num });
    }
    allMatches.sort((a, b) => a.index - b.index);

    const lines = [];
    let cursor = 0;
    for (const match of allMatches) {
      if (match.index > cursor) {
        const before = combined.slice(cursor, match.index);
        before.split("\n").forEach((line, li, arr) => {
          lines.push(<span key={`t-${match.index}-${li}`}>{line}</span>);
          if (li < arr.length - 1) lines.push(<br key={`br-${match.index}-${li}`}/>);
        });
      }
      if (match.type === "quran") {
        lines.push(
          <span key={`q-${match.index}`}
            onClick={() => { onSwitchTab("quran"); onQuranSurah(match.surah, match.ayah); }}
            style={CITE_STYLE}
            title={`Open Surah ${match.surah} in Quran tab`}>
            {match.raw}
          </span>
        );
      } else {
        lines.push(
          <span key={`h-${match.index}`}
            onClick={() => {
              onSwitchTab("hadith");
              if (match.collection) onHadithNav({ collectionId: match.collection, number: match.number });
            }}
            style={CITE_STYLE}
            title={`Open in Hadith tab — ${match.raw.replace(/[\[\]]/g,"")}`}>
            {match.raw}
          </span>
        );
      }
      cursor = match.end;
    }
    if (cursor < combined.length) {
      combined.slice(cursor).split("\n").forEach((line, li, arr) => {
        lines.push(<span key={`end-${li}`}>{line}</span>);
        if (li < arr.length - 1) lines.push(<br key={`endbr-${li}`}/>);
      });
    }

    return <div style={{ lineHeight:1.75, fontSize:`${14.5 * textSize}px` }}>{lines}</div>;
  };

  // A question typed on the homepage arrives as /app?q=… — put it in the box (not sent, so the person can edit it first)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("q") || "").trim().slice(0, 500);
      if (!q) return;
      setInput(q);
      url.searchParams.delete("q");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      setTimeout(() => { const el = textareaRef.current; if (el) { el.focus(); el.setSelectionRange(q.length, q.length); el.style.height = Math.min(el.scrollHeight, 140) + "px"; } }, 150);
    } catch {}
  }, []);

  const isEmpty  = messages.length === 0;
  const isLocked = !unlocked && remaining <= 0;
  const citations = collectCitations(messages);
  const shown     = citations.filter(c => c.type === citeKind);
  const firstQ    = (messages.find(m => m.role === "user")?.display) || "";
  const canSend   = input.trim() && !loading;

  const openCitation = (c) => {
    if (c.type === "quran") { onSwitchTab("quran"); onQuranSurah(c.surah, c.ayah); }
    else { onSwitchTab("hadith"); if (c.collection) onHadithNav({ collectionId:c.collection, number:c.number }); }
  };

  const assistantAvatar = (
    <div style={{ width:"30px", height:"30px", borderRadius:"50%", flexShrink:0, background:"var(--chip)", border:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"center" }}><StarIcon/></div>
  );

  return (
    <div style={{ display:"flex", flex:1, minHeight:0 }}>
    <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0, minHeight:0 }}>
      {showCityModal && <CityModal onSubmit={t => { setPrayerTimes(t); setShowCityModal(false); }} onClose={() => setShowCityModal(false)}/>}
      {ramadan?.isRamadan && <RamadanBanner prayerTimes={prayerTimes} hijriDay={ramadan.hijriDay} onRequestCity={() => setShowCityModal(true)}/>}

      {isLocked && isEmpty && <LockedBanner navigateTo={navigateTo} lightMode={lightMode} textSize={textSize}/>}

      {!isLocked && (
        <>
          {/* Conversation bar */}
          <div style={{ flex:"none", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", padding:"0 24px", minHeight:"56px", borderBottom:"1px solid var(--lineSoft)" }}>
            <div style={{ minWidth:0, fontSize:`${14*textSize}px`, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color: firstQ ? "var(--text)" : "var(--faint)" }}>{firstQ || "New conversation"}</div>
            <button className="cb" onClick={onNewChat} title="New conversation"
              style={{ flex:"none", display:"flex", alignItems:"center", gap:"7px", height:"36px", padding:"0 14px", borderRadius:"12px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontSize:`${13*textSize}px`, fontWeight:700, cursor:"pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New chat
            </button>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"26px 20px" }}>
            <div style={{ maxWidth:"700px", width:"100%", margin:"0 auto" }}>
            {isEmpty && (
              <div style={{ textAlign:"center", paddingTop:"24px" }}>
                <div className="ar" style={{ fontSize:`${34 * textSize}px`, color:"var(--gold)", marginBottom:"6px", lineHeight:1.6 }}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</div>
                <div style={{ color:"var(--faint)", fontSize:"calc(11px * var(--ts, 1))", fontWeight:600, letterSpacing:"1.6px", marginBottom:"26px" }}>IN THE NAME OF ALLAH, THE MOST GRACIOUS, THE MOST MERCIFUL</div>
                {profile.name && <div style={{ color:"var(--dim)", fontSize:`${14 * textSize}px`, marginBottom:"14px" }}>As-salamu alaykum, <strong style={{ color:gold }}>{profile.name}</strong></div>}
                <h2 className="hd" style={{ color:"var(--text)", fontSize:`${30 * textSize}px`, lineHeight:1.2, marginBottom:"10px" }}>What would you like to understand today?</h2>
                <p style={{ color:"var(--dim)", fontSize:`${14 * textSize}px`, marginBottom:"26px", lineHeight:1.7 }}>
                  Ask anything about Islam — grounded in the Quran and authentic Hadith.
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", justifyContent:"center" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="cb" onClick={() => sendMessage(s)}
                      style={{ background:"var(--panel)", border:"1px solid var(--lineSoft)", borderRadius:"20px", color:"var(--dim)", padding:"8px 16px", fontSize:`${13 * textSize}px`, fontWeight:600, cursor:"pointer" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isEmpty && (
              <div style={{ display:"flex", flexDirection:"column", gap:"22px" }}>
                {error && <div style={{ background:"color-mix(in srgb,var(--warn) 10%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 30%,transparent)", borderRadius:"12px", padding:"12px 16px", color:"var(--warn)", fontSize:`${13 * textSize}px`, textAlign:"center" }}>{error}</div>}
                {messages.map((msg, i) => (
                  msg.role === "user" ? (
                    <div key={i} style={{ alignSelf:"flex-end", maxWidth:"82%", background:"var(--user)", border:"1px solid var(--userLine)", borderRadius:"18px 18px 4px 18px", padding:"11px 17px", color:textClr }}>
                      <p style={{ margin:0, fontSize:`${14.5 * textSize}px`, fontWeight:600, lineHeight:1.5 }}>{msg.display || msg.content}</p>
                    </div>
                  ) : (
                    <div key={i} style={{ display:"flex", gap:"12px", alignItems:"flex-start", color:textClr }}>
                      {assistantAvatar}
                      <div style={{ flex:1, minWidth:0 }}>{renderMessage(msg.content)}</div>
                    </div>
                  )
                ))}
                {loading && (
                  <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                    {assistantAvatar}
                    <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                      {[0,1,2].map(d => <div key={d} style={{ width:"7px", height:"7px", borderRadius:"50%", background:gold, animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>
            )}
            </div>
          </div>

          <div style={{ flexShrink:0, padding:"10px 20px 16px" }}>
            <div style={{ maxWidth:"700px", margin:"0 auto" }}>
              <div style={{ display:"flex", alignItems:"flex-end", gap:"10px", background:inpFldBg, border:`1px solid ${inpFldBdr}`, borderRadius:"18px", padding:"8px 8px 8px 18px" }}>
                <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); autoResize(); }} onKeyDown={handleKeyDown}
                  placeholder={docked ? "Ask about Quran, Hadith, Islamic practice…" : "Ask a question…"} rows={1} disabled={loading} aria-label="Ask a question"
                  style={{ flex:1, minWidth:0, background:"transparent", border:"none", outline:"none", color:textClr, fontSize:`${14.5 * textSize}px`, fontWeight:600, resize:"none", lineHeight:1.6, padding:"9px 0" }}/>
                <button onClick={() => sendMessage()} disabled={!canSend} aria-label="Send question"
                  style={{ width:"44px", height:"44px", borderRadius:"13px", flexShrink:0, background: canSend ? "var(--goldFill)" : "var(--chip)", border:"none", color: canSend ? "var(--onGold)" : "var(--gold)", cursor: canSend ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", opacity: canSend ? 1 : 0.5 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
              </div>
              <div style={{ textAlign:"center", marginTop:"9px", color:"var(--faint)", fontSize:"calc(12px * var(--ts, 1))", fontWeight:600 }}>
                Tap any citation to open it in the Quran or Hadith tab · Allahu A'lam
              </div>
            </div>
          </div>
        </>
      )}
    </div>

    {/* Citations panel — website view only (hidden by CSS on phones) */}
    {!isLocked && (
      <aside className="nur-rightpane" aria-label="Citations" style={{ width:"340px" }}>
        <div style={{ flex:"none", padding:"20px 20px 0" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:"12px" }}>
            <span className="hd" style={{ fontSize:"calc(22px * var(--ts, 1))", color:"var(--gold)" }}>Citations</span>
            <span style={{ fontSize:"calc(11px * var(--ts, 1))", fontWeight:700, letterSpacing:"1.6px", color:"var(--faint)" }}>{citations.length} IN THIS CHAT</span>
          </div>
          <div role="tablist" style={{ display:"flex", gap:"4px", padding:"4px", borderRadius:"14px", background:"var(--panel2)", border:"1px solid var(--lineSoft)" }}>
            {[["quran","Quran"],["hadith","Hadith"]].map(([k,l]) => (
              <button key={k} role="tab" aria-selected={citeKind===k} className="cb" onClick={() => setCiteKind(k)}
                style={{ flex:1, height:"36px", borderRadius:"10px", border:0, background: citeKind===k ? "var(--active)" : "transparent", color: citeKind===k ? "var(--gold)" : "var(--dim)", fontFamily:"var(--font-head)", fontSize:"calc(16px * var(--ts, 1))", fontWeight:700, letterSpacing:"1.5px", cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:"10px" }}>
          {shown.length === 0 && (
            <div style={{ color:"var(--faint)", fontSize:"calc(13.5px * var(--ts, 1))", lineHeight:1.7, padding:"8px 2px" }}>
              {citations.length === 0
                ? "Sources mentioned in the answers will be collected here, so you can open any of them in one tap."
                : `No ${citeKind === "quran" ? "Quran" : "Hadith"} citations in this chat yet.`}
            </div>
          )}
          {shown.map(c => <CiteCard key={c.key} c={c} onOpen={openCitation}/>)}
        </div>
      </aside>
    )}
    </div>
  );
}
