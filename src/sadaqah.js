import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Sadaqah / Support NŪR — configuration
//
// Paste your pay-what-you-want links below. Leave a link empty ("") if you
// don't have one yet — if BOTH are empty, every sadaqah button and menu item
// stays hidden (the Friday card still appears, without the sadaqah section).
//
//   SADAQAH_LINK_IN      → Razorpay Payment Page (customer chooses amount)
//   SADAQAH_LINK_GLOBAL  → Ko-fi / Buy Me a Coffee link for everyone else
//
// If only one is filled in, it is used for everybody.
// ─────────────────────────────────────────────────────────────────────────────
export const SADAQAH_LINK_IN     = "";
export const SADAQAH_LINK_GLOBAL = "";

export const SADAQAH_ENABLED = Boolean(SADAQAH_LINK_IN || SADAQAH_LINK_GLOBAL);

export const FRIDAY_KEY = "nur_friday_shown";

const COUNTRY_CACHE = "nur_is_india";

export function pickSadaqahLink(isIndia) {
  return isIndia
    ? (SADAQAH_LINK_IN     || SADAQAH_LINK_GLOBAL)
    : (SADAQAH_LINK_GLOBAL || SADAQAH_LINK_IN);
}

function readCachedIndia() {
  try { return sessionStorage.getItem(COUNTRY_CACHE); } catch { return null; }
}

// Returns the right sadaqah link for this visitor's region ("" if none set).
export function useSadaqahLink() {
  const [isIndia, setIsIndia] = useState(() => readCachedIndia() === "1");

  useEffect(() => {
    if (!SADAQAH_ENABLED || readCachedIndia() !== null) return;
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(d => {
        const v = d.country_code === "IN";
        try { sessionStorage.setItem(COUNTRY_CACHE, v ? "1" : "0"); } catch {}
        setIsIndia(v);
      })
      .catch(() => {});
  }, []);

  return pickSadaqahLink(isIndia);
}

// True at most once per device per Friday (device's local day). Marks the
// card as shown the moment it returns true.
export function shouldShowFridayCard() {
  try {
    const now = new Date();
    if (now.getDay() !== 5) return false;
    const today = now.toLocaleDateString("en-CA");
    if (localStorage.getItem(FRIDAY_KEY) === today) return false;
    localStorage.setItem(FRIDAY_KEY, today);
    return true;
  } catch {
    return false;
  }
}
