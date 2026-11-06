import { useState, useRef } from "react";
import { useMedia, DOCK_QUERY } from "./useMedia.js";
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

export default function RecentPage({ onBack, onOpenSidebar, onContinue, lightMode, textSize = 1 }) {
  const [sessions,    setSessions]    = useState(() => getSessions());
  const [expanded,    setExpanded]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [confirmAll,  setConfirmAll]  = useState(false);
  const [backupState, setBackupState] = useState("idle");
  const [importState, setImportState] = useState("idle");
  const [importMsg,   setImportMsg]   = useState("");
  const fileRef = useRef(null);
  const docked = useMedia(DOCK_QUERY);

  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const cardBg = "var(--panel)";
  const inputBg = "var(--panel2)";
  const dangerClr = "var(--warn)";
  const greenClr  = "var(--green)";

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

  if (docked) {
    const ts = textSize || 1;
    const ico = (d, sz = 16) => (
      <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
    );
    const sel = filtered.find(x => x.id === expanded) || filtered[0] || null;
    const msgs = sel ? (sel.messages || []).filter(m => m.role === "user" || m.role === "assistant") : [];
    const count = sessions.length === 0 ? "Nothing saved yet" : `${sessions.length} conversation${sessions.length !== 1 ? "s" : ""} saved on this device`;
    const bkBusy = backupState === "saving";
    const bkDone = backupState === "done";
    const rsDone = importState === "done";
    const rsErr = importState === "error";
    const hiddenFile = <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>;
    const backupCard = (
      <section className="card" style={{ padding:"20px 22px" }}>
        <span className="lbl">Backup &amp; Restore</span>
        <div style={{ marginTop:"12px", fontSize:`${13*ts}px`, fontWeight:500, lineHeight:1.65, color:"var(--dim)" }}>Chats are stored only on this device. Back up to your Drive, iCloud, or email to keep them safe.</div>
        <div style={{ marginTop:"16px", display:"flex", flexDirection:"column", gap:"10px" }}>
          <button className="pc" onClick={handleBackup} disabled={bkBusy} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", height:"42px", borderRadius:"12px", border:`1px solid ${bkDone ? greenClr : goldBdr}`, background: bkDone ? "color-mix(in srgb,var(--green) 12%,transparent)" : goldFaint, color: bkDone ? greenClr : gold, fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>
            {ico(<><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></>)}
            {bkBusy ? "Preparing…" : bkDone ? "Backup saved" : backupState === "error" ? "Failed — try again" : "Save backup"}
          </button>
          <button className="pc" onClick={() => fileRef.current?.click()} disabled={importState === "importing"} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", height:"42px", borderRadius:"12px", border:`1px solid ${rsDone ? greenClr : rsErr ? dangerClr : goldBdr}`, background:"transparent", color: rsDone ? greenClr : rsErr ? dangerClr : "var(--dim)", fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>
            {ico(<><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></>)}
            {importState === "importing" ? "Importing…" : importMsg ? importMsg : "Restore from file"}
          </button>
        </div>
        {hiddenFile}
      </section>
    );
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <div className="nur-ph" style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
          <div className="nur-ph-title">
            <span>Chat History</span>
            <span style={{ display:"block" }}><span style={{ display:"block", marginTop:"8px", fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:500, color:"var(--dim)" }}>{count}</span></span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 40px 48px" }}>
          {sessions.length === 0 ? (
            <section className="card" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"72px 24px", textAlign:"center" }}>
              <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"56px", height:"56px", borderRadius:"16px", border:"1px solid var(--lineSoft)", background:"var(--chip)", color:"var(--gold)" }}>{ico(<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>, 24)}</span>
              <h2 className="h2" style={{ marginTop:"18px", fontSize:"calc(26px * var(--ts, 1))" }}>No History Yet</h2>
              <div style={{ marginTop:"8px", maxWidth:"360px", fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.7, color:"var(--dim)" }}>Your conversations will appear here. Start chatting!</div>
              <button className="pc" onClick={() => fileRef.current?.click()} style={{ marginTop:"22px", display:"flex", alignItems:"center", gap:"8px", height:"40px", padding:"0 18px", borderRadius:"12px", border:`1px solid ${goldBdr}`, background:goldFaint, color:gold, fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>
                {ico(<><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></>)}
                Restore from backup
              </button>
              {hiddenFile}
              {importMsg && <div style={{ marginTop:"10px", fontSize:`${12*ts}px`, color: rsErr ? dangerClr : greenClr }}>{importMsg}</div>}
            </section>
          ) : (
            <div className="nurh-grid" style={{ display:"grid", gap:"20px", alignItems:"start" }}>
              <style>{`
                .nurh-grid{grid-template-columns:380px minmax(0,1fr) 320px}
                @media (max-width:1599px){.nurh-grid{grid-template-columns:380px minmax(0,1fr)}.nurh-list{grid-row:span 2}.nurh-rail{grid-column:2}}
              `}</style>
              <div className="nurh-list" style={{ display:"flex", flexDirection:"column", gap:"14px", minWidth:0 }}>
                <label style={{ display:"flex", alignItems:"center", gap:"10px", height:"44px", padding:"0 14px", borderRadius:"13px", border:"1px solid var(--line)", background:"var(--panel2)", color:"var(--faint)" }}>
                  {ico(<><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></>, 17)}
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" aria-label="Search conversations" style={{ flex:1, minWidth:0, border:0, outline:0, background:"transparent", color:"var(--text)", fontFamily:"inherit", fontSize:`${13.5*ts}px`, fontWeight:600 }}/>
                  {search && <button className="pc" onClick={() => setSearch("")} aria-label="Clear search" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", borderRadius:"7px", border:0, background:"transparent", color:"var(--faint)", cursor:"pointer" }}>{ico(<path d="M6 6l12 12M18 6 6 18"/>, 14)}</button>}
                </label>
                {filtered.length > 0 ? (
                  <div className="card" style={{ padding:"8px", display:"flex", flexDirection:"column", gap:"4px" }}>
                    {filtered.map(x => {
                      const on = sel && sel.id === x.id;
                      return (
                        <button key={x.id} className="pc" aria-pressed={on} onClick={() => setExpanded(x.id)} style={{ display:"block", width:"100%", padding:"12px 14px", borderRadius:"11px", border:`1px solid ${on ? "var(--line)" : "transparent"}`, background: on ? "var(--active)" : "transparent", color:"var(--text)", fontFamily:"inherit", textAlign:"left", cursor:"pointer" }}>
                          <span style={{ display:"block", fontSize:`${13.5*ts}px`, fontWeight:700, lineHeight:1.4, color: on ? "var(--gold)" : "var(--text)" }}>{x.title}</span>
                          <span style={{ display:"block", marginTop:"4px", fontSize:`${11.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>{timeAgo(x.updatedAt)} · {msgCount(x)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card" style={{ padding:"36px 20px", textAlign:"center", fontSize:`${13.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>No conversations match "{search}"</div>
                )}
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"20px", minWidth:0 }}>
                {sel ? (
                  <section className="card" style={{ overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"20px", padding:"22px 26px 18px", borderBottom:"1px solid var(--lineSoft)" }}>
                      <div style={{ minWidth:0 }}>
                        <h2 className="h2" style={{ fontSize:"calc(25px * var(--ts, 1))", lineHeight:1.2 }}>{sel.title}</h2>
                        <div style={{ marginTop:"6px", fontSize:`${12.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>{timeAgo(sel.updatedAt)} · {msgCount(sel)}</div>
                      </div>
                      <div style={{ flex:"none", display:"flex", gap:"10px" }}>
                        <button className="pc" onClick={() => handleDelete(sel.id)} style={{ display:"flex", alignItems:"center", gap:"7px", height:"38px", padding:"0 14px", borderRadius:"11px", border:"1px solid var(--warn)", background:"transparent", color:dangerClr, fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>
                          {ico(<><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12h9.4l.8-12"/></>, 15)}Delete
                        </button>
                        <button className="pc" onClick={() => onContinue(sel)} style={{ display:"flex", alignItems:"center", gap:"8px", height:"38px", padding:"0 18px", borderRadius:"11px", border:0, background:"var(--goldFill)", color:"var(--onGold)", fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>
                          Continue chat{ico(<path d="M5 12h14M13 6l6 6-6 6"/>, 15)}
                        </button>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"14px", padding:"22px 26px 26px" }}>
                      {msgs.slice(0, 8).map((m, i) => {
                        const u = m.role === "user";
                        const t = m.display || m.content || "";
                        return (
                          <div key={i} style={{ alignSelf: u ? "flex-end" : "flex-start", maxWidth:"82%", padding:"11px 16px 12px", border:"1px solid var(--line)", borderRadius: u ? "16px 4px 16px 16px" : "4px 16px 16px 16px", background: u ? "var(--chip)" : "var(--panel)" }}>
                            <div style={{ marginBottom:"4px", fontSize:`${10*ts}px`, fontWeight:700, letterSpacing:"1.2px", color: u ? "var(--gold)" : "var(--dim)" }}>{u ? "YOU" : "NŪR"}</div>
                            <div style={{ fontSize:`${13.5*ts}px`, fontWeight:500, lineHeight:1.7, color:"var(--text)" }}>{t.slice(0, 400)}{t.length > 400 ? "…" : ""}</div>
                          </div>
                        );
                      })}
                      {msgs.length > 8 && <div style={{ textAlign:"center", fontSize:`${12*ts}px`, color:"var(--faint)" }}>+ {msgs.length - 8} more messages. Continue the chat to see them all.</div>}
                    </div>
                  </section>
                ) : (
                  <section className="card" style={{ padding:"70px 24px", textAlign:"center", fontSize:`${13.5*ts}px`, fontWeight:500, color:"var(--faint)" }}>Select a conversation to preview it here.</section>
                )}
              </div>

              <div className="nurh-rail" style={{ display:"flex", flexDirection:"column", gap:"16px", minWidth:0 }}>
                {sel && (
                  <section className="card" style={{ padding:"20px 22px" }}>
                    <span className="lbl">Details</span>
                    <div style={{ marginTop:"12px", display:"flex", flexDirection:"column", gap:"10px", fontSize:`${13*ts}px` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:"12px" }}><span style={{ color:"var(--dim)" }}>Last active</span><span style={{ fontWeight:600 }}>{timeAgo(sel.updatedAt)}</span></div>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:"12px" }}><span style={{ color:"var(--dim)" }}>Messages</span><span style={{ fontWeight:600 }}>{msgs.length}</span></div>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:"12px" }}><span style={{ color:"var(--dim)" }}>Stored</span><span style={{ fontWeight:600 }}>On this device</span></div>
                    </div>
                  </section>
                )}
                {backupCard}
                <section className="card" style={{ padding:"20px 22px" }}>
                  <span className="lbl">Danger zone</span>
                  <div style={{ marginTop:"10px", fontSize:`${13*ts}px`, fontWeight:500, lineHeight:1.65, color:"var(--dim)" }}>Remove every conversation from this device. This cannot be undone.</div>
                  {confirmAll ? (
                    <div style={{ marginTop:"14px", display:"flex", flexDirection:"column", gap:"10px", padding:"14px", borderRadius:"12px", border:"1px solid var(--warn)", background:"var(--panel)" }}>
                      <span style={{ fontSize:`${13.5*ts}px`, fontWeight:700, color:dangerClr }}>Delete all conversations?</span>
                      <div style={{ display:"flex", gap:"10px" }}>
                        <button className="pc" onClick={() => setConfirmAll(false)} style={{ flex:1, height:"36px", borderRadius:"10px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>Cancel</button>
                        <button className="pc" onClick={handleClearAll} style={{ flex:1, height:"36px", borderRadius:"10px", border:"1px solid var(--warn)", background:"transparent", color:dangerClr, fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>Delete all</button>
                      </div>
                    </div>
                  ) : (
                    <button className="pc" onClick={() => setConfirmAll(true)} style={{ marginTop:"14px", width:"100%", height:"40px", borderRadius:"11px", border:"1px solid var(--warn)", background:"transparent", color:dangerClr, fontFamily:"inherit", fontSize:`${13*ts}px`, fontWeight:700, cursor:"pointer" }}>Delete all conversations</button>
                  )}
                </section>
              </div>
            </div>
          )}
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
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center" }}>
          <span style={{ color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Chat History</span>
          {sessions.length > 0 && <span style={{ color:goldDim, fontSize:`${11*textSize}px`, marginLeft:"8px" }}>{sessions.length} saved</span>}
        </div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
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
              <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:goldDim, fontSize:"calc(16px * var(--ts, 1))", cursor:"pointer", lineHeight:1 }}>✕</button>
            )}
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 28px" }}>

        {sessions.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 24px", textAlign:"center" }}>
            <div style={{ fontSize:"calc(32px * var(--ts, 1))", marginBottom:"12px", opacity:0.4 }}>🕐</div>
            <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontWeight:700, marginBottom:"8px" }}>No History Yet</div>
            <div style={{ color:textDim, fontSize:`${13 * textSize}px`, lineHeight:1.8, marginBottom:"24px" }}>
              Your conversations will appear here. Start chatting!
            </div>
            <div style={{ width:"100%", maxWidth:"300px" }}>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
              <button onClick={() => fileRef.current?.click()}
                style={{ width:"100%", padding:"12px", borderRadius:"12px", background:goldFaint, border:`1px solid ${goldBdr}`, color:goldDim, fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                📥 Restore from backup
              </button>
              {importMsg && (
                <div style={{ color: importState === "error" ? dangerClr : greenClr, fontSize:`${12*textSize}px`, marginTop:"8px", textAlign:"center" }}>
                  {importMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {sessions.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign:"center", color:textDim, padding:"40px 20px", fontSize:`${13 * textSize}px` }}>
            No conversations match "{search}"
          </div>
        )}

        {filtered.map((session) => {
          const isOpen  = expanded === session.id;
          const preview = previewMessages(session);

          return (
            <div key={session.id}
              style={{ marginBottom:"10px", background:cardBg, border:`1px solid ${isOpen ? `color-mix(in srgb,${gold} 38%,transparent)` : goldBdr}`, borderRadius:"14px", overflow:"hidden", transition:"border-color 0.2s" }}>

              <button
                onClick={() => setExpanded(isOpen ? null : session.id)}
                style={{ display:"flex", alignItems:"flex-start", gap:"10px", width:"100%", padding:"13px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                <div style={{ flex:1 }}>
                  <div style={{ color: isOpen ? gold : textClr, fontSize:`${13 * textSize}px`, fontWeight:700, lineHeight:1.4, marginBottom:"4px" }}>
                    {session.title}
                  </div>
                  <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                    <span style={{ color:textDim, fontSize:`${10*textSize}px` }}>{timeAgo(session.updatedAt)}</span>
                    <span style={{ color:textDim, fontSize:`${10*textSize}px` }}>·</span>
                    <span style={{ color:textDim, fontSize:`${10*textSize}px` }}>{msgCount(session)}</span>
                  </div>
                </div>
                <div style={{ color:goldDim, fontSize:"calc(18px * var(--ts, 1))", lineHeight:1, flexShrink:0, marginTop:"2px", transition:"transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  ⌄
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop:`1px solid ${goldBdr}` }}>
                  <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:"10px", maxHeight:"260px", overflowY:"auto" }}>
                    {preview.map((msg, i) => (
                      <div key={i} style={{
                        alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                        maxWidth:"90%",
                        background: msg.role === "user"
                          ? "var(--chip)"
                          : "var(--panel)",
                        border:`1px solid ${goldBdr}`,
                        borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                        padding:"8px 12px",
                      }}>
                        <div style={{ color:textDim, fontSize:`${9*textSize}px`, marginBottom:"3px", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                          {msg.role === "user" ? "You" : "NŪR"}
                        </div>
                        <div style={{ color:textClr, fontSize:`${12 * textSize}px`, lineHeight:1.6 }}>
                          {(msg.display || msg.content || "").slice(0, 200)}
                          {(msg.display || msg.content || "").length > 200 ? "…" : ""}
                        </div>
                      </div>
                    ))}
                    {(session.messages || []).length > 6 && (
                      <div style={{ color:textDim, fontSize:`${11*textSize}px`, textAlign:"center" }}>
                        + {(session.messages || []).length - 6} more messages
                      </div>
                    )}
                  </div>
                  <div style={{ padding:"0 14px 13px", display:"flex", gap:"8px" }}>
                    <button
                      onClick={() => onContinue(session)}
                      style={{ flex:1, padding:"10px", borderRadius:"10px", background:"var(--goldFill)", border:"none", color:"var(--onGold)", fontSize:`${13 * textSize}px`, fontWeight:800, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                      Continue →
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      style={{ padding:"10px 16px", borderRadius:"10px", background:"color-mix(in srgb,var(--warn) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 25%,transparent)", color:dangerClr, fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sessions.length > 0 && (
          <div style={{ marginTop:"20px", padding:"16px", background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px" }}>
            <div style={{ color:goldDim, fontSize:`${10*textSize}px`, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>
              Backup & Restore
            </div>
            <div style={{ color:textDim, fontSize:`${11 * textSize}px`, lineHeight:1.7, marginBottom:"14px" }}>
              Chats are stored only on this device. Back up to your Drive, iCloud, or email to keep them safe.
            </div>
            <button
              onClick={handleBackup}
              disabled={backupState === "saving"}
              style={{ width:"100%", padding:"11px", borderRadius:"10px", marginBottom:"8px",
                background: backupState === "done" ? "color-mix(in srgb,var(--green) 12%,transparent)" : goldFaint,
                border:`1px solid ${backupState === "done" ? greenClr : goldBdr}`,
                color: backupState === "done" ? greenClr : gold,
                fontSize:`${13 * textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              {backupState === "saving" ? "Preparing…" : backupState === "done" ? "✓ Backup saved!" : backupState === "error" ? "Failed — try again" : "📤 Save backup to Drive / Files"}
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importState === "importing"}
              style={{ width:"100%", padding:"11px", borderRadius:"10px",
                background: importState === "done" ? "color-mix(in srgb,var(--green) 12%,transparent)" : "transparent",
                border:`1px solid ${importState === "done" ? greenClr : importState === "error" ? dangerClr : goldBdr}`,
                color: importState === "done" ? greenClr : importState === "error" ? dangerClr : goldDim,
                fontSize:`${13 * textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
              {importState === "importing" ? "Importing…" : importMsg ? importMsg : "📥 Restore from backup file"}
            </button>
          </div>
        )}

        {sessions.length > 0 && !search && (
          <div style={{ marginTop:"16px", textAlign:"center" }}>
            {confirmAll ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", padding:"16px", background:"color-mix(in srgb,var(--warn) 7%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 20%,transparent)", borderRadius:"14px" }}>
                <div style={{ color:dangerClr, fontSize:`${13 * textSize}px`, fontWeight:600 }}>Delete all conversations?</div>
                <div style={{ display:"flex", gap:"10px" }}>
                  <button onClick={() => setConfirmAll(false)}
                    style={{ padding:"8px 20px", borderRadius:"10px", background:goldFaint, border:`1px solid ${goldBdr}`, color:goldDim, fontSize:`${13*textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                    Cancel
                  </button>
                  <button onClick={handleClearAll}
                    style={{ padding:"8px 20px", borderRadius:"10px", background:"color-mix(in srgb,var(--warn) 15%,transparent)", border:"1px solid color-mix(in srgb,var(--warn) 35%,transparent)", color:dangerClr, fontSize:`${13*textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
                    Delete All
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmAll(true)}
                style={{ background:"none", border:"none", color:textDim, fontSize:`${12*textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif", textDecoration:"underline", padding:"8px" }}>
                Delete all conversations
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
