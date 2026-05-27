import { useState, useEffect, useRef } from "react";
import {
  PROXY_URL, DAILY_LIMIT, KEYS, getAgePrefix, getCachedRemaining,
  setCachedRemaining, checkIfRamadan, getPrayerTimes,
  getPrayerTimesByCity, getCountdownTo, addChatEntry,
} from "./utils.js";

const StarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#c9a84c"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
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
    <div style={{ background:"linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04))", borderBottom:"1px solid rgba(201,168,76,0.2)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ fontSize:"18px" }}>☽</span>
        <div>
          <div style={{ color:"#c9a84c", fontSize:"12px", fontWeight:700 }}>Ramadan Mubarak · Day {hijriDay}</div>
          {prayerTimes
            ? <div style={{ color:"rgba(201,168,76,0.65)", fontSize:"12px", marginTop:"2px" }}>{info.label} <strong style={{ color:"#c9a84c", fontVariantNumeric:"tabular-nums" }}>{info.time}</strong></div>
            : <button onClick={onRequestCity} style={{ background:"none", border:"none", color:"rgba(201,168,76,0.55)", fontSize:"11px", cursor:"pointer", textDecoration:"underline", padding:0, fontFamily:"Nunito,sans-serif" }}>Add city for Iftar times</button>}
        </div>
      </div>
      {prayerTimes && <div style={{ color:"rgba(201,168,76,0.35)", fontSize:"10px", textAlign:"right", lineHeight:1.8 }}>Suhoor: {prayerTimes.Fajr}<br/>Iftar: {prayerTimes.Maghrib}</div>}
    </div>
  );
}

function CityModal({ onSubmit, onClose }) {
  const [city, setCity] = useState(localStorage.getItem(KEYS.CITY) || "");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!city.trim()) return;
    setBusy(true); setErr("");
    try { const t = await getPrayerTimesByCity(city.trim()); localStorage.setItem(KEYS.CITY, city.trim()); onSubmit(t); }
    catch { setErr("City not found. Try a nearby major city."); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"linear-gradient(160deg,#0d1f14,#081510)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"340px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <span style={{ color:"#c9a84c", fontSize:"16px", fontWeight:700 }}>Your City</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(201,168,76,0.4)", fontSize:"20px", cursor:"pointer" }}>✕</button>
        </div>
        <input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()} placeholder="e.g. Istanbul, Karachi, London"
          style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:"10px", padding:"12px 14px", color:"#fff", fontSize:"15px", outline:"none", fontFamily:"Nunito,sans-serif", marginBottom:"12px", boxSizing:"border-box" }}/>
        {err && <div style={{ color:"#e07b54", fontSize:"13px", marginBottom:"10px" }}>{err}</div>}
        <button onClick={submit} disabled={!city.trim() || busy}
          style={{ width:"100%", padding:"12px", borderRadius:"10px", background:city.trim()?"linear-gradient(135deg,#c9a84c,#a8862e)":"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.3)", color:city.trim()?"#0d1f14":"rgba(201,168,76,0.3)", fontSize:"14px", fontWeight:700, cursor:city.trim()?"pointer":"not-allowed", fontFamily:"Nunito,sans-serif" }}>
          {busy ? "Finding times…" : "Get Prayer Times"}
        </button>
      </div>
    </div>
  );
}

// ─── Locked screen — minimal, routes to GetProPage ────────────────────────────
function LockedBanner({ navigateTo, lightMode, textSize = 1 }) {
  const gold = lightMode ? "#7a5810" : "#c9a84c";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 28px", textAlign:"center", flex:1 }}>
      <div style={{ fontSize:"28px", color:gold, fontFamily:"Georgia,serif", marginBottom:"8px" }}>طَلَبُ الْعِلْمِ فَرِيضَةٌ</div>
      <div style={{ color:lightMode?"rgba(122,88,16,0.45)":"rgba(201,168,76,0.4)", fontSize:"11px", letterSpacing:"1.5px", marginBottom:"24px" }}>"Seeking knowledge is an obligation" — Ibn Mājah</div>
      <div style={{ color:lightMode?"rgba(26,15,0,0.5)":"rgba(255,255,255,0.45)", fontSize:`${14 * textSize}px`, lineHeight:1.8, marginBottom:"28px" }}>
        You've used all your free reflections today.
      </div>
      <button onClick={() => navigateTo("getpro")}
        style={{ padding:"15px 40px", borderRadius:"50px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, border:"none", color:lightMode?"#fff":"#0d1f14", fontSize:`${16 * textSize}px`, fontWeight:800, cursor:"pointer", fontFamily:"Nunito,sans-serif", boxShadow:`0 6px 28px ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.28)"}` }}>
        🌙 Get Pro
      </button>
      <div style={{ color:lightMode?"rgba(26,15,0,0.3)":"rgba(255,255,255,0.25)", fontSize:"12px", marginTop:"12px" }}>or wait — resets at midnight</div>
    </div>
  );
}

// ─── Citation parser ──────────────────────────────────────────────────────────
// Matches [anything X:Y anything] — handles [Surah Al-Baqarah, 2:286] and [2:286]
const QURAN_CITATION  = /\[[^\]]*?(\d{1,3}):(\d{1,3})[^\]]*\]/g;
// Matches [Sahih Bukhari #8] [Tirmidhi 2516] [Sahih Bukhari, Hadith 8] etc.
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

export default function ChatTab({ remaining, setRemaining, unlocked, setUnlocked, profile, deviceId, lightMode, textSize = 1, navigateTo, onSwitchTab, onQuranSurah, onHadithNav }) {
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [ramadan,       setRamadan]       = useState(null);
  const [prayerTimes,   setPrayerTimes]   = useState(null);
  const [showCityModal, setShowCityModal] = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.45)" : "rgba(201,168,76,0.45)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)" : "rgba(255,255,255,0.82)";
  const inputBg  = lightMode ? "rgba(253,248,237,0.98)" : "rgba(8,21,16,0.96)";
  const inputBdr = lightMode ? "rgba(122,88,16,0.15)" : "rgba(201,168,76,0.1)";
  const inpFldBg = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";
  const inpFldBdr= lightMode ? "rgba(122,88,16,0.2)" : "rgba(201,168,76,0.2)";

  useEffect(() => {
    (async () => {
      try {
        const r = await checkIfRamadan();
        if (!r.isRamadan) return;
        setRamadan(r);
        navigator.geolocation?.getCurrentPosition(
          async ({ coords }) => { try { setPrayerTimes(await getPrayerTimes(coords.latitude, coords.longitude)); } catch {} },
          () => { const city = localStorage.getItem(KEYS.CITY); if (city) getPrayerTimesByCity(city).then(setPrayerTimes).catch(() => {}); }
        );
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem(KEYS.DATE) !== today) { setRemaining(DAILY_LIMIT); setCachedRemaining(DAILY_LIMIT); }
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
    try {
      const res  = await fetch(PROXY_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ device_id:deviceId, messages:newMessages.map(m => ({ role:m.role, content:m.content })) }) });
      const data = await res.json();
      if (res.status === 429) { setRemaining(0); setCachedRemaining(0); return; }
      if (!res.ok) { setError(`Error: ${data.error || res.status}`); return; }
      if (data.unlocked) { setUnlocked(true); localStorage.setItem(KEYS.UNLOCKED,"true"); }
      const nr = data.remaining === 999 ? 999 : data.remaining;
      setRemaining(nr);
      if (nr !== 999) setCachedRemaining(nr);
      const reply = data.reply;
      setMessages([...newMessages, { role:"assistant", content:reply }]);
      // Save to history
      addChatEntry(userText, reply);
    } catch (err) { setError(`Connection error: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleKeyDown = e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // ─── Render assistant message with tappable citations ────────────────────
  const renderMessage = (text) => {
    // Collect all citation positions and replace with markers
    const segments = [];
    let lastIndex  = 0;
    const combined = text;

    // Find all citations in order
    const allMatches = [];

    let m;
    QURAN_CITATION.lastIndex = 0;
    while ((m = QURAN_CITATION.exec(combined)) !== null) {
      allMatches.push({ index:m.index, end:m.index+m[0].length, raw:m[0], type:"quran", surah:parseInt(m[1]), ayah:parseInt(m[2]) });
    }
    HADITH_CITATION.lastIndex = 0;
    while ((m = HADITH_CITATION.exec(combined)) !== null) {
      // Guard: skip if this range already covered by a Quran match
      const collId = resolveCollection(m[1]);
      const num    = parseInt(m[2], 10);
      allMatches.push({ index:m.index, end:m.index+m[0].length, raw:m[0], type:"hadith", collection:collId, number:num });
    }
    allMatches.sort((a, b) => a.index - b.index);

    // Build segments
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
            onClick={() => { onSwitchTab("quran"); onQuranSurah(match.surah); }}
            style={{ color:gold, fontWeight:700, fontStyle:"italic", cursor:"pointer", textDecoration:"underline dotted", textUnderlineOffset:"3px" }}
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
            style={{ color:gold, fontWeight:700, fontStyle:"italic", cursor:"pointer", textDecoration:"underline dotted", textUnderlineOffset:"3px" }}
            title={`Open in Hadith tab — ${match.raw.replace(/[\[\]]/g,"")}`}>
            {match.raw}
          </span>
        );
      }
      cursor = match.end;
    }
    // Remaining text
    if (cursor < combined.length) {
      combined.slice(cursor).split("\n").forEach((line, li, arr) => {
        lines.push(<span key={`end-${li}`}>{line}</span>);
        if (li < arr.length - 1) lines.push(<br key={`endbr-${li}`}/>);
      });
    }

    return <div style={{ lineHeight:1.75, fontSize:`${14 * textSize}px` }}>{lines}</div>;
  };

  const isEmpty  = messages.length === 0;
  const isLocked = !unlocked && remaining <= 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
      {showCityModal && <CityModal onSubmit={t => { setPrayerTimes(t); setShowCityModal(false); }} onClose={() => setShowCityModal(false)}/>}
      {ramadan?.isRamadan && <RamadanBanner prayerTimes={prayerTimes} hijriDay={ramadan.hijriDay} onRequestCity={() => setShowCityModal(true)}/>}

      {/* Locked state */}
      {isLocked && isEmpty && <LockedBanner navigateTo={navigateTo} lightMode={lightMode} textSize={textSize}/>}

      {/* Chat area */}
      {!isLocked && (
        <>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", maxWidth:"760px", width:"100%", margin:"0 auto", boxSizing:"border-box" }}>
            {isEmpty && (
              <div style={{ textAlign:"center", paddingTop:"28px" }}>
                <div style={{ fontSize:`${26 * textSize}px`, color:gold, marginBottom:"8px" }}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</div>
                <div style={{ color:goldDim, fontSize:"11px", letterSpacing:"2px", marginBottom:"28px" }}>In the Name of Allah, the Most Gracious, the Most Merciful</div>
                {profile.name && <div style={{ color:lightMode?"rgba(26,15,0,0.4)":"rgba(255,255,255,0.4)", fontSize:`${14 * textSize}px`, marginBottom:"16px" }}>As-salamu alaykum, <strong style={{ color:gold }}>{profile.name}</strong> 🌙</div>}
                <div style={{ width:"40px", height:"1px", background:`linear-gradient(90deg,transparent,${gold},transparent)`, margin:"0 auto 24px" }}/>
                <p style={{ color:lightMode?"rgba(26,15,0,0.38)":"rgba(255,255,255,0.38)", fontSize:`${14 * textSize}px`, marginBottom:"28px", lineHeight:1.8 }}>
                  Ask anything about Islam — grounded in the Quran and authentic Hadith.
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", justifyContent:"center" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      style={{ background:lightMode?"rgba(122,88,16,0.07)":"rgba(201,168,76,0.07)", border:`1px solid ${lightMode?"rgba(122,88,16,0.2)":"rgba(201,168,76,0.2)"}`, borderRadius:"24px", color:gold, padding:"9px 18px", fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isEmpty && (
              <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
                {error && <div style={{ background:"rgba(224,123,84,0.1)", border:"1px solid rgba(224,123,84,0.3)", borderRadius:"12px", padding:"12px 16px", color:"#e07b54", fontSize:`${13 * textSize}px`, textAlign:"center" }}>{error}</div>}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
                    {msg.role==="assistant" && (
                      <div style={{ width:"32px", height:"32px", borderRadius:"50%", flexShrink:0, background:lightMode?"linear-gradient(135deg,#f0e4c0,#e6d4a0)":"linear-gradient(135deg,#1a3a22,#0d2018)", border:`1px solid ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.3)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}><StarIcon/></div>
                    )}
                    <div style={{ maxWidth:"82%",
                      background:msg.role==="user"?lightMode?"linear-gradient(135deg,rgba(122,88,16,0.14),rgba(122,88,16,0.07))":"linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.09))":lightMode?"rgba(255,255,255,0.65)":"rgba(255,255,255,0.04)",
                      border:msg.role==="user"?`1px solid ${lightMode?"rgba(122,88,16,0.25)":"rgba(201,168,76,0.28)"}`:`1px solid ${lightMode?"rgba(122,88,16,0.12)":"rgba(255,255,255,0.08)"}`,
                      borderRadius:msg.role==="user"?"18px 4px 18px 18px":"4px 18px 18px 18px",
                      padding:"13px 16px", color:textClr }}>
                      {msg.role==="assistant"
                        ? renderMessage(msg.content)
                        : <p style={{ margin:0, fontSize:`${14 * textSize}px` }}>{msg.display || msg.content}</p>}
                    </div>
                    {msg.role==="user" && (
                      <div style={{ width:"32px", height:"32px", borderRadius:"50%", flexShrink:0, background:lightMode?"rgba(122,88,16,0.12)":"rgba(201,168,76,0.12)", border:`1px solid ${lightMode?"rgba(122,88,16,0.25)":"rgba(201,168,76,0.25)"}`, display:"flex", alignItems:"center", justifyContent:"center", color:gold }}><UserIcon/></div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                    <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:lightMode?"linear-gradient(135deg,#f0e4c0,#e6d4a0)":"linear-gradient(135deg,#1a3a22,#0d2018)", border:`1px solid ${lightMode?"rgba(122,88,16,0.3)":"rgba(201,168,76,0.3)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}><StarIcon/></div>
                    <div style={{ background:lightMode?"rgba(255,255,255,0.65)":"rgba(255,255,255,0.04)", border:`1px solid ${lightMode?"rgba(122,88,16,0.12)":"rgba(255,255,255,0.08)"}`, borderRadius:"4px 18px 18px 18px", padding:"14px 18px", display:"flex", gap:"6px", alignItems:"center" }}>
                      {[0,1,2].map(d => <div key={d} style={{ width:"7px", height:"7px", borderRadius:"50%", background:gold, animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div style={{ background:inputBg, backdropFilter:"blur(16px)", borderTop:`1px solid ${inputBdr}`, padding:"12px 16px 14px", flexShrink:0 }}>
            <div style={{ maxWidth:"760px", margin:"0 auto" }}>
              <div style={{ display:"flex", gap:"10px", alignItems:"flex-end" }}>
                <div style={{ flex:1, background:inpFldBg, border:`1px solid ${inpFldBdr}`, borderRadius:"14px", padding:"11px 14px" }}>
                  <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); autoResize(); }} onKeyDown={handleKeyDown}
                    placeholder="Ask about Quran, Hadith, Islamic practice…" rows={1} disabled={loading}
                    style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:textClr, fontSize:`${14 * textSize}px`, resize:"none", fontFamily:"Nunito,sans-serif", lineHeight:1.6 }}/>
                </div>
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  style={{ width:"44px", height:"44px", borderRadius:"12px", flexShrink:0, background:input.trim()&&!loading?`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`:`${lightMode?"rgba(122,88,16,0.08)":"rgba(201,168,76,0.08)"}`, border:`1px solid ${inpFldBdr}`, color:input.trim()&&!loading?(lightMode?"#fff":"#0d1f14"):gold, cursor:input.trim()&&!loading?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", opacity:input.trim()&&!loading?1:0.4 }}>
                  <SendIcon/>
                </button>
              </div>
              <div style={{ textAlign:"center", marginTop:"8px", color:goldDim, fontSize:"10px", letterSpacing:"0.8px", opacity:0.6 }}>
                Tap any citation to open it in Quran or Hadith tab · Allahu A'lam
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
