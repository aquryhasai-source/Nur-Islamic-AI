import { useState, useRef, useEffect } from "react";

const PROXY_URL     = "https://dvcuisgpptxhjgiasqlp.supabase.co/functions/v1/nur-proxy";
const STRIPE_PORTAL = "https://billing.stripe.com/p/login/YOUR_PORTAL_LINK";

const DAILY_LIMIT           = 15;
const STORAGE_KEY_ID        = "nur_device_id";
const STORAGE_KEY_REMAINING = "nur_remaining";
const STORAGE_KEY_DATE      = "nur_date";
const STORAGE_KEY_UNLOCKED  = "nur_unlocked";

const SYSTEM_PROMPT = `You are Nūr, a warm and knowledgeable Islamic assistant. You answer questions grounded strictly in the Quran and authentic Hadith (primarily Sahih Bukhari and Sahih Muslim).

Guidelines:
- Always cite sources in square brackets e.g. [Surah Al-Baqarah 2:286] or [Sahih Bukhari 1234]
- Be respectful, warm and encouraging in tone
- If a question requires a personal ruling (fatwa), advise the user to consult a qualified scholar
- Keep answers clear and accessible — not overly academic
- Respond in the same language the user writes in
- End responses with "Allahu A'lam" (Allah knows best) where appropriate`;

function getAnonymousId() {
  let id = localStorage.getItem(STORAGE_KEY_ID);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(STORAGE_KEY_ID, id); }
  return id;
}

function getCachedRemaining() {
  if (localStorage.getItem(STORAGE_KEY_UNLOCKED) === "true") return 999;
  const today = new Date().toISOString().split("T")[0];
  if (localStorage.getItem(STORAGE_KEY_DATE) !== today) {
    localStorage.setItem(STORAGE_KEY_DATE, today);
    localStorage.setItem(STORAGE_KEY_REMAINING, String(DAILY_LIMIT));
    return DAILY_LIMIT;
  }
  return parseInt(localStorage.getItem(STORAGE_KEY_REMAINING) ?? String(DAILY_LIMIT), 10);
}

function setCachedRemaining(val) {
  localStorage.setItem(STORAGE_KEY_DATE, new Date().toISOString().split("T")[0]);
  localStorage.setItem(STORAGE_KEY_REMAINING, String(val));
}

function getMidnightCountdown() {
  const now = new Date(), midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight - now;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const GeometricPattern = () => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    style={{ position:"absolute", width:"100%", height:"100%", opacity:0.055, top:0, left:0, pointerEvents:"none" }}>
    <defs>
      <pattern id="geo" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
        <polygon points="25,2 48,14 48,36 25,48 2,36 2,14" fill="none" stroke="#c9a84c" strokeWidth="0.8"/>
        <polygon points="25,10 40,18 40,32 25,40 10,32 10,18" fill="none" stroke="#c9a84c" strokeWidth="0.5"/>
        <line x1="25" y1="2" x2="25" y2="48" stroke="#c9a84c" strokeWidth="0.3"/>
        <line x1="2"  y1="14" x2="48" y2="36" stroke="#c9a84c" strokeWidth="0.3"/>
        <line x1="48" y1="14" x2="2"  y2="36" stroke="#c9a84c" strokeWidth="0.3"/>
        <circle cx="25" cy="25" r="3" fill="none" stroke="#c9a84c" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#geo)"/>
  </svg>
);

const StarIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="#c9a84c"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
const SendIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>;
const MoonIcon  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="#c9a84c"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const UserIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="#c9a84c"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
const KeyIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="#c9a84c"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>;

const SUGGESTIONS = [
  "What does the Quran say about patience?",
  "How should I perform Salah correctly?",
  "What are the pillars of Islam?",
  "What does Islam say about kindness to parents?",
  "Explain the concept of Tawakkul",
];

// ─── UNLOCK MODAL ─────────────────────────────────────────────────────────────
function UnlockModal({ deviceId, onClose, onUnlocked }) {
  const [code,   setCode]   = useState("");
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  const submit = async () => {
    if (!code.trim()) return;
    setStatus("loading"); setErrMsg("");
    try {
      const res  = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ device_id: deviceId, unlock_code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.unlocked) {
        setErrMsg(data.error || "Invalid code. Please check and try again.");
        setStatus("error");
      } else {
        localStorage.setItem(STORAGE_KEY_UNLOCKED, "true");
        setStatus("success");
        setTimeout(() => { onUnlocked(); onClose(); }, 1800);
      }
    } catch {
      setErrMsg("Connection error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"linear-gradient(160deg,#0d1f14,#081510)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:"20px", padding:"28px 24px", width:"100%", maxWidth:"360px", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:"14px", right:"16px", background:"none", border:"none", color:"rgba(201,168,76,0.4)", fontSize:"20px", cursor:"pointer" }}>✕</button>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
          <KeyIcon/>
          <span style={{ color:"#c9a84c", fontSize:"18px", fontFamily:"Georgia,serif" }}>Enter Unlock Code</span>
        </div>
        <p style={{ color:"rgba(255,255,255,0.45)", fontSize:"13px", lineHeight:1.7, marginBottom:"20px" }}>
          Paste the code from your purchase email. On a new device?{" "}
          <a href={STRIPE_PORTAL} target="_blank" rel="noreferrer" style={{ color:"#c9a84c", textDecoration:"underline" }}>
            Visit Customer Portal
          </a>.
        </p>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="e.g. NUR-XXXX-XXXX"
          maxLength={20}
          style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${status==="error"?"#e07b54":"rgba(201,168,76,0.25)"}`, borderRadius:"12px", padding:"13px 16px", color:"#fff", fontSize:"16px", fontFamily:"monospace", letterSpacing:"2px", outline:"none", marginBottom:"14px", boxSizing:"border-box" }}
        />
        {errMsg && <div style={{ color:"#e07b54", fontSize:"13px", marginBottom:"12px" }}>{errMsg}</div>}
        {status === "success" ? (
          <div style={{ textAlign:"center", color:"#4caf84", fontSize:"15px", padding:"10px 0", fontFamily:"Georgia,serif" }}>
            ✦ Unlocked! Jazakallahu Khairan 🌙
          </div>
        ) : (
          <button onClick={submit} disabled={!code.trim() || status==="loading"}
            style={{ width:"100%", padding:"13px", borderRadius:"12px", background:code.trim()?"linear-gradient(135deg,#c9a84c,#a8862e)":"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)", color:code.trim()?"#0d1f14":"rgba(201,168,76,0.3)", fontSize:"15px", fontFamily:"Georgia,serif", cursor:code.trim()?"pointer":"not-allowed", fontWeight:"600", transition:"all 0.2s" }}>
            {status === "loading" ? "Verifying..." : "Activate Lifetime Access"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── UPGRADE PROMPT ───────────────────────────────────────────────────────────
function UpgradePrompt({ onOpenUnlock }) {
  const [countdown, setCountdown] = useState(getMidnightCountdown());
  useEffect(() => {
    const t = setInterval(() => setCountdown(getMidnightCountdown()), 60000);
    return () => clearInterval(t);
  }, []);

  const proFeatures = [
    "Unlimited reflections — no daily cap",
    "Full Quran browser — all 114 Surahs",
    "Hadith library — Bukhari, Muslim & more",
    "Save & bookmark answers",
    "Rewards, streaks & Ramadan mode",
  ];

  return (
    <div style={{ padding:"8px 0 32px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"28px" }}>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg,transparent,rgba(201,168,76,0.25))" }}/>
        <span style={{ color:"rgba(201,168,76,0.4)", fontSize:"11px", letterSpacing:"2px", whiteSpace:"nowrap" }}>YOUR REFLECTIONS FOR TODAY</span>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg,rgba(201,168,76,0.25),transparent)" }}/>
      </div>

      <div style={{ background:"linear-gradient(160deg,rgba(201,168,76,0.09),rgba(201,168,76,0.03))", border:"1px solid rgba(201,168,76,0.22)", borderRadius:"24px", overflow:"hidden" }}>
        <div style={{ padding:"28px 24px 20px", textAlign:"center", borderBottom:"1px solid rgba(201,168,76,0.1)" }}>
          <div style={{ fontSize:"24px", color:"#c9a84c", fontFamily:"Georgia,serif", marginBottom:"6px", textShadow:"0 0 20px rgba(201,168,76,0.3)" }}>
            طَلَبُ الْعِلْمِ فَرِيضَةٌ
          </div>
          <div style={{ color:"rgba(201,168,76,0.45)", fontSize:"12px", letterSpacing:"1.5px", marginBottom:"20px" }}>
            "Seeking knowledge is an obligation" — Ibn Mājah
          </div>
          <div style={{ color:"rgba(255,255,255,0.6)", fontSize:"15px", lineHeight:1.8, marginBottom:"20px", maxWidth:"300px", margin:"0 auto 20px" }}>
            You've completed your free reflections for today. Continue your journey without limits.
          </div>
          <a href="https://buy.stripe.com/YOUR_PAYMENT_LINK" target="_blank" rel="noreferrer"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", width:"100%", maxWidth:"300px", background:"linear-gradient(135deg,#c9a84c,#a8862e)", border:"none", borderRadius:"16px", color:"#0d1f14", padding:"16px 24px", fontSize:"16px", fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"0.5px", boxShadow:"0 4px 20px rgba(201,168,76,0.3)", margin:"0 auto", textDecoration:"none" }}>
            <span>Unlock Nūr Pro</span>
            <span style={{ background:"rgba(13,31,20,0.25)", borderRadius:"10px", padding:"3px 10px", fontSize:"14px" }}>$2.99</span>
          </a>
          <div style={{ color:"rgba(201,168,76,0.3)", fontSize:"11px", letterSpacing:"1px", marginTop:"10px" }}>
            One-time payment · Yours forever
          </div>
          <button onClick={onOpenUnlock}
            style={{ marginTop:"14px", background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"12px", padding:"9px 20px", color:"rgba(201,168,76,0.6)", fontSize:"13px", cursor:"pointer", fontFamily:"Georgia,serif", width:"100%", maxWidth:"300px" }}>
            Already paid? Enter unlock code
          </button>
        </div>

        <div style={{ padding:"20px 24px" }}>
          <div style={{ color:"rgba(201,168,76,0.5)", fontSize:"11px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"14px" }}>Everything in Pro</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"11px" }}>
            {proFeatures.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"20px", height:"20px", borderRadius:"50%", background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <CheckIcon/>
                </div>
                <span style={{ color:"rgba(255,255,255,0.65)", fontSize:"14px" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop:"1px solid rgba(201,168,76,0.1)", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(0,0,0,0.15)" }}>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"12px", lineHeight:1.6 }}>
            Or wait for your free<br/>reflections to reset
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"rgba(201,168,76,0.4)", fontSize:"10px", letterSpacing:"1.5px", marginBottom:"2px" }}>RESETS IN</div>
            <div style={{ color:"#c9a84c", fontSize:"20px", fontFamily:"Georgia,serif", letterSpacing:"2px" }}>{countdown}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function NurApp() {
  const deviceId = useRef(getAnonymousId());

  const [remaining,  setRemaining]  = useState(() => getCachedRemaining());
  const [unlocked,   setUnlocked]   = useState(() => localStorage.getItem(STORAGE_KEY_UNLOCKED) === "true");
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const tick = setInterval(() => {
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem(STORAGE_KEY_DATE) !== today) {
        setRemaining(DAILY_LIMIT);
        setCachedRemaining(DAILY_LIMIT);
      }
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
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

    const newMessages = [...messages, { role:"user", content:userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res  = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ device_id: deviceId.current, messages: newMessages }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setRemaining(0); setCachedRemaining(0);
        setMessages(newMessages.slice(0, -1));
        return;
      }
      if (!res.ok) throw new Error(data.error || "Server error");

      if (data.unlocked) {
        setUnlocked(true);
        localStorage.setItem(STORAGE_KEY_UNLOCKED, "true");
      }

      const newRemaining = data.remaining === 999 ? 999 : data.remaining;
      setRemaining(newRemaining);
      if (newRemaining !== 999) setCachedRemaining(newRemaining);
      setMessages([...newMessages, { role:"assistant", content:data.reply }]);

    } catch {
      setError("Could not connect. Please check your internet and try again.");
      setMessages(newMessages.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatText = (text) => text.split("\n").map((line, i) => {
    const html = line.replace(
      /\[(Surah [^\]]+|Sahih [^\]]+|Hadith [^\]]+|[A-Za-z ]+ \d+:\d+[^\]]*)\]/g,
      m => `<span style="color:#c9a84c;font-weight:600;font-style:italic">${m}</span>`
    );
    return <p key={i} style={{ margin:"0 0 6px 0", lineHeight:1.75 }} dangerouslySetInnerHTML={{ __html:html }}/>;
  });

  const isEmpty  = messages.length === 0;
  const isLocked = !unlocked && remaining <= 0;

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"linear-gradient(160deg,#0d1f14 0%,#081510 50%,#0a1a10 100%)", fontFamily:"Georgia,'Times New Roman',serif", position:"relative", overflow:"hidden" }}>
      <GeometricPattern/>
      <div style={{ position:"fixed", top:"-20%", left:"50%", transform:"translateX(-50%)", width:"600px", height:"400px", background:"radial-gradient(ellipse,rgba(201,168,76,0.07) 0%,transparent 70%)", pointerEvents:"none", zIndex:0 }}/>

      {showUnlock && (
        <UnlockModal
          deviceId={deviceId.current}
          onClose={() => setShowUnlock(false)}
          onUnlocked={() => { setUnlocked(true); setRemaining(999); }}
        />
      )}

      {/* ── HEADER — clean, no counter ── */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid rgba(201,168,76,0.13)", background:"rgba(8,21,16,0.9)", backdropFilter:"blur(14px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <MoonIcon/>
          <div>
            <div style={{ color:"#c9a84c", fontSize:"22px", letterSpacing:"2px", fontVariant:"small-caps" }}>NŪR</div>
            <div style={{ color:"rgba(201,168,76,0.45)", fontSize:"10px", letterSpacing:"3px", textTransform:"uppercase" }}>Islamic Knowledge Assistant</div>
          </div>
        </div>
        {unlocked && (
          <div style={{ fontSize:"11px", color:"rgba(76,175,132,0.7)", letterSpacing:"1px" }}>✦ Lifetime Access</div>
        )}
      </header>

      {/* ── CHAT AREA ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px 16px", maxWidth:"760px", width:"100%", margin:"0 auto", position:"relative", zIndex:1 }}>

        {isEmpty && !isLocked && (
          <div style={{ textAlign:"center", paddingTop:"40px" }}>
            <div style={{ fontSize:"30px", color:"#c9a84c", marginBottom:"8px", textShadow:"0 0 30px rgba(201,168,76,0.35)" }}>
              بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
            </div>
            <div style={{ color:"rgba(201,168,76,0.45)", fontSize:"12px", letterSpacing:"2px", marginBottom:"36px" }}>
              In the Name of Allah, the Most Gracious, the Most Merciful
            </div>
            <div style={{ width:"50px", height:"1px", background:"linear-gradient(90deg,transparent,#c9a84c,transparent)", margin:"0 auto 36px" }}/>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"15px", marginBottom:"32px", lineHeight:1.8 }}>
              Ask anything about Islam — grounded in the Quran and authentic Hadith.
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", justifyContent:"center" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  style={{ background:"rgba(201,168,76,0.07)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"24px", color:"rgba(201,168,76,0.8)", padding:"9px 18px", fontSize:"13px", cursor:"pointer", transition:"all 0.2s", fontFamily:"Georgia,serif" }}
                  onMouseEnter={e => { e.target.style.background="rgba(201,168,76,0.15)"; e.target.style.borderColor="rgba(201,168,76,0.45)"; }}
                  onMouseLeave={e => { e.target.style.background="rgba(201,168,76,0.07)"; e.target.style.borderColor="rgba(201,168,76,0.2)"; }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {isEmpty && isLocked && (
          <div style={{ paddingTop:"40px" }}>
            <UpgradePrompt onOpenUnlock={() => setShowUnlock(true)}/>
          </div>
        )}

        {!isEmpty && (
          <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
            {error && (
              <div style={{ background:"rgba(224,123,84,0.1)", border:"1px solid rgba(224,123,84,0.3)", borderRadius:"12px", padding:"12px 16px", color:"#e07b54", fontSize:"14px", textAlign:"center" }}>
                {error}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display:"flex", gap:"12px", alignItems:"flex-start", justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
                {msg.role==="assistant" && (
                  <div style={{ width:"34px", height:"34px", borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,#1a3a22,#0d2018)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <StarIcon/>
                  </div>
                )}
                <div style={{ maxWidth:"82%", background:msg.role==="user"?"linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.09))":"rgba(255,255,255,0.04)", border:msg.role==="user"?"1px solid rgba(201,168,76,0.28)":"1px solid rgba(255,255,255,0.08)", borderRadius:msg.role==="user"?"18px 4px 18px 18px":"4px 18px 18px 18px", padding:"14px 18px", color:msg.role==="user"?"rgba(255,255,240,0.9)":"rgba(255,255,255,0.82)", fontSize:"15px", lineHeight:1.7 }}>
                  {msg.role==="assistant" ? formatText(msg.content) : <p style={{ margin:0 }}>{msg.content}</p>}
                </div>
                {msg.role==="user" && (
                  <div style={{ width:"34px", height:"34px", borderRadius:"50%", flexShrink:0, background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.25)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c9a84c" }}>
                    <UserIcon/>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display:"flex", gap:"12px", alignItems:"flex-start" }}>
                <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"linear-gradient(135deg,#1a3a22,#0d2018)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <StarIcon/>
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"4px 18px 18px 18px", padding:"16px 20px", display:"flex", gap:"6px", alignItems:"center" }}>
                  {[0,1,2].map(d => <div key={d} style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#c9a84c", animation:"pulse 1.4s ease-in-out infinite", animationDelay:`${d*0.2}s`, opacity:0.7 }}/>)}
                </div>
              </div>
            )}

            {isLocked && !loading && <UpgradePrompt onOpenUnlock={() => setShowUnlock(true)}/>}
            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {!isLocked && (
        <div style={{ position:"sticky", bottom:0, background:"rgba(8,21,16,0.96)", backdropFilter:"blur(16px)", borderTop:"1px solid rgba(201,168,76,0.1)", padding:"14px 20px 16px", zIndex:10 }}>
          <div style={{ maxWidth:"760px", margin:"0 auto" }}>
            <div style={{ display:"flex", gap:"10px", alignItems:"flex-end" }}>
              <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"16px", padding:"12px 16px" }}>
                <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); autoResize(); }} onKeyDown={handleKeyDown} placeholder="Ask about Quran, Hadith, Islamic practice..." rows={1} disabled={loading}
                  style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:"rgba(255,255,240,0.88)", fontSize:"15px", resize:"none", fontFamily:"Georgia,serif", lineHeight:1.6 }}/>
              </div>
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                style={{ width:"46px", height:"46px", borderRadius:"14px", flexShrink:0, background:input.trim()&&!loading?"linear-gradient(135deg,#c9a84c,#a8862e)":"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.25)", color:input.trim()&&!loading?"#0d1f14":"rgba(201,168,76,0.25)", cursor:input.trim()&&!loading?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
                <SendIcon/>
              </button>
            </div>
            <div style={{ textAlign:"center", marginTop:"10px", color:"rgba(201,168,76,0.25)", fontSize:"11px", letterSpacing:"1px" }}>
              Always consult a qualified scholar for personal rulings · Allahu A'lam
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.18);border-radius:4px}
        textarea::placeholder{color:rgba(201,168,76,0.28)!important} textarea:disabled{opacity:0.5}
      `}</style>
    </div>
  );
}
