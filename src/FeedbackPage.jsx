import { useState } from "react";

const SEND_FEEDBACK_URL = "https://dvcuisgpptxhjgiasqlp.supabase.co/functions/v1/send-feedback";

const CATEGORIES = [
  { key:"bug",     icon:"🐛", label:"Bug Report"       },
  { key:"feature", icon:"💡", label:"Feature Request"  },
  { key:"content", icon:"📖", label:"Content Issue"    },
  { key:"general", icon:"💬", label:"General Feedback" },
];

export default function FeedbackPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const [category, setCategory] = useState("general");
  const [message,  setMessage]  = useState("");
  const [email,    setEmail]    = useState("");
  const [skipEmail,setSkipEmail]= useState(false);
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = message.trim() && (skipEmail || emailValid) && !loading;

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.05)";
  const labelStyle = { color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"10px", display:"block" };

  const submit = async () => {
    if (!message.trim() || loading) return;
    if (!skipEmail && !emailValid) { setError("Please enter a valid email address, or choose to skip it below."); return; }
    setLoading(true);
    setError("");
    try {
      const cat = CATEGORIES.find(c => c.key === category);
      const res = await fetch(SEND_FEEDBACK_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category:   `${cat.icon} ${cat.label}`,
          message:    message.trim(),
          email:      skipEmail ? "" : email.trim(),
          skip_email: skipEmail,
          device_id:  localStorage.getItem("nur_device_id") || undefined,
          browser:    navigator.userAgent.slice(0, 200),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSent(true);
      setMessage("");
      setEmail("");
      setSkipEmail(false);
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      setError(err.message || "Could not send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Feedback & Support</div>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 48px" }}>

        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"14px 16px", marginBottom:"28px" }}>
          <div style={{ color:gold, fontSize:`${13 * textSize}px`, fontWeight:700, marginBottom:"5px" }}>Help us improve NŪR</div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            Found a bug? Have an idea? Something feel off? We read every message. JazakAllahu Khairan for helping us build a better product for the Ummah.
          </div>
        </div>

        <span style={labelStyle}>Category</span>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"24px" }}>
          {CATEGORIES.map(cat => {
            const active = category === cat.key;
            return (
              <button key={cat.key} onClick={() => setCategory(cat.key)}
                style={{ padding:"12px 10px", borderRadius:"12px", textAlign:"left", cursor:"pointer", fontFamily:"Nunito,sans-serif",
                  background: active ? `linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})` : goldFaint,
                  border: `1px solid ${active ? gold : goldBdr}`,
                  color: active ? (lightMode?"#fff":"#0d1f14") : goldDim,
                  transition:"all 0.2s" }}>
                <div style={{ fontSize:"18px", marginBottom:"4px" }}>{cat.icon}</div>
                <div style={{ fontSize:`${12 * textSize}px`, fontWeight:700 }}>{cat.label}</div>
              </button>
            );
          })}
        </div>

        <span style={labelStyle}>Your Message</span>
        <textarea
          value={message}
          onChange={e => { setMessage(e.target.value); setError(""); }}
          placeholder="Describe the issue or share your idea…"
          rows={6}
          disabled={loading}
          style={{ width:"100%", background:inputBg, border:`1px solid ${error ? "rgba(224,123,84,0.6)" : goldBdr}`, borderRadius:"14px", padding:"14px 16px", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif", outline:"none", resize:"none", boxSizing:"border-box", lineHeight:1.7, marginBottom:"14px", opacity:loading?0.6:1 }}
        />

        <span style={labelStyle}>Your Email {!skipEmail && <span style={{ color: gold }}>*</span>}{skipEmail && <span style={{ color: textDim, textTransform:"none", letterSpacing:"0" }}> (skipped)</span>}</span>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          disabled={loading || skipEmail}
          style={{ width:"100%", background:inputBg, border:`1px solid ${error && !skipEmail && !emailValid ? "rgba(224,123,84,0.6)" : goldBdr}`, borderRadius:"14px", padding:"14px 16px", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif", outline:"none", boxSizing:"border-box", marginBottom:"10px", opacity:(loading || skipEmail)?0.45:1 }}
        />

        <label style={{ display:"flex", alignItems:"center", gap:"9px", marginBottom:"6px", cursor: loading ? "default" : "pointer" }}>
          <input
            type="checkbox"
            checked={skipEmail}
            disabled={loading}
            onChange={e => { setSkipEmail(e.target.checked); if (e.target.checked) setEmail(""); setError(""); }}
            style={{ width:"16px", height:"16px", accentColor: gold, cursor: loading ? "default" : "pointer", flexShrink:0 }}
          />
          <span style={{ color: textDim, fontSize:`${11.5 * textSize}px` }}>I don't have an email / prefer not to share one</span>
        </label>

        <div style={{ color:textDim, fontSize:`${10.5 * textSize}px`, lineHeight:1.6, marginBottom:"14px" }}>
          {skipEmail
            ? "No problem — we just won't be able to reply to you directly."
            : "We'll only use this to reply to your message."}
        </div>

        {error && (
          <div style={{ background:"rgba(224,123,84,0.08)", border:"1px solid rgba(224,123,84,0.3)", borderRadius:"10px", padding:"10px 14px", marginBottom:"12px", color:"#e07b54", fontSize:`${12 * textSize}px` }}>
            {error}
          </div>
        )}

        {sent ? (
          <div style={{ textAlign:"center", padding:"14px", background:"rgba(76,175,132,0.1)", border:"1px solid rgba(76,175,132,0.3)", borderRadius:"12px", color:"#4caf84", fontSize:`${14 * textSize}px`, fontWeight:700 }}>
            ✦ JazakAllahu Khairan! Your feedback is on its way 🌙
          </div>
        ) : (
          <button onClick={submit} disabled={!canSubmit}
            style={{ width:"100%", padding:"14px", borderRadius:"14px",
              background: canSubmit ? `linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})` : goldFaint,
              border: `1px solid ${canSubmit ? gold : goldBdr}`,
              color: canSubmit ? (lightMode?"#fff":"#0d1f14") : goldDim,
              fontSize:`${15 * textSize}px`, fontWeight:800,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily:"Nunito,sans-serif", transition:"all 0.2s" }}>
            {loading ? "Sending…" : "Send Feedback"}
          </button>
        )}

        <div style={{ height:"1px", background:goldBdr, margin:"28px 0" }}/>

        <div style={{ color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"14px" }}>Also find us on</div>

        <a href="https://instagram.com/nur.islamic.ai" target="_blank" rel="noreferrer"
          style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", textDecoration:"none" }}>
          <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
            📸
          </div>
          <div>
            <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:700 }}>Instagram</div>
            <div style={{ color:goldDim, fontSize:`${11*textSize}px` }}>@nur.islamic.ai · DM us anytime</div>
          </div>
          <div style={{ color:goldDim, fontSize:"18px", marginLeft:"auto" }}>›</div>
        </a>

        <div style={{ textAlign:"center", marginTop:"32px", color:textDim, fontSize:`${11*textSize}px`, lineHeight:1.8 }}>
          NŪR is in Beta — your feedback directly shapes what gets built next.<br/>
          <span style={{ color:gold }}>بَارَكَ اللَّهُ فِيكَ</span>
        </div>

      </div>
    </div>
  );
}
