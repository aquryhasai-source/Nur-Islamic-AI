import { useRef, useState } from "react";

// Website view (>= 1024px) shell for the Privacy and Terms pages: page header,
// sticky "On this page" list and a scrolling column of section cards.
// Presentation only; the legal wording lives in the pages themselves.
export const slugOf = (t) => "lg-" + t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function LegalLayout({ title, updated, toc, textSize = 1, children }) {
  const ts = textSize || 1;
  const scrollRef = useRef(null);
  const [cur, setCur] = useState(toc[0]);

  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top;
    let active = toc[0];
    for (const t of toc) {
      const el = box.querySelector("#" + slugOf(t));
      if (el && el.getBoundingClientRect().top - top <= 140) active = t;
    }
    setCur(active);
  };
  const go = (t) => {
    const el = scrollRef.current && scrollRef.current.querySelector("#" + slugOf(t));
    if (el) { el.scrollIntoView({ behavior:"smooth", block:"start" }); setCur(t); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
        <div className="nur-ph-title">
          <span>{title}</span>
          <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:500, color:"var(--dim)" }}>{updated}</span></span>
        </div>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="msgscroll" style={{ flex:1, overflowY:"auto", padding:"16px 40px 56px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"220px minmax(0,1fr)", gap:"48px", alignItems:"start" }}>
          <nav aria-label="On this page" style={{ position:"sticky", top:0, alignSelf:"start", paddingTop:"4px" }}>
            <div className="lbl" style={{ marginBottom:"12px" }}>On this page</div>
            <div style={{ borderLeft:"1px solid var(--lineSoft)" }}>
              {toc.map(t => {
                const on = cur === t;
                return (
                  <button key={t} className="pc" aria-current={on ? "true" : undefined} onClick={() => go(t)}
                    style={{ display:"block", width:"100%", marginLeft:"-1px", padding:"8px 14px", border:0, borderLeft:`2px solid ${on ? "var(--gold)" : "transparent"}`, borderRadius:"0 8px 8px 0", background: on ? "var(--active)" : "transparent", color: on ? "var(--gold)" : "var(--dim)", fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight: on ? 700 : 600, textAlign:"left", cursor:"pointer" }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </nav>
          <div style={{ minWidth:0, maxWidth:"780px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
