import { useState, useEffect, useRef } from "react";
import { KEYS } from "./utils.js";
import { Icon } from "./Icons.jsx";

// ─── Public homepage (served at "/"). Ad-free. The app itself lives at /app. ───
const Ico = ({ children, size = 22, sw = 1.7, stroke = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const HEADLINE = ["ASK.", "READ.", "VERIFY."];

function Headline() {
  let i = 0;
  return (
    <h1 className="hl v-a" aria-label="ASK. READ. VERIFY." style={{ margin:"22px auto 0", maxWidth:"800px", fontSize:"clamp(36px,6vw,52px)", lineHeight:1.1 }}>
      <span aria-hidden="true" style={{ whiteSpace:"nowrap" }}>
        {HEADLINE.map((w, wi) => {
          const chars = w.split("").map((c, ci) => <span key={ci} className="c" style={{ "--i": i + ci }}>{c}</span>);
          i += w.length + 1;
          return <span key={wi}><span className="w">{chars}</span>{wi < HEADLINE.length - 1 ? " " : ""}</span>;
        })}
      </span>
    </h1>
  );
}

const Section = ({ id, title, children, pad = "56px 32px 24px" }) => (
  <section id={id} style={{ position:"relative", zIndex:1, maxWidth:"1200px", width:"100%", margin:"0 auto", padding:pad }}>
    <h2 className="hd" style={{ textAlign:"center", fontSize:"38px" }}>{title}</h2>
    {children}
  </section>
);

export default function Landing() {
  const [light, setLight] = useState(() => { try { return localStorage.getItem(KEYS.THEME) === "light"; } catch { return false; } });
  useEffect(() => {
    document.documentElement.classList.toggle("nur-light", light);
    try { localStorage.setItem(KEYS.THEME, light ? "light" : "dark"); } catch {}
  }, [light]);

  // The typed question travels to the app in the URL (?q=) and is placed in the chat box there.
  const askRef = useRef(null);
  const appUrl = (q) => { const t = (q || "").trim().slice(0, 500); return t ? `/app?q=${encodeURIComponent(t)}` : "/app"; };
  const goApp = (e) => { e && e.preventDefault && e.preventDefault(); window.location.assign(appUrl(askRef.current?.value)); };
  const chip = { padding:"8px 16px", borderRadius:"20px", border:"1px solid var(--lineSoft)", background:"var(--panel)", color:"var(--dim)", fontSize:"13.5px", fontWeight:600, textDecoration:"none" };

  return (
    <div style={{ position:"relative", minHeight:"100%", display:"flex", flexDirection:"column", background:"var(--bg)", color:"var(--text)", fontFamily:"var(--font-body)", overflowX:"hidden" }}>
      <svg aria-hidden="true" style={{ position:"absolute", left:0, top:0, width:"100%", height:"1000px", pointerEvents:"none" }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="khatamL" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect x="30" y="30" width="60" height="60" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1"/>
            <rect x="30" y="30" width="60" height="60" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1" transform="rotate(45 60 60)"/>
            <circle cx="60" cy="60" r="12" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1"/>
            <path d="M0 0 L30 30 M120 0 L90 30 M0 120 L30 90 M120 120 L90 90" fill="none" style={{ stroke:"var(--pat)" }} strokeWidth="1"/>
          </pattern>
          <linearGradient id="khatamLF" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stopColor="#000"/><stop offset="1" stopColor="#fff"/></linearGradient>
          <mask id="khatamLE"><rect width="100%" height="100%" fill="url(#khatamLF)"/></mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#khatamL)" mask="url(#khatamLE)" style={{ opacity:"var(--patOp)" }}/>
      </svg>

      {/* HEADER */}
      <header style={{ position:"relative", zIndex:2, borderBottom:"1px solid var(--lineSoft)", background:"var(--head)", backdropFilter:"blur(14px)" }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"0 32px", minHeight:"68px", display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:"12px 24px" }}>
          <nav aria-label="Sections" style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"4px 28px", fontSize:"14px", fontWeight:600 }}>
            {[["#ask","Ask"],["#how","How it works"],["#tools","Tools"],["#plans","Free & Pro"]].map(([h,l]) => (
              <a key={h} className="lk" href={h} style={{ color:"var(--dim)", textDecoration:"none" }}>{l}</a>
            ))}
          </nav>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <button className="cb" onClick={() => setLight(v => !v)} aria-label="Switch colour theme" style={{ display:"flex", alignItems:"center", gap:"7px", background:"var(--chip)", border:"1px solid var(--line)", borderRadius:"20px", padding:"7px 13px", color:"var(--gold)", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor"/></svg>
              {light ? "Dark" : "Light"}
            </button>
            <a href="/app" style={{ display:"flex", alignItems:"center", height:"40px", padding:"0 20px", borderRadius:"12px", background:"var(--goldFill)", color:"var(--onGold)", fontSize:"14px", fontWeight:700, textDecoration:"none" }}>Open the app</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="ask" style={{ position:"relative", zIndex:1, maxWidth:"1200px", width:"100%", margin:"0 auto", padding:"56px 32px 40px", textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center" }}>
          <div className="wm combo v-a" role="img" aria-label="NŪR" style={{ "--s":"clamp(72px,12vw,112px)" }}>
            <span className="l" aria-hidden="true">N</span><span className="l" aria-hidden="true">U<i className="mac"/></span><span className="l" aria-hidden="true">R</span>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"center", marginTop:"2px" }}>
          <svg aria-hidden="true" width="240" height="18" viewBox="0 0 240 18" fill="none" style={{ stroke:"var(--gold)" }} strokeWidth="1.2" strokeLinecap="round"><path d="M6 9H44" opacity=".25"/><path d="M44 9H80" opacity=".5"/><path d="M80 9H106" opacity=".9"/><path d="M120 3 126 9 120 15 114 9Z" style={{ fill:"var(--gold)", fillOpacity:.25 }}/><path d="M134 9H160" opacity=".9"/><path d="M160 9H196" opacity=".5"/><path d="M196 9H234" opacity=".25"/></svg>
        </div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", marginTop:"14px", border:"1px solid var(--line)", background:"var(--chip)", borderRadius:"20px", padding:"6px 14px", fontSize:"12.5px", fontWeight:600, color:"var(--gold)" }}>Beta · Free while we grow</div>
        <Headline/>
        <p style={{ margin:"20px auto 0", maxWidth:"600px", fontSize:"18px", lineHeight:1.6, color:"var(--dim)" }}>
          Ask about the Quran, Hadith or daily practice.<br/>Every answer links to the verses and narrations behind it.<br/>What would you like to understand today?
        </p>
        <form onSubmit={goApp} style={{ margin:"36px auto 0", maxWidth:"640px" }}>
          <label style={{ display:"flex", alignItems:"center", gap:"10px", background:"var(--panel2)", border:"1px solid var(--line)", borderRadius:"18px", padding:"8px 8px 8px 20px", textAlign:"left" }}>
            <span style={{ position:"absolute", width:"1px", height:"1px", overflow:"hidden", clip:"rect(0 0 0 0)" }}>Ask a question</span>
            <input ref={askRef} type="text" maxLength={500} enterKeyHint="send" autoComplete="off" placeholder="Ask a question…" style={{ flex:1, minWidth:0, height:"44px", border:0, outline:0, background:"transparent", color:"var(--text)", fontSize:"16px", fontWeight:600 }}/>
            <button type="submit" aria-label="Ask in the app" style={{ flex:"none", width:"46px", height:"46px", border:0, cursor:"pointer", borderRadius:"13px", background:"var(--goldFill)", color:"var(--onGold)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ico size={20} sw={2.2}><path d="M5 12h14M13 6l6 6-6 6"/></Ico>
            </button>
          </label>
        </form>
        <div style={{ margin:"18px auto 0", maxWidth:"700px", display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"10px" }}>
          {["What does the Quran say about patience?","How do I perform wudu?","Hadith on kindness to parents"].map(q => <a key={q} className="cb" href={appUrl(q)} style={chip}>{q}</a>)}
        </div>
      </section>

      {/* SAMPLE ANSWER */}
      <section style={{ position:"relative", zIndex:1, maxWidth:"1200px", width:"100%", margin:"0 auto", padding:"24px 32px 40px", display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"20px" }}>
        <div style={{ flex:"1 1 520px", maxWidth:"640px", border:"1px solid var(--lineSoft)", background:"var(--panel)", borderRadius:"22px", padding:"26px 28px", display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{ alignSelf:"flex-end", background:"var(--user)", border:"1px solid var(--userLine)", borderRadius:"16px 16px 4px 16px", padding:"10px 16px", fontSize:"14px", fontWeight:600 }}>What does the Quran say about patience?</div>
          <p style={{ fontSize:"15px", lineHeight:1.75 }}>The Quran pairs patience (ṣabr) with prayer as a source of strength in hardship, and promises that Allah is with those who are patient.</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            <span style={{ padding:"6px 12px", borderRadius:"9px", background:"var(--goldFill)", color:"var(--onGold)", fontSize:"12.5px", fontWeight:700 }}>Al-Baqarah 2:153</span>
            <span style={{ padding:"6px 12px", borderRadius:"9px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontSize:"12.5px", fontWeight:700 }}>Bukhari 1469</span>
            <span style={{ padding:"6px 12px", borderRadius:"9px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontSize:"12.5px", fontWeight:700 }}>Az-Zumar 39:10</span>
          </div>
        </div>
        <div style={{ flex:"1 1 300px", maxWidth:"420px", border:"1px solid var(--line)", background:"var(--panel2)", borderRadius:"22px", padding:"26px 24px" }}>
          <div style={{ fontSize:"12.5px", fontWeight:600, color:"var(--dim)" }}>Surah Al-Baqarah · Ayah 153</div>
          <div lang="ar" dir="rtl" className="ar" style={{ marginTop:"10px", fontSize:"26px", lineHeight:2, textAlign:"right" }}>يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ</div>
          <div style={{ height:"1px", background:"var(--lineSoft)", margin:"14px 0" }}/>
          <div style={{ fontSize:"14px", lineHeight:1.7, color:"var(--dim)" }}>O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.</div>
          <div style={{ marginTop:"14px", fontSize:"12.5px", fontWeight:700, color:"var(--gold)", display:"flex", alignItems:"center", gap:"5px" }}>Tap a citation to open it <Icon n="forward" size={13}/></div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <Section id="how" title="How it works" pad="72px 32px 24px">
        <div style={{ marginTop:"36px", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"20px" }}>
          {[
            ["1. Ask a question","Type it the way you would ask a person. No account is needed to start.",<path d="M5 5h14v10H10l-4 3.5V15H5V5Z"/>],
            ["2. Read the answer with citations","Answers are drawn from the Quran and Hadith, with each source shown beside the text.",<g><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z"/><path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19"/></g>],
            ["3. Tap to verify","Open any citation to read the full verse or narration without leaving the app.",<g><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.5 2.5 4.5-5"/></g>],
          ].map(([t,d,ic]) => (
            <div key={t} style={{ border:"1px solid var(--lineSoft)", background:"var(--panel)", borderRadius:"20px", padding:"26px 24px" }}>
              <div style={{ width:"42px", height:"42px", borderRadius:"12px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", display:"flex", alignItems:"center", justifyContent:"center" }}><Ico>{ic}</Ico></div>
              <h3 className="hd" style={{ margin:"18px 0 0", fontSize:"22px" }}>{t}</h3>
              <p style={{ margin:"8px 0 0", fontSize:"14.5px", lineHeight:1.65, color:"var(--dim)" }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* TOOLS */}
      <Section id="tools" title="Everyday tools, built in">
        <div style={{ marginTop:"36px", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"16px" }}>
          {[
            ["Prayer Times","Daily salah times with an alarm for each prayer.",<g><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g>],
            ["Qibla Direction","A live compass that points you toward the Kaaba.",<g><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></g>],
            ["Islamic Calendar","Hijri dates and important days at a glance.",<g><rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></g>],
            ["Bookmarks","Save the ayahs and hadiths you want to come back to.",<path d="M7 4h10v16l-5-3.6L7 20V4Z"/>],
          ].map(([t,d,ic]) => (
            <div key={t} style={{ border:"1px solid var(--lineSoft)", background:"var(--panel)", borderRadius:"18px", padding:"22px 20px" }}>
              <span style={{ color:"var(--gold)", display:"flex" }}><Ico size={24}>{ic}</Ico></span>
              <h3 className="hd" style={{ margin:"14px 0 0", fontSize:"20px" }}>{t}</h3>
              <p style={{ margin:"6px 0 0", fontSize:"13.5px", lineHeight:1.6, color:"var(--dim)" }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FREE VS PRO */}
      <Section id="plans" title="Free to use, Pro if you like">
        <div style={{ margin:"36px auto 0", maxWidth:"820px", display:"flex", flexWrap:"wrap", gap:"20px" }}>
          <div style={{ flex:"1 1 340px", border:"1px solid var(--lineSoft)", background:"var(--panel)", borderRadius:"22px", padding:"28px 26px" }}>
            <h3 className="hd" style={{ fontSize:"25px" }}>Free</h3>
            <ul style={{ margin:"16px 0 0", padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:"10px", fontSize:"14.5px", color:"var(--dim)" }}>
              <li>All features included</li><li>15 AI questions per day</li><li>Supported by a small ad</li>
            </ul>
          </div>
          <div style={{ flex:"1 1 340px", border:"1px solid var(--line)", background:"var(--panel2)", borderRadius:"22px", padding:"28px 26px" }}>
            <h3 className="hd" style={{ fontSize:"25px", color:"var(--gold)" }}>Pro</h3>
            <ul style={{ margin:"16px 0 0", padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:"10px", fontSize:"14.5px", color:"var(--dim)" }}>
              <li>No ads</li><li>No daily question limit</li><li>One-time payment, no subscription</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section style={{ position:"relative", zIndex:1, maxWidth:"1200px", width:"100%", margin:"0 auto", padding:"64px 32px 32px", textAlign:"center" }}>
        <h2 className="hd" style={{ fontSize:"36px" }}>Start asking</h2>
        <p style={{ margin:"10px 0 0", fontSize:"15.5px", color:"var(--dim)" }}>Works in your browser. Add it to your home screen to use it like an app.</p>
        <a href="/app" style={{ display:"inline-flex", alignItems:"center", height:"48px", marginTop:"22px", padding:"0 28px", borderRadius:"14px", background:"var(--goldFill)", color:"var(--onGold)", fontSize:"15.5px", fontWeight:700, textDecoration:"none" }}>Open the app</a>
      </section>

      <footer style={{ position:"relative", zIndex:1, marginTop:"auto", borderTop:"1px solid var(--lineSoft)", background:"var(--head)" }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"24px 32px", display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:"12px 24px", fontSize:"13px", color:"var(--faint)" }}>
          <span>Always consult a qualified scholar. NŪR is a study aid, not a source of fatwa.</span>
          <span style={{ display:"flex", gap:"22px" }}>
            <a className="lk" href="/app#privacy" style={{ color:"var(--faint)", textDecoration:"none" }}>Privacy</a>
            <a className="lk" href="/app#terms" style={{ color:"var(--faint)", textDecoration:"none" }}>Terms</a>
            <a className="lk" href="/app#feedback" style={{ color:"var(--faint)", textDecoration:"none" }}>Contact</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
