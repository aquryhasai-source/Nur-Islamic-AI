import { useState, useEffect } from "react";

// Presentation-only helper: tracks a CSS media query so the layout can switch
// between the phone view (drawer sidebar) and the website view (docked sidebar).
export const DOCK_QUERY = "(min-width: 1024px)";

export function useMedia(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, [query]);
  return match;
}
