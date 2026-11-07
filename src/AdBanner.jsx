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
const ADSTERRA_KEY        = "893a395d1f6207394533f25b9ef5e695";   // ← Paste your Adsterra key here
const ADSTERRA_INVOKE_URL = "https://www.highrevenueformat.com/893a395d1f6207394533f25b9ef5e695/invoke.js";   // ← Paste your Adsterra invoke.js URL here

// Website view shows the ad in the sidebar as a 300×250 rectangle (the
// 300×250 Banner unit created in Adsterra for nurislamicai.app). If either value
// is ever cleared, the slot falls back to the 320×50 unit above.
const ADSTERRA_RECT_KEY        = "50eb6887d5a004ef6129192f037001cf";
const ADSTERRA_RECT_INVOKE_URL = "https://bauval.org/22/50eb6887d5a004ef6129192f037001cf";

export default function AdBanner({ unlocked, lightMode, variant = "strip" }) {
  const isSlot  = variant === "slot";
  const useRect = isSlot && ADSTERRA_RECT_KEY && ADSTERRA_RECT_INVOKE_URL;
  const adKey   = useRect ? ADSTERRA_RECT_KEY : ADSTERRA_KEY;
  const adUrl   = useRect ? ADSTERRA_RECT_INVOKE_URL : ADSTERRA_INVOKE_URL;
  const adW     = useRect ? 300 : 320;
  const adH     = useRect ? 250 : 50;
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
      'key': '${adKey}',
      'format': 'iframe',
      'height': ${adH},
      'width': ${adW},
      'params': {}
    };`;

    const s2 = document.createElement("script");
    s2.type  = "text/javascript";
    s2.src   = adUrl;

    containerRef.current.appendChild(s1);
    containerRef.current.appendChild(s2);
  }, [unlocked]);

  // Hidden for Pro users or until key is configured
  if (unlocked || !ADSTERRA_KEY || !ADSTERRA_INVOKE_URL) return null;

  const gold = "var(--gold)";
  const borderC = "var(--chip)";
  const bg = "var(--head)";

  if (isSlot) {
    return (
      <div style={{ flex:"none", padding:"12px 15px 14px", borderTop:"1px solid var(--lineSoft)" }}>
        <div style={{ textAlign:"center", fontSize:"9.5px", fontWeight:700, letterSpacing:"1.8px", color:"var(--faint)" }}>ADVERTISEMENT</div>
        <div ref={containerRef} style={{ width:`${adW}px`, maxWidth:"100%", height:`${adH}px`, margin:"6px auto 0", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"12px" }}/>
      </div>
    );
  }

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
        color: "var(--line)",
        fontSize:"9px", letterSpacing:"1px", fontFamily:"inherit",
      }}>AD</div>

      {/* Adsterra injects the iframe into this div */}
      <div ref={containerRef} style={{
        width:"320px", height:"50px", overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}/>
    </div>
  );
}
