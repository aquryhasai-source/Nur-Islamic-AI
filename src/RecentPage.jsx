import { useState, useRef } from "react";
import { getSessions, deleteSession, clearAllSessions, shareOrDownloadBackup, importBackupJSON } from "./utils.js";

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  if (days < 7)  return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function msgCount(session) {
  const pairs = Math.floor((session.messages || []).filter(m => m.role === "assistant").length);
  return `${pairs} exchange${pairs !== 1 ? "s" : ""}`;
}

export default function RecentPage({ onBack, onContinue, lightMode, textSize = 1 }) {
  const [sessions,    setSessions]    = useState(() => getSessions());
  const [expanded,    setExpanded]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [confirmAll,  setConfirmAll]  = useState(false);
  const [backupState, setBackupState] = useState("idle"); // idle | saving | done | error
  const [importState, setImportState] = useState("idle"); // idle | importing | done | error
  const [importMsg,   setImportMsg]   = useState("");
  const fileRef = useRef(null);

  const gold      = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim   = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr   = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint = lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr   = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.82)";
  const textDim   = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg  = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const cardBg    = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";
  const inputBg   = lightMode ? "rgba(255,255,255,0.6)"  : "rgba(255,255,255,0.05)";
  const dangerClr = "#e07b54";
  const greenClr  = "#4caf84";

  const handleDelete = (id) => {
    const updated = deleteSession(id);
    setSessions(updated);
    if (expanded === id) setExpanded(null);
  };

  const handleClearAll = () => {
    clearAllSessions();
    setSessions([]);
    setConfirmAll(false);
    setExpanded(null);
  };

  const handleBackup = async () => {
    setBackupState("saving");
    try {
      await shareOrDownloadBackup();
      setBackupState("done");
      setTimeout(() => setBackupState("idle"), 3000);
    } catch (e) {
      setBackupState(e.name === "AbortError" ? "idle" : "error");
      setTimeout(() => setBackupState("idle"), 3000);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportState("importing");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = importBackupJSON(ev.target.result);
        setSessions(getSessions());
        setImportMsg(`Imported ${result.imported} conversation${result.imported !== 1 ? "s" : ""}`);
        setImportState("done");
        setTimeout(() => { setImportState("idle"); setImportMsg(""); }, 4000);
      } catch {
        setImportMsg("Invalid backup file");
        setImportState("error");
        setTimeout(() => { setImportState("idle"); setImportMsg(""); }, 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = search.trim()
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.messages || []).some(m =>
          (m.display || m.content || "").toLowerCase().includes(search.toLowerCase())
        )
      )
    : sessions;

  const previewMessages = (session) =>
    (session.messages || [])
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(0, 6);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px", flex:1 }}>Chat History</div>
        {sessions.length > 0 && (
          <div style={{ color:goldDim, fontSize:"12px" }}>{sessions.length} conversation{sessions.length !== 1 ? "s" : ""}</div>
        )}
      </div>

      {/* Search bar */}
      {sessions.length > 0 && (
        <div style={{ padding:"10px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", background:inputBg, border:`1px solid ${goldBdr}`, borderRadius:"10px", padding:"8px 12px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={goldDim}><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              style={{ flex:1, background:"none", border:"none", outline:"none", color:textClr, fontSize:`${13 * textSize}px`, fontFamily:"Nunito,sans-serif" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:goldDim, fontSize:"16px", cursor:"pointer", lineHeight:1 }}>✕</button>
            )}
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 28px" }}>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", textAlign:"center" }}>
            <div style={{ fontSize:"32px", marginBottom:"12px", opacity:0.4 }}>🕐</div>
            <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontWeight:700, marginBottom:"8px" }}>No History Yet</div>
            <div style={{ color:textDim, fontSize:`${13 * textSize}px`, lineHeight:1.8, marginBottom:"24px" }}>
              Your conversations will appear here. Start chatting!
            </div>
            {/* Import section even when empty */}
            <div style={{ width:"100%", maxWidth:"300px" }}>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
              <button onClick={() => fileRef.current?.click()}
                style={{ width:"100%", padding:"12px", borderRadius:"12px", background:goldFaint, border:`1px solid ${goldBdr}`, color:goldDim, fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                📥 Restore from backup
              </button>
              {importMsg && (
                <div style={{ color: importState === "error" ? dangerClr : greenClr, fontSize:"12px", marginTop:"8px", textAlign:"center" }}>
                  {importMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No search results */}
        {sessions.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign:"center", color:textDim, padding:"40px 20px", fontSize:`${13 * textSize}px` }}>
            No conversations match "{search}"
          </div>
        )}

        {/* Session cards */}
        {filtered.map((session) => {
          const isOpen    = expanded === session.id;
          const preview   = previewMessages(session);
          const lastMsg   = (session.messages || []).filter(m => m.role === "assistant").slice(-1)[0];

          return (
            <div key={session.id}
              style={{ marginBottom:"10px", background:cardBg, border:`1px solid ${isOpen ? `${gold}60` : goldBdr}`, borderRadius:"14px", overflow:"hidden", transition:"border-color 0.2s" }}>

              {/* Session header — tap to expand */}
              <button
                onClick={() => setExpanded(isOpen ? null : session.id)}
                style={{ display:"flex", alignItems:"flex-start", gap:"10px", width:"100%", padding:"13px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                <div style={{ flex:1 }}>
                  <div style={{ color: isOpen ? gold : textClr, fontSize:`${13 * textSize}px`, fontWeight:700, lineHeight:1.4, marginBottom:"4px" }}>
                    {session.title}
                  </div>
                  <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                    <span style={{ color:textDim, fontSize:"10px" }}>{timeAgo(session.updatedAt)}</span>
                    <span style={{ color:textDim, fontSize:"10px" }}>·</span>
                    <span style={{ color:textDim, fontSize:"10px" }}>{msgCount(session)}</span>
                  </div>
                </div>
                <div style={{ color:goldDim, fontSize:"18px", lineHeight:1, flexShrink:0, marginTop:"2px", transition:"transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  ⌄
                </div>
              </button>

              {/* Expanded: preview + actions */}
              {isOpen && (
                <div style={{ borderTop:`1px solid ${goldBdr}` }}>

                  {/* Message preview */}
                  <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:"10px", maxHeight:"260px", overflowY:"auto" }}>
                    {preview.map((msg, i) => (
                      <div key={i} style={{
                        alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                        maxWidth:"90%",
                        background: msg.role === "user"
                          ? lightMode ? "rgba(122,88,16,0.1)" : "rgba(201,168,76,0.1)"
                          : lightMode ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                        border:`1px solid ${goldBdr}`,
                        borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                        padding:"8px 12px",
                      }}>
                        <div style={{ color:textDim, fontSize:"9px", marginBottom:"3px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                          {msg.role === "user" ? "You" : "NŪR"}
                        </div>
                        <div style={{ color:textClr, fontSize:`${12 * textSize}px`, lineHeight:1.6 }}>
                          {(msg.display || msg.content || "").slice(0, 200)}
                          {(msg.display || msg.content || "").length > 200 ? "…" : ""}
                        </div>
                      </div>
                    ))}
                    {(session.messages || []).length > 6 && (
                      <div style={{ color:textDim, fontSize:"11px", textAlign:"center" }}>
                        + {(session.messages || []).length - 6} more messages
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ padding:"0 14px 13px", display:"flex", gap:"8px" }}>
                    <button
                      onClick={() => onContinue(session)}
                      style={{ flex:1, padding:"10px", borderRadius:"10px", background:`linear-gradient(135deg,${gold},${lightMode?"#a07020":"#a8862e"})`, border:"none", color:lightMode?"#fff":"#0d1f14", fontSize:`${13 * textSize}px`, fontWeight:800, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                      Continue →
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      style={{ padding:"10px 16px", borderRadius:"10px", background:"rgba(224,123,84,0.08)", border:"1px solid rgba(224,123,84,0.25)", color:dangerClr, fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Backup / Restore section */}
        {sessions.length > 0 && (
          <div style={{ marginTop:"20px", padding:"16px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
            <div style={{ color:goldDim, fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>
              Backup & Restore
            </div>
            <div style={{ color:textDim, fontSize:`${11 * textSize}px`, lineHeight:1.7, marginBottom:"14px" }}>
              Chats are stored only on this device. Back up to your Drive, iCloud, or email to keep them safe.
            </div>

            {/* Export */}
            <button
              onClick={handleBackup}
              disabled={backupState === "saving"}
              style={{ width:"100%", padding:"11px", borderRadius:"10px", marginBottom:"8px",
                background: backupState === "done" ? "rgba(76,175,132,0.12)" : goldFaint,
                border:`1px solid ${backupState === "done" ? greenClr : goldBdr}`,
                color: backupState === "done" ? greenClr : gold,
                fontSize:`${13 * textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              {backupState === "saving" ? "Preparing…"
               : backupState === "done"  ? "✓ Backup saved!"
               : backupState === "error" ? "Failed — try again"
               : "📤 Save backup to Drive / Files"}
            </button>

            {/* Import */}
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importState === "importing"}
              style={{ width:"100%", padding:"11px", borderRadius:"10px",
                background: importState === "done" ? "rgba(76,175,132,0.12)" : "transparent",
                border:`1px solid ${importState === "done" ? greenClr : importState === "error" ? dangerClr : goldBdr}`,
                color: importState === "done" ? greenClr : importState === "error" ? dangerClr : goldDim,
                fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              {importState === "importing" ? "Importing…"
               : importMsg ? importMsg
               : "📥 Restore from backup file"}
            </button>
          </div>
        )}

        {/* Clear all */}
        {sessions.length > 0 && !search && (
          <div style={{ marginTop:"16px", textAlign:"center" }}>
            {confirmAll ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", padding:"16px", background:"rgba(224,123,84,0.07)", border:"1px solid rgba(224,123,84,0.2)", borderRadius:"14px" }}>
                <div style={{ color:dangerClr, fontSize:`${13 * textSize}px`, fontWeight:600 }}>Delete all conversations?</div>
                <div style={{ display:"flex", gap:"10px" }}>
                  <button onClick={() => setConfirmAll(false)}
                    style={{ padding:"8px 20px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, color:goldDim, fontSize:"13px", cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                    Cancel
                  </button>
                  <button onClick={handleClearAll}
                    style={{ padding:"8px 20px", borderRadius:"10px", background:"rgba(224,123,84,0.15)", border:"1px solid rgba(224,123,84,0.35)", color:dangerClr, fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                    Delete All
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmAll(true)}
                style={{ background:"none", border:"none", color:textDim, fontSize:"12px", cursor:"pointer", fontFamily:"Nunito,sans-serif", textDecoration:"underline", padding:"8px" }}>
                Delete all conversations
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
