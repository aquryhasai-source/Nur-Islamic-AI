import { useEffect, useRef } from "react";

// First-visit notice shown when someone arrives at /app. Accepting is remembered on this device
// (CONSENT_VERSION lets us ask again if the notice or the legal pages change materially).
export const CONSENT_KEY = "nur_consent";
export const CONSENT_VERSION = "2026-11";

export function hasConsented() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    return !!c && c.accepted === true && c.v === CONSENT_VERSION;
  } catch { return false; }
}
export function saveConsent() {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ accepted: true, v: CONSENT_VERSION, at: new Date().toISOString() })); } catch {}
}

const B = ({ children }) => <strong style={{ color: "var(--text)", fontWeight: 700 }}>{children}</strong>;

export default function ConsentModal({ onAccept, onDeny, onOpenPage }) {
  const accept = useRef(null);
  useEffect(() => { accept.current?.focus(); }, []);
  const link = { background: "none", border: 0, padding: 0, font: "inherit", color: "var(--gold)", fontWeight: 700, textDecoration: "underline", cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-body"
        style={{ width: "100%", maxWidth: "460px", margin: "auto", background: "var(--pop)", border: "1px solid var(--line)", borderRadius: "20px", padding: "22px 22px 20px", boxShadow: "0 24px 60px rgba(0,0,0,.45)" }}>
        <div id="consent-title" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--gold)", fontSize: "calc(17px * var(--ts, 1))", fontWeight: 800, marginBottom: "10px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.2M12 17h.01"/></svg>
          Important — Read This First
        </div>
        <div id="consent-body" style={{ color: "var(--dim)", fontSize: "calc(14px * var(--ts, 1))", lineHeight: 1.75 }}>
          NŪR is an <B>educational tool</B>, not a source of religious authority. AI responses are generated for learning purposes and <B>must not replace the guidance of a qualified Islamic scholar (Alim)</B>. For personal religious rulings (fatwa), legal matters, or important Islamic decisions — always consult a qualified scholar.
        </div>
        <div style={{ color: "var(--goldDim, var(--gold))", opacity: 0.85, fontSize: "calc(14px * var(--ts, 1))", lineHeight: 1.6, marginTop: "10px", fontStyle: "italic" }}>
          Allahu A'lam — Allah knows best.
        </div>

        <div style={{ borderTop: "1px solid var(--lineSoft)", marginTop: "16px", paddingTop: "14px", color: "var(--faint)", fontSize: "calc(12.5px * var(--ts, 1))", lineHeight: 1.7 }}>
          By tapping Accept you agree to the{" "}
          <button type="button" style={link} onClick={() => onOpenPage("terms")}>Terms of Use</button>
          {" "}and acknowledge the{" "}
          <button type="button" style={link} onClick={() => onOpenPage("privacy")}>Privacy Policy</button>.
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button type="button" onClick={onDeny}
            style={{ flex: 1, height: "46px", borderRadius: "12px", background: "transparent", border: "1px solid var(--line)", color: "var(--dim)", fontFamily: "inherit", fontSize: "calc(14px * var(--ts, 1))", fontWeight: 700, cursor: "pointer" }}>
            Deny
          </button>
          <button type="button" ref={accept} onClick={onAccept}
            style={{ flex: 1.3, height: "46px", borderRadius: "12px", background: "var(--goldFill)", border: "none", color: "var(--onGold)", fontFamily: "inherit", fontSize: "calc(14px * var(--ts, 1))", fontWeight: 800, cursor: "pointer" }}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
