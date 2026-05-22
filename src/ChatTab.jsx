import { useState, useEffect, useRef } from "react";
import {
  PROXY_URL, DAILY_LIMIT, KEYS, getAgePrefix, getCachedRemaining,
  setCachedRemaining, getMidnightCountdown, checkIfRamadan,
  getPrayerTimes, getPrayerTimesByCity, getCountdownTo,
} from "./utils.js";

// ─── Icons ────────────────────────────────────────────────────────────────────
const StarIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#c9a84c"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
const SendIcon  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>;
const UserIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>;
const CheckIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="#c9a84c"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
const KeyIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#c9a84c"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>;

const SUGGESTIONS = [
  "What does the Quran say about patience?",
  "How should I perform Salah correctly?",
  "What are the pillars of Islam?",
  "What does Islam say about kindness to parents?",
  "Explain the concept of Tawakkul",
];

const PRO_FEATURES = [
  "Unlimited reflections — no daily cap",
  "Full Quran browser — all 114 Surahs",
  "Hadith library — Bukhari, Muslim & more",
  "Save & bookmark answers",
  "Rewards, streaks & Ramadan mode",
];

// ─── Ramadan Banner ───────────────────────────────────────────────────────────
function RamadanBanner({ prayerTimes, hijriDay, onRequestCity }) {
  const [info, setInfo] = useState({ label: "", time: "" });

  useEffect(() => {
    if (!prayerTimes) return;
    const tick = () => {
      const now     = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [fH, fM] = prayerTimes.Fajr.split(":").map(Number);
      const [mH, mM] = prayerTimes.Maghrib.split(":").map(Number);
      const fajrMins = fH * 60 + fM;
      const maghMins = mH * 60 + mM;
      const isFasting = nowMins >= fajrMins && nowMins < maghMins;
      const c = getCountdownTo(isFasting ? prayerTimes.Maghrib : prayerTimes.Fajr);
      setInfo({
        label: isFasting ? "Iftar in" : "Suhoor in",
        time:  `${String(c.hours).padStart(2,"0")}:${String(c.mins).padStart(2,"0")}:${String(c.secs).padStart(2,"0")}`,
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [prayerTimes]);

  return (
    <div style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04))", borderBottom: "1px solid rgba(201,168,76,0.2)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "18px" }}>☽</span>
        <div>
          <div style={{ color: "#c9a84c", fontSize: "12px", fontWeight: 700 }}>Ramadan Mubarak · Day {hijriDay}</div>
          {prayerTimes ? (
            <div style={{ color: "rgba(201,168,76,0.65)", fontSize: "12px", marginTop: "2px" }}>
              {info.label} <strong style={{ color: "#c9a84c", fontVariantNumeric: "tabular-nums" }}>{info.time}</strong>
            </div>
          ) : (
            <button onClick={onRequestCity} style={{ background: "none", border: "none", color: "rgba(201,168,76,0.55)", fontSize: "11px", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "Nunito,sans-serif" }}>
              Add city for Iftar times
            </button>
          )}
        </div>
      </div>
      {prayerTimes && (
        <div style={{ color: "rgba(201,168,76,0.35)", fontSize: "10px", textAlign: "right", lineHeight: 1.8 }}>
          Suhoor: {prayerTimes.Fajr}<br/>Iftar: {prayerTimes.Maghrib}
        </div>
      )}
    </div>
  );
}

// ─── City Input Modal ─────────────────────────────────────────────────────────
function CityModal({ onSubmit, onClose }) {
  const [city, setCity] = useState(localStorage.getItem(KEYS.CITY) || "");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!city.trim()) return;
    setBusy(true); setErr("");
    try {
      const times = await getPrayerTimesByCity(city.trim());
      localStorage.setItem(KEYS.CITY, city.trim());
      onSubmit(times);
    } catch { setErr("City not found. Try a nearby major city."); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "linear-gradient(160deg,#0d1f14,#081510)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "340px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <span style={{ color: "#c9a84c", fontSize: "16px", fontWeight: 700 }}>Your City</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(201,168,76,0.4)", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>
        <input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="e.g. Istanbul, Karachi, London"
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "10px", padding: "12px 14px", color: "#fff", fontSize: "15px", outline: "none", fontFamily: "Nunito,sans-serif", marginBottom: "12px", boxSizing: "border-box" }}/>
        {err && <div style={{ color: "#e07b54", fontSize: "13px", marginBottom: "10px" }}>{err}</div>}
        <button onClick={submit} disabled={!city.trim() || busy}
          style={{ width: "100%", padding: "12px", borderRadius: "10px", background: city.trim() ? "linear-gradient(135deg,#c9a84c,#a8862e)" : "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", color: city.trim() ? "#0d1f14" : "rgba(201,168,76,0.3)", fontSize: "14px", fontWeight: 700, cursor: city.trim() ? "pointer" : "not-allowed", fontFamily: "Nunito,sans-serif" }}>
          {busy ? "Finding times…" : "Get Prayer Times"}
        </button>
      </div>
    </div>
  );
}

// ─── Unlock Modal ─────────────────────────────────────────────────────────────
function UnlockModal({ deviceId, onClose, onUnlocked }) {
  const [code,   setCode]   = useState("");
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  const submit = async () => {
    if (!code.trim()) return;
    setStatus("loading"); setErrMsg("");
    try {
      const res  = await fetch(PROXY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id: deviceId, unlock_code: code.trim() }) });
      const data = await res.json();
      if (!res.ok || !data.unlocked) { setErrMsg(data.error || "Invalid code"); setStatus("error"); }
      else { localStorage.setItem(KEYS.UNLOCKED, "true"); setStatus("success"); setTimeout(() => { onUnlocked(); onClose(); }, 1600); }
    } catch { setErrMsg("Connection error. Try again."); setStatus("error"); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "linear-gradient(160deg,#0d1f14,#081510)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "20px", padding: "28px 24px", width: "100%", maxWidth: "360px", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "16px", background: "none", border: "none", color: "rgba(201,168,76,0.4)", fontSize: "20px", cursor: "pointer" }}>✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <KeyIcon/>
          <span style={{ color: "#c9a84c", fontSize: "17px", fontWeight: 700 }}>Enter Unlock Code</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: 1.7, marginBottom: "18px" }}>
          Paste the code from your purchase email. New device?{" "}
          <a href="https://billing.stripe.com/p/login/YOUR_PORTAL" target="_blank" rel="noreferrer" style={{ color: "#c9a84c" }}>Customer Portal</a>
        </p>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="License key or unlock code" maxLength={40}
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${status === "error" ? "#e07b54" : "rgba(201,168,76,0.25)"}`, borderRadius: "12px", padding: "13px 16px", color: "#fff", fontSize: "16px", fontFamily: "monospace", letterSpacing: "2px", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}/>
        {errMsg && <div style={{ color: "#e07b54", fontSize: "13px", marginBottom: "10px" }}>{errMsg}</div>}
        {status === "success"
          ? <div style={{ textAlign: "center", color: "#4caf84", fontSize: "15px", fontWeight: 700 }}>✦ Unlocked! Jazakallahu Khairan 🌙</div>
          : <button onClick={submit} disabled={!code.trim() || status === "loading"}
              style={{ width: "100%", padding: "13px", borderRadius: "12px", background: code.trim() ? "linear-gradient(135deg,#c9a84c,#a8862e)" : "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", color: code.trim() ? "#0d1f14" : "rgba(201,168,76,0.3)", fontSize: "15px", fontWeight: 700, cursor: code.trim() ? "pointer" : "not-allowed", fontFamily: "Nunito,sans-serif" }}>
              {status === "loading" ? "Verifying…" : "Activate Lifetime Access"}
            </button>
        }
      </div>
    </div>
  );
}

// ─── Upgrade Prompt ───────────────────────────────────────────────────────────
const LS_URL = "https://yasirhaquecreativelabs.lemonsqueezy.com/checkout/buy/c19a2e49-4416-4cf7-b9b5-2f8140da3962";
const RZ_URL = "https://rzp.io/rzp/RxurFTj";

function UpgradePrompt({ onOpenUnlock }) {
  const [countdown, setCountdown] = useState(getMidnightCountdown());
  const [isIndia,   setIsIndia]   = useState(null); // null=loading, true=IN, false=international

  useEffect(() => {
    const t = setInterval(() => setCountdown(getMidnightCountdown()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(d => setIsIndia(d.country_code === "IN"))
      .catch(() => setIsIndia(false));
  }, []);

  const primaryUrl   = isIndia ? RZ_URL : LS_URL;
  const primaryPrice = isIndia ? "₹299"  : "$2.99";
  const primaryNote  = isIndia ? "UPI · Cards · Net Banking · Wallets" : "Cards · PayPal · Worldwide";
  const altUrl       = isIndia ? LS_URL  : RZ_URL;
  const altLabel     = isIndia ? "Pay internationally ($2.99) →" : "Pay in India (₹299) →";

  return (
    <div style={{ padding: "8px 0 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,transparent,rgba(201,168,76,0.25))" }}/>
        <span style={{ color: "rgba(201,168,76,0.4)", fontSize: "10px", letterSpacing: "2px", whiteSpace: "nowrap" }}>YOUR REFLECTIONS FOR TODAY</span>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,rgba(201,168,76,0.25),transparent)" }}/>
      </div>

      <div style={{ background: "linear-gradient(160deg,rgba(201,168,76,0.09),rgba(201,168,76,0.03))", border: "1px solid rgba(201,168,76,0.22)", borderRadius: "24px", overflow: "hidden" }}>
        <div style={{ padding: "28px 20px 20px", textAlign: "center", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
          <div style={{ fontSize: "22px", color: "#c9a84c", fontFamily: "Georgia,serif", marginBottom: "6px", textShadow: "0 0 20px rgba(201,168,76,0.3)" }}>طَلَبُ الْعِلْمِ فَرِيضَةٌ</div>
          <div style={{ color: "rgba(201,168,76,0.45)", fontSize: "11px", letterSpacing: "1.5px", marginBottom: "18px" }}>"Seeking knowledge is an obligation" — Ibn Mājah</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", lineHeight: 1.8, marginBottom: "20px" }}>
            You've completed your free reflections for today.<br/>Continue your journey without limits.
          </div>
          {/* Primary payment button — changes by location */}
          {isIndia === null ? (
            <div style={{ height: "52px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: "5px" }}>
                {[0,1,2].map(d => <div key={d} style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#c9a84c", animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.6 }}/>)}
              </div>
            </div>
          ) : (
            <a href={primaryUrl} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", maxWidth: "280px", background: "linear-gradient(135deg,#c9a84c,#a8862e)", borderRadius: "14px", color: "#0d1f14", padding: "14px 20px", fontSize: "15px", fontWeight: 700, textDecoration: "none", margin: "0 auto", boxShadow: "0 4px 20px rgba(201,168,76,0.3)", fontFamily: "Nunito,sans-serif" }}>
              <span>Unlock Nūr Pro</span>
              <span style={{ background: "rgba(13,31,20,0.25)", borderRadius: "8px", padding: "2px 10px", fontSize: "13px" }}>{primaryPrice}</span>
            </a>
          )}
          <div style={{ color: "rgba(201,168,76,0.3)", fontSize: "11px", marginTop: "8px" }}>
            {isIndia !== null ? primaryNote : "Detecting your location…"}
          </div>
          <div style={{ color: "rgba(201,168,76,0.3)", fontSize: "11px", marginTop: "4px" }}>One-time payment · Yours forever</div>
          <button onClick={onOpenUnlock}
            style={{ marginTop: "12px", background: "none", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "10px", padding: "9px 20px", color: "rgba(201,168,76,0.6)", fontSize: "13px", cursor: "pointer", fontFamily: "Nunito,sans-serif", width: "100%", maxWidth: "280px" }}>
            Already paid? Enter code
          </button>
          {isIndia !== null && (
            <a href={altUrl} target="_blank" rel="noreferrer"
              style={{ display: "block", marginTop: "8px", color: "rgba(201,168,76,0.35)", fontSize: "11px", textDecoration: "underline", textAlign: "center" }}>
              {altLabel}
            </a>
          )}
        </div>

        <div style={{ padding: "18px 20px" }}>
          <div style={{ color: "rgba(201,168,76,0.45)", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Everything in Pro</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {PRO_FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckIcon/>
                </div>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(201,168,76,0.1)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.15)" }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", lineHeight: 1.6 }}>Or wait for your free<br/>reflections to reset</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "rgba(201,168,76,0.4)", fontSize: "10px", letterSpacing: "1.5px", marginBottom: "2px" }}>RESETS IN</div>
            <div style={{ color: "#c9a84c", fontSize: "20px", fontFamily: "Georgia,serif", letterSpacing: "2px" }}>{countdown}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ChatTab ─────────────────────────────────────────────────────────────
export default function ChatTab({ remaining, setRemaining, unlocked, setUnlocked, profile, deviceId }) {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [showUnlock,  setShowUnlock]  = useState(false);
  const [ramadan,     setRamadan]     = useState(null);
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [showCityModal, setShowCityModal] = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  // Ramadan detection on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await checkIfRamadan();
        if (!r.isRamadan) return;
        setRamadan(r);
        // Try geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
              try {
                const t = await getPrayerTimes(coords.latitude, coords.longitude);
                setPrayerTimes(t);
              } catch {}
            },
            () => {
              // Denied — check cached city
              const city = localStorage.getItem(KEYS.CITY);
              if (city) getPrayerTimesByCity(city).then(setPrayerTimes).catch(() => {});
            }
          );
        }
      } catch {}
    })();
  }, []);

  // Midnight reset
  useEffect(() => {
    const tick = setInterval(() => {
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem(KEYS.DATE) !== today) {
        setRemaining(DAILY_LIMIT);
        setCachedRemaining(DAILY_LIMIT);
      }
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

    const agePrefix  = getAgePrefix(profile.yearOfBirth);
    const prefixed   = agePrefix ? `[Context: ${agePrefix}]\n\n${userText}` : userText;
    const newMessages = [...messages, { role: "user", content: prefixed, display: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const payload = newMessages.map(m => ({ role: m.role, content: m.content }));
      const res  = await fetch(PROXY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, messages: payload }),
      });
      const data = await res.json();

      if (res.status === 429) { setRemaining(0); setCachedRemaining(0); return; }
      if (!res.ok) { setError(`Error: ${data.error || res.status}`); return; }

      if (data.unlocked) { setUnlocked(true); localStorage.setItem(KEYS.UNLOCKED, "true"); }

      const nr = data.remaining === 999 ? 999 : data.remaining;
      setRemaining(nr);
      if (nr !== 999) setCachedRemaining(nr);
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatText = (text) => text.split("\n").map((line, i) => {
    const html = line.replace(
      /\[(Surah [^\]]+|Sahih [^\]]+|Hadith [^\]]+|[A-Za-z ]+ \d+:\d+[^\]]*)\]/g,
      m => `<span style="color:#c9a84c;font-weight:700;font-style:italic">${m}</span>`
    );
    return <p key={i} style={{ margin: "0 0 6px 0", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }}/>;
  });

  const isEmpty  = messages.length === 0;
  const isLocked = !unlocked && remaining <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {showUnlock && <UnlockModal deviceId={deviceId} onClose={() => setShowUnlock(false)} onUnlocked={() => { setUnlocked(true); setRemaining(999); }}/>}
      {showCityModal && <CityModal onSubmit={t => { setPrayerTimes(t); setShowCityModal(false); }} onClose={() => setShowCityModal(false)}/>}

      {/* Ramadan banner */}
      {ramadan?.isRamadan && (
        <RamadanBanner prayerTimes={prayerTimes} hijriDay={ramadan.hijriDay} onRequestCity={() => setShowCityModal(true)}/>
      )}

      {/* Chat scroll area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: "760px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* Empty state */}
        {isEmpty && !isLocked && (
          <div style={{ textAlign: "center", paddingTop: "32px" }}>
            <div style={{ fontSize: "28px", color: "#c9a84c", marginBottom: "8px", textShadow: "0 0 30px rgba(201,168,76,0.35)" }}>
              بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
            </div>
            <div style={{ color: "rgba(201,168,76,0.45)", fontSize: "11px", letterSpacing: "2px", marginBottom: "32px" }}>
              In the Name of Allah, the Most Gracious, the Most Merciful
            </div>
            {profile.name && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "16px" }}>
                As-salamu alaykum, <strong style={{ color: "rgba(201,168,76,0.7)" }}>{profile.name}</strong> 🌙
              </div>
            )}
            <div style={{ width: "40px", height: "1px", background: "linear-gradient(90deg,transparent,#c9a84c,transparent)", margin: "0 auto 28px" }}/>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "14px", marginBottom: "28px", lineHeight: 1.8 }}>
              Ask anything about Islam — grounded in the Quran and authentic Hadith.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "24px", color: "rgba(201,168,76,0.8)", padding: "9px 18px", fontSize: "13px", cursor: "pointer", fontFamily: "Nunito,sans-serif", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.target.style.background = "rgba(201,168,76,0.15)"; e.target.style.borderColor = "rgba(201,168,76,0.45)"; }}
                  onMouseLeave={e => { e.target.style.background = "rgba(201,168,76,0.07)"; e.target.style.borderColor = "rgba(201,168,76,0.2)"; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Locked empty state */}
        {isEmpty && isLocked && <UpgradePrompt onOpenUnlock={() => setShowUnlock(true)}/>}

        {/* Messages */}
        {!isEmpty && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {error && (
              <div style={{ background: "rgba(224,123,84,0.1)", border: "1px solid rgba(224,123,84,0.3)", borderRadius: "12px", padding: "12px 16px", color: "#e07b54", fontSize: "13px", textAlign: "center" }}>{error}</div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#1a3a22,#0d2018)", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <StarIcon/>
                  </div>
                )}
                <div style={{ maxWidth: "82%", background: msg.role === "user" ? "linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.09))" : "rgba(255,255,255,0.04)", border: msg.role === "user" ? "1px solid rgba(201,168,76,0.28)" : "1px solid rgba(255,255,255,0.08)", borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px", padding: "13px 16px", color: msg.role === "user" ? "rgba(255,255,240,0.9)" : "rgba(255,255,255,0.82)", fontSize: "14px", lineHeight: 1.7 }}>
                  {msg.role === "assistant" ? formatText(msg.content) : <p style={{ margin: 0 }}>{msg.display || msg.content}</p>}
                </div>
                {msg.role === "user" && (
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a84c" }}>
                    <UserIcon/>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#1a3a22,#0d2018)", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <StarIcon/>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 18px 18px 18px", padding: "14px 18px", display: "flex", gap: "6px", alignItems: "center" }}>
                  {[0, 1, 2].map(d => <div key={d} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#c9a84c", animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${d * 0.2}s`, opacity: 0.7 }}/>)}
                </div>
              </div>
            )}

            {isLocked && !loading && <UpgradePrompt onOpenUnlock={() => setShowUnlock(true)}/>}
            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {/* Input bar */}
      {!isLocked && (
        <div style={{ background: "rgba(8,21,16,0.96)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(201,168,76,0.1)", padding: "12px 16px 14px", flexShrink: 0 }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "14px", padding: "11px 14px" }}>
                <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); autoResize(); }} onKeyDown={handleKeyDown}
                  placeholder="Ask about Quran, Hadith, Islamic practice…" rows={1} disabled={loading}
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "rgba(255,255,240,0.88)", fontSize: "14px", resize: "none", fontFamily: "Nunito,sans-serif", lineHeight: 1.6 }}/>
              </div>
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                style={{ width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0, background: input.trim() && !loading ? "linear-gradient(135deg,#c9a84c,#a8862e)" : "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", color: input.trim() && !loading ? "#0d1f14" : "rgba(201,168,76,0.25)", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                <SendIcon/>
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: "8px", color: "rgba(201,168,76,0.22)", fontSize: "10px", letterSpacing: "0.8px" }}>
              Always consult a qualified scholar · Allahu A'lam
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
