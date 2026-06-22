import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Adsterra Banner — 320×50 Mobile Banner
//
// Setup (takes ~2 minutes):
//   1. Log in to Adsterra → My Sites → your site → Get Code
//   2. Choose format: "Banner", size: 320×50
//   3. Copy the two values from the snippet they give you:
//        atOptions = { 'key': 'XXXX...', ... }
//        src="//www.someadnetwork.com/XXXX.../invoke.js"
//   4. Paste them into the two constants below and redeploy.
//
// Until the key is set, this component renders nothing (safe to deploy now).
// ─────────────────────────────────────────────────────────────────────────────
const ADSTERRA_KEY        = "b5330d4e1e27c1ffd3e87c17a432aec8";   // ← Paste your Adsterra key here
const ADSTERRA_INVOKE_URL = "https://www.highperformanceformat.com/b5330d4e1e27c1ffd3e87c17a432aec8/invoke.js";   // ← Paste your Adsterra invoke.js URL here

export default function AdBanner({ unlocked, lightMode }) {
  const containerRef = useRef(null);
  const injected     = useRef(false);

  useEffect(() => {
    // Don't show ads to Pro users
    if (unlocked) return;
    // Don't inject twice (React StrictMode runs effects twice in dev)
    if (injected.current || !containerRef.current) return;
    // Don't inject if the key isn't configured yet
    if (!ADSTERRA_KEY || !ADSTERRA_INVOKE_URL) return;

    injected.current = true;

    const s1 = document.createElement("script");
    s1.innerHTML = `atOptions = {
      'key': '${ADSTERRA_KEY}',
      'format': 'iframe',
      'height': 50,
      'width': 320,
      'params': {}
    };`;

    const s2 = document.createElement("script");
    s2.type  = "text/javascript";
    s2.src   = ADSTERRA_INVOKE_URL;

    containerRef.current.appendChild(s1);
    containerRef.current.appendChild(s2);
  }, [unlocked]);

  // Hidden for Pro users or until key is configured
  if (unlocked || !ADSTERRA_KEY || !ADSTERRA_INVOKE_URL) return null;

  const gold    = lightMode ? "#7a5810" : "#c9a84c";
  const borderC = lightMode ? "rgba(122,88,16,0.12)" : "rgba(201,168,76,0.08)";
  const bg      = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.92)";

  return (
    <div style={{
      width:"100%", height:"60px", flexShrink:0,
      background:bg,
      borderBottom:`1px solid ${borderC}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      position:"relative",
    }}>
      {/* Transparent "Ad" label — keeps user trust */}
      <div style={{
        position:"absolute", top:"4px", right:"8px",
        color: lightMode ? "rgba(122,88,16,0.25)" : "rgba(201,168,76,0.2)",
        fontSize:"9px", letterSpacing:"1px", fontFamily:"Nunito,sans-serif",
      }}>AD</div>

      {/* Adsterra injects the iframe into this div */}
      <div ref={containerRef} style={{
        width:"320px", height:"50px", overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}/>
    </div>
  );
}
