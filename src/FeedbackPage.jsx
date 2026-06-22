import { useState } from "react";

// ─── Replace with your support email ─────────────────────────────────────────
const FEEDBACK_EMAIL = "nur.islamic.ai@gmail.com";

const CATEGORIES = [
  { key:"bug",     icon:"🐛", label:"Bug Report",       subject:"NŪR Bug Report"       },
  { key:"feature", icon:"💡", label:"Feature Request",  subject:"NŪR Feature Request"  },
  { key:"content", icon:"📖", label:"Content Issue",    subject:"NŪR Content Issue"    },
  { key:"general", icon:"💬", label:"General Feedback", subject:"NŪR Feedback"         },
];

export default function FeedbackPage({ onBack, lightMode, textSize = 1 }) {
  const [category, setCategory] = useState("general");
  const [message,  setMessage]  = useState("");
  const [sent,     setSent]     = useState(false);

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const inputBg  = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.05)";
  const labelStyle = { color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"10px", display:"block" };

  const submit = () => {
    if (!message.trim()) return;
    const cat     = CATEGORIES.find(c => c.key === category);
    const subject = encodeURIComponent(cat.subject);
    const body    = encodeURIComponent(
      `Category: ${cat.icon} ${cat.label}\n\nMessage:\n${message}\n\n---\nSent from NŪR app (Beta)`
    );
    window.open(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
    setSent(true);
    setMessage("");
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Feedback & Support</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 48px" }}>

        {/* Intro */}
        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"14px 16px", marginBottom:"28px" }}>
          <div style={{ color:gold, fontSize:`${13 * textSize}px`, fontWeight:700, marginBottom:"5px" }}>Help us improve NŪR</div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            Found a bug? Have an idea? Something feel off? We read every message. JazakAllahu Khairan for helping us build a better product for the Ummah.
          </div>
        </div>

        {/* Category */}
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

        {/* Message */}
        <span style={labelStyle}>Your Message</span>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe the issue or share your idea…"
          rows={6}
          style={{ width:"100%", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"14px 16px", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif", outline:"none", resize:"none", boxSizing:"border-box", lineHeight:1.7, marginBottom:"14px" }}
        />

        {/* Submit */}
        {sent ? (
          <div style={{ textAlign:"center", padding:"14px", background:"rgba(76,175,132,0.1)", border:"1px solid rgba(76,175,132,0.3)", borderRadius:"12px", color:"#4caf84", fontSize:`${14 * textSize}px`, fontWeight:700 }}>
            ✦ JazakAllahu Khairan! Your feedback is on its way 🌙
          </div>
        ) : (
          <button onClick={submit} disabled={!message.trim()}
            style={{ width:"100%", padding:"14px", borderRadius:"14px",
              background: message.trim() ? `linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})` : goldFaint,
              border: `1px solid ${message.trim() ? gold : goldBdr}`,
              color: message.trim() ? (lightMode?"#fff":"#0d1f14") : goldDim,
              fontSize:`${15 * textSize}px`, fontWeight:800, cursor: message.trim() ? "pointer" : "not-allowed",
              fontFamily:"Nunito,sans-serif", transition:"all 0.2s" }}>
            Send Feedback ↗
          </button>
        )}

        <div style={{ color:textDim, fontSize:"11px", textAlign:"center", marginTop:"10px" }}>
          Opens your email app with the message pre-filled
        </div>

        {/* Divider */}
        <div style={{ height:"1px", background:goldBdr, margin:"28px 0" }}/>

        {/* Other ways */}
        <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"14px" }}>Other ways to reach us</div>

        <a href="https://instagram.com/nur.islamic.ai" target="_blank" rel="noreferrer"
          style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", textDecoration:"none", marginBottom:"10px" }}>
          <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
            📸
          </div>
          <div>
            <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:700 }}>Instagram</div>
            <div style={{ color:goldDim, fontSize:"11px" }}>@nur.islamic.ai · DM us anytime</div>
          </div>
          <div style={{ color:goldDim, fontSize:"18px", marginLeft:"auto" }}>›</div>
        </a>

        <a href={`mailto:${FEEDBACK_EMAIL}`}
          style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", textDecoration:"none" }}>
          <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
            ✉️
          </div>
          <div>
            <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:700 }}>Email</div>
            <div style={{ color:goldDim, fontSize:"11px" }}>{FEEDBACK_EMAIL}</div>
          </div>
          <div style={{ color:goldDim, fontSize:"18px", marginLeft:"auto" }}>›</div>
        </a>

        <div style={{ textAlign:"center", marginTop:"32px", color:textDim, fontSize:"11px", lineHeight:1.8 }}>
          NŪR is in Beta — your feedback directly shapes what gets built next.<br/>
          <span style={{ color:gold }}>بَارَكَ اللَّهُ فِيكَ</span>
        </div>

      </div>
    </div>
  );
}
