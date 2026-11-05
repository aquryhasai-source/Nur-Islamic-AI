import { useState } from "react";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

const SEND_FEEDBACK_URL = "https://dvcuisgpptxhjgiasqlp.supabase.co/functions/v1/send-feedback";

const CATEGORIES = [
  { key:"bug",     icon:"🐛", label:"Bug Report"       },
  { key:"feature", icon:"💡", label:"Feature Request"  },
  { key:"content", icon:"📖", label:"Content Issue"    },
  { key:"general", icon:"💬", label:"General Feedback" },
];

export default function FeedbackPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const docked = useMedia(DOCK_QUERY);
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

  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const inputBg = "var(--panel2)";
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

  if (docked) {
    const ts = textSize || 1;
    const Ico = ({ size = 18, children }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    );
    const CAT_ICON = {
      bug:     <><rect x="8" y="8" width="8" height="11" rx="4"/><path d="M9.5 5.5 11 8M14.5 5.5 13 8M4.5 11H8M16 11h3.5M4.5 17H8M16 17h3.5M12 12v7"/></>,
      feature: <><path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17.5h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5Z"/></>,
      content: <><path d="M12 6.5C10.5 5 8 4.5 4.5 4.5v13c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2v-13c-3.5 0-6 .5-7.5 2Z"/><path d="M12 6.5v13"/></>,
      general: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"/>,
    };
    const fieldBorder = (bad) => `1px solid ${bad ? "color-mix(in srgb,var(--warn) 60%,transparent)" : "var(--line)"}`;
    const emailBad = !!error && !skipEmail && !emailValid;
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
          <div className="nur-ph-title">
            <span>Feedback &amp; Support</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"13.5px", fontWeight:500, color:"var(--dim)" }}>Found a bug? Have an idea? Tell us what you think.</span></span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.5fr) minmax(0,1fr)", gap:"22px", alignItems:"start" }}>
            <section className="card" style={{ padding:"24px 26px 28px" }}>
              <span className="lbl">Category</span>
              <div style={{ marginTop:"12px", display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:"10px" }}>
                {CATEGORIES.map(cat => {
                  const on = category === cat.key;
                  return (
                    <button key={cat.key} className="pc" aria-pressed={on} onClick={() => setCategory(cat.key)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", height:"84px", borderRadius:"13px", border:`1px solid ${on ? "var(--gold)" : "var(--line)"}`, background: on ? "var(--goldFill)" : "var(--panel)", color: on ? "var(--onGold)" : "var(--dim)", fontFamily:"inherit", cursor:"pointer" }}>
                      <Ico size={22}>{CAT_ICON[cat.key]}</Ico>
                      <span style={{ fontSize:`${12.5*ts}px`, fontWeight:700 }}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <label style={{ display:"block", marginTop:"24px" }}>
                <span className="lbl" style={{ display:"block", marginBottom:"10px" }}>Your message</span>
                <textarea rows={7} value={message} disabled={loading}
                  onChange={e => { setMessage(e.target.value); setError(""); }}
                  placeholder="Describe the issue or share your idea…"
                  style={{ boxSizing:"border-box", display:"block", width:"100%", padding:"14px 16px", borderRadius:"14px", border:fieldBorder(!!error && !emailBad), background:"var(--panel2)", color:textClr, fontFamily:"inherit", fontSize:`${14*ts}px`, lineHeight:1.7, outline:0, resize:"vertical", opacity:loading ? 0.6 : 1 }}/>
              </label>

              <label style={{ display:"block", marginTop:"20px" }}>
                <span className="lbl" style={{ display:"block", marginBottom:"10px" }}>Your email {!skipEmail && <span style={{ color:gold }}>*</span>}{skipEmail && <span style={{ textTransform:"none", letterSpacing:0 }}> (skipped)</span>}</span>
                <input type="email" value={email} disabled={loading || skipEmail}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@example.com"
                  style={{ boxSizing:"border-box", display:"block", width:"100%", height:"48px", padding:"0 16px", borderRadius:"14px", border:fieldBorder(emailBad), background:"var(--panel2)", color:textClr, fontFamily:"inherit", fontSize:`${14*ts}px`, outline:0, opacity:(loading || skipEmail) ? 0.45 : 1 }}/>
              </label>
              <label style={{ marginTop:"12px", display:"flex", alignItems:"center", gap:"9px", cursor: loading ? "default" : "pointer" }}>
                <input type="checkbox" checked={skipEmail} disabled={loading}
                  onChange={e => { setSkipEmail(e.target.checked); if (e.target.checked) setEmail(""); setError(""); }}
                  style={{ width:"16px", height:"16px", margin:0, accentColor:gold, cursor: loading ? "default" : "pointer", flexShrink:0 }}/>
                <span style={{ fontSize:`${12.5*ts}px`, fontWeight:500, color:textDim }}>I don't have an email / prefer not to share one</span>
              </label>
              <div style={{ marginTop:"8px", fontSize:`${12*ts}px`, fontWeight:500, lineHeight:1.6, color:"var(--faint)" }}>
                {skipEmail ? "No problem — we just won't be able to reply to you directly." : "We'll only use this to reply to your message."}
              </div>

              {error && (
                <div style={{ marginTop:"16px", padding:"10px 14px", borderRadius:"10px", border:"1px solid color-mix(in srgb,var(--warn) 30%,transparent)", background:"color-mix(in srgb,var(--warn) 8%,transparent)", color:"var(--warn)", fontSize:`${12.5*ts}px` }}>{error}</div>
              )}

              {sent ? (
                <div style={{ marginTop:"24px", display:"flex", alignItems:"center", justifyContent:"center", gap:"9px", padding:"14px", borderRadius:"12px", border:"1px solid color-mix(in srgb,var(--green) 30%,transparent)", background:"color-mix(in srgb,var(--green) 10%,transparent)", color:"var(--green)", fontSize:`${14*ts}px`, fontWeight:700 }}>
                  <Ico size={18}><path d="m5 12.5 4.5 4.5L19 7.5"/></Ico>JazakAllahu Khairan! Your feedback is on its way.
                </div>
              ) : (
                <button className="pc" onClick={submit} disabled={!canSubmit}
                  style={{ marginTop:"24px", display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:"50px", borderRadius:"14px", border: canSubmit ? 0 : "1px solid var(--line)", background: canSubmit ? "var(--goldFill)" : "var(--chip)", color: canSubmit ? "var(--onGold)" : "var(--faint)", fontFamily:"inherit", fontSize:`${15*ts}px`, fontWeight:700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
                  {loading ? "Sending…" : "Send Feedback"}
                </button>
              )}
            </section>

            <div style={{ display:"flex", flexDirection:"column", gap:"18px", minWidth:0 }}>
              <section className="card" style={{ padding:"22px 24px" }}>
                <h2 className="h2" style={{ fontSize:`${22*ts}px` }}>Help us improve NŪR</h2>
                <div style={{ marginTop:"10px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.75, color:textDim }}>
                  Found a bug? Have an idea? Something feel off? We read every message. JazakAllahu Khairan for helping us build a better product for the Ummah.
                </div>
              </section>
              <section className="card" style={{ padding:"22px 24px" }}>
                <span className="lbl">Also find us on</span>
                <a href="https://instagram.com/nur.islamic.ai" target="_blank" rel="noreferrer"
                  style={{ marginTop:"14px", display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", borderRadius:"14px", border:"1px solid var(--line)", background:"var(--panel)", textDecoration:"none" }}>
                  <span style={{ flex:"none", display:"flex", alignItems:"center", justifyContent:"center", width:"40px", height:"40px", borderRadius:"11px", background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", color:"#fff" }}>
                    <Ico size={21}><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r=".6" fill="currentColor"/></Ico>
                  </span>
                  <span style={{ flex:1, minWidth:0 }}>
                    <span style={{ display:"block", fontSize:`${14*ts}px`, fontWeight:700, color:textClr }}>Instagram</span>
                    <span style={{ display:"block", marginTop:"2px", fontSize:`${12*ts}px`, fontWeight:500, color:"var(--faint)" }}>@nur.islamic.ai · DM us anytime</span>
                  </span>
                  <span style={{ color:"var(--faint)", display:"flex" }}><Ico size={16}><path d="m9 6 6 6-6 6"/></Ico></span>
                </a>
              </section>
              <div style={{ textAlign:"center", fontSize:`${12.5*ts}px`, fontWeight:500, lineHeight:1.8, color:"var(--faint)" }}>
                NŪR is in Beta — your feedback directly shapes what gets built next.
                <div lang="ar" dir="rtl" style={{ marginTop:"4px", fontFamily:"var(--font-ar)", fontSize:`${20*ts}px`, color:gold }}>بَارَكَ اللَّهُ فِيكَ</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div className="nur-ph" style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button className="nur-ph-menu" onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Feedback & Support</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
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
                  background: active ? "var(--goldFill)" : goldFaint,
                  border: `1px solid ${active ? gold : goldBdr}`,
                  color: active ? "var(--onGold)" : goldDim,
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
          style={{ width:"100%", background:inputBg, border:`1px solid ${error ? "color-mix(in srgb,var(--warn) 60%,transparent)" : goldBdr}`, borderRadius:"14px", padding:"14px 16px", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif", outline:"none", resize:"none", boxSizing:"border-box", lineHeight:1.7, marginBottom:"14px", opacity:loading?0.6:1 }}
        />

        <span style={labelStyle}>Your Email {!skipEmail && <span style={{ color: gold }}>*</span>}{skipEmail && <span style={{ color: textDim, textTransform:"none", letterSpacing:"0" }}> (skipped)</span>}</span>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          disabled={loading || skipEmail}
          style={{ width:"100%", background:inputBg, border:`1px solid ${error && !skipEmail && !emailValid ? "color-mix(in srgb,var(--warn) 60%,transparent)" : goldBdr}`, borderRadius:"14px", padding:"14px 16px", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif", outline:"none", boxSizing:"border-box", marginBottom:"10px", opacity:(loading || skipEmail)?0.45:1 }}
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
          <div style={{ background:"color-mix(in srgb,var(--warn) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 30%,transparent)", borderRadius:"10px", padding:"10px 14px", marginBottom:"12px", color:"var(--warn)", fontSize:`${12 * textSize}px` }}>
            {error}
          </div>
        )}

        {sent ? (
          <div style={{ textAlign:"center", padding:"14px", background:"color-mix(in srgb,var(--green) 10%,transparent)", border:"1px solid color-mix(in srgb,var(--green) 30%,transparent)", borderRadius:"12px", color:"var(--green)", fontSize:`${14 * textSize}px`, fontWeight:700 }}>
            ✦ JazakAllahu Khairan! Your feedback is on its way 🌙
          </div>
        ) : (
          <button onClick={submit} disabled={!canSubmit}
            style={{ width:"100%", padding:"14px", borderRadius:"14px",
              background: canSubmit ? "var(--goldFill)" : goldFaint,
              border: `1px solid ${canSubmit ? gold : goldBdr}`,
              color: canSubmit ? "var(--onGold)" : goldDim,
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
