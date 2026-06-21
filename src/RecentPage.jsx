import { getChatHistory } from "./utils.js";

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function RecentPage({ onBack, lightMode, textSize = 1 }) {
  const allHistory = getChatHistory();

  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Chat History</div>
        {allHistory.length > 0 && (
          <div style={{ marginLeft:"auto", color:goldDim, fontSize:"12px" }}>{allHistory.length} conversations</div>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 28px" }}>
        {allHistory.length === 0 ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", textAlign:"center", height:"60%" }}>
            <div style={{ fontSize:"32px", marginBottom:"12px", opacity:0.4 }}>🕐</div>
            <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontWeight:700, marginBottom:"8px" }}>No History Yet</div>
            <div style={{ color:textDim, fontSize:`${13 * textSize}px`, lineHeight:1.8 }}>
              Your questions will appear here as you use the AI chat.
            </div>
          </div>
        ) : (
          allHistory.map((entry, i) => (
            <div key={entry.id || i} style={{ marginBottom:"10px", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", overflow:"hidden" }}>
              <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${goldBdr}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"8px" }}>
                <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:600, lineHeight:1.5, flex:1 }}>
                  {entry.question}
                </div>
                <div style={{ color:textDim, fontSize:"10px", flexShrink:0, marginTop:"2px" }}>{timeAgo(entry.timestamp)}</div>
              </div>
              {entry.answer && (
                <div style={{ padding:"10px 14px", color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.7 }}>
                  {entry.answer.slice(0, 120)}{entry.answer.length > 120 ? "…" : ""}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
