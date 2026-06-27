import { isBookmarked } from "./utils.js";

export default function BookmarksPage({ onBack, onOpenSidebar, bookmarks, onToggle, unlocked, navigateTo, lightMode, textSize = 1 }) {
  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,255,0.75)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.35)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";

  const quranAccent  = lightMode ? "#3a7a4a" : "#5aaf7a";
  const hadithAccent = lightMode ? "#8b6914" : "#c9a84c";

  const Header = () => (
    <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
      <button onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
        <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
        <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
      </button>
      <div style={{ flex:1, textAlign:"center" }}>
        <span style={{ color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Bookmarks</span>
        {bookmarks.length > 0 && <span style={{ color:goldDim, fontSize:`${12*textSize}px`, marginLeft:"8px" }}>{bookmarks.length} saved</span>}
      </div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
    </div>
  );

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
        <div style={{ padding:"10px 14px 6px", color:accent, fontSize:`${19 * textSize}px`, fontFamily:"Georgia,serif", textAlign:"right", direction:"rtl", lineHeight:2 }}>
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
