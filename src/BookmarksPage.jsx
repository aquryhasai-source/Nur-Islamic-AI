import { isBookmarked } from "./utils.js";
import { useMedia, DOCK_QUERY } from "./useMedia.js";

export default function BookmarksPage({ onBack, onOpenSidebar, bookmarks, onToggle, unlocked, navigateTo, lightMode, textSize = 1 }) {
  const docked = useMedia(DOCK_QUERY);
  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";

  const quranAccent  = "var(--green)";
  const hadithAccent = "var(--gold)";

  const Header = () => (
    <div className="nur-ph" style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
      <button className="nur-ph-menu" onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
        <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
        <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
      </button>
      <div className="nur-ph-title" style={{ flex:1, textAlign:"center" }}>
        <span style={{ color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Bookmarks</span>
        {bookmarks.length > 0 && <span style={{ color:goldDim, fontSize:`${12*textSize}px`, marginLeft:"8px" }}>{bookmarks.length} saved</span>}
      </div>
      <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
    </div>
  );

  if (docked) {
    const ts = textSize || 1;
    const qB = bookmarks.filter(b => b.type === "quran");
    const hB = bookmarks.filter(b => b.type === "hadith");
    const count = bookmarks.length === 0 ? "Nothing saved yet" : `${bookmarks.length} saved`;
    const ico = (d, sz = 16) => (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
    );
    const bmIcon = <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z"/>;
    const xIcon = <path d="M6 6l12 12M18 6 6 18"/>;
    const DCard = ({ b, accent }) => (
      <article className="card" style={{ overflow:"hidden", borderColor:`color-mix(in srgb, ${accent} 30%, transparent)` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", height:"42px", padding:"0 12px 0 16px", background:`color-mix(in srgb, ${accent} 10%, transparent)`, borderBottom:`1px solid color-mix(in srgb, ${accent} 22%, transparent)` }}>
          <span style={{ fontSize:`${13*ts}px`, fontWeight:700, color:accent }}>{b.title}</span>
          <button className="pc" onClick={() => onToggle(b)} aria-label={`Remove bookmark ${b.title}`} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"28px", height:"28px", borderRadius:"8px", border:0, background:"transparent", color:accent, cursor:"pointer" }}>{ico(xIcon, 15)}</button>
        </div>
        {b.arabic && (
          <div lang="ar" dir="rtl" style={{ padding:"14px 18px 4px", fontFamily:"var(--font-ar)", fontSize:`${25*ts}px`, lineHeight:2, textAlign:"right", color:accent }}>{b.arabic}</div>
        )}
        <div style={{ padding: b.arabic ? "0 18px 16px" : "16px 18px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.75, color:"var(--dim)" }}>{b.text}</div>
      </article>
    );
    const Col = ({ list, accent, label }) => (
      <section style={{ flex:"1 1 0", minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"9px", marginBottom:"12px" }}>
          <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:accent }}/>
          <span className="lbl" style={{ color:accent }}>{label}</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          {list.map(b => <DCard key={b.id} b={b} accent={accent}/>)}
        </div>
      </section>
    );
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
          <div className="nur-ph-title">
            <span>Bookmarks</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"13.5px", fontWeight:500, color:"var(--dim)" }}>{count}</span></span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          {bookmarks.length === 0 ? (
            <section className="card" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"72px 24px", textAlign:"center" }}>
              <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"56px", height:"56px", borderRadius:"16px", border:"1px solid var(--lineSoft)", background:"var(--chip)", color:"var(--gold)" }}>{ico(bmIcon, 24)}</span>
              <h2 className="h2" style={{ marginTop:"18px", fontSize:"26px" }}>No Bookmarks Yet</h2>
              <div style={{ marginTop:"8px", maxWidth:"360px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.7, color:"var(--dim)" }}>Tap the bookmark icon on any ayah or hadith to save it here.</div>
            </section>
          ) : (
            <div style={{ display:"flex", gap:"22px", alignItems:"flex-start" }}>
              {qB.length > 0 && <Col list={qB} accent={quranAccent} label={`Quran — ${qB.length} ayah${qB.length !== 1 ? "s" : ""}`}/>}
              {hB.length > 0 && <Col list={hB} accent={hadithAccent} label={`Hadith — ${hB.length} hadith${hB.length !== 1 ? "s" : ""}`}/>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <Header/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center" }}>
          <div style={{ fontSize:"36px", marginBottom:"14px", opacity:0.5 }}>🔖</div>
          <div style={{ color:gold, fontSize:`${17 * textSize}px`, fontWeight:700, marginBottom:"10px" }}>No Bookmarks Yet</div>
          <div style={{ color:textDim, fontSize:`${13 * textSize}px`, lineHeight:1.8 }}>
            Tap the 🔖 icon on any ayah or hadith to save it here.
          </div>
        </div>
      </div>
    );
  }

  const quranBm  = bookmarks.filter(b => b.type === "quran");
  const hadithBm = bookmarks.filter(b => b.type === "hadith");

  const Card = ({ bm, accent }) => (
    <div style={{ marginBottom:"10px", borderRadius:"14px", overflow:"hidden", border:`1px solid ${accent}30` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", background:`${accent}15`, borderBottom:`1px solid ${accent}20` }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:accent, flexShrink:0 }}/>
          <span style={{ color:accent, fontSize:`${12*textSize}px`, fontWeight:700 }}>{bm.title}</span>
        </div>
        <button onClick={() => onToggle(bm)} style={{ background:"none", border:"none", fontSize:"15px", cursor:"pointer", lineHeight:1, color:accent, opacity:0.7 }}>✕</button>
      </div>
      {bm.arabic && (
        <div style={{ padding:"10px 14px 6px", color:accent, fontSize:`${19 * textSize}px`, fontFamily:"var(--font-ar)", textAlign:"right", direction:"rtl", lineHeight:2 }}>
          {bm.arabic}
        </div>
      )}
      <div style={{ padding: bm.arabic ? "0 14px 12px" : "12px 14px", color:textClr, fontSize:`${13 * textSize}px`, lineHeight:1.8 }}>
        {bm.text}
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <Header/>
      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 28px" }}>
        {quranBm.length > 0 && (
          <>
            <div style={{ color:quranAccent, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"10px", fontWeight:700 }}>
              ● Quran — {quranBm.length} ayah{quranBm.length !== 1 ? "s" : ""}
            </div>
            {quranBm.map(bm => <Card key={bm.id} bm={bm} accent={quranAccent}/>)}
          </>
        )}
        {hadithBm.length > 0 && (
          <>
            <div style={{ color:hadithAccent, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", margin:`${quranBm.length > 0 ? "16px" : "0"} 0 10px`, fontWeight:700 }}>
              ● Hadith — {hadithBm.length} hadith{hadithBm.length !== 1 ? "s" : ""}
            </div>
            {hadithBm.map(bm => <Card key={bm.id} bm={bm} accent={hadithAccent}/>)}
          </>
        )}
      </div>
    </div>
  );
}
