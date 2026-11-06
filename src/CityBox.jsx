import { useState, useRef, useEffect, useId } from "react";
import { useCitySuggestions } from "./cities.js";

// Text input with a live list of matching cities. Picking a row calls onPick(place);
// Enter with no row highlighted calls onSubmit(text) so the caller can still resolve free text.
// `wrapStyle` lets a page restyle the container (e.g. the Qibla search pill); `leading` is an optional icon.
export default function CityBox({
  value, onChange, onPick, onSubmit, placeholder, inputStyle, wrapStyle, leading, ariaLabel = "Search a city", autoFocus,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [picked, setPicked] = useState(false);
  const box = useRef(null);
  const listId = useId();
  const { items, busy, done } = useCitySuggestions(value, open && !picked);

  useEffect(() => {
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); };
  }, []);

  const choose = p => { setPicked(true); setOpen(false); setHi(-1); onChange(p.label); onPick(p); };

  const onKey = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); setHi(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (open && hi >= 0 && items[hi]) choose(items[hi]);
      else { setOpen(false); onSubmit && onSubmit(value); }
    }
  };

  const showList = open && !picked && value.trim().length > 0 && (items.length > 0 || busy || done);

  return (
    <div ref={box} style={{ position: "relative", flex: 1, minWidth: 0, ...wrapStyle }}>
      {leading}
      <input
        value={value} autoFocus={autoFocus} autoComplete="off" autoCorrect="off" spellCheck={false}
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" aria-label={ariaLabel}
        aria-activedescendant={hi >= 0 ? `${listId}-${hi}` : undefined}
        onChange={e => { setPicked(false); setHi(-1); setOpen(true); onChange(e.target.value); }}
        onKeyDown={onKey}
        placeholder={placeholder}
        style={inputStyle}
      />
      {showList && (
        <ul id={listId} role="listbox" className="city-list">
          {items.map((p, i) => (
            <li key={`${p.label}-${p.lat}`} id={`${listId}-${i}`} role="option" aria-selected={i === hi}
              className={"city-opt" + (i === hi ? " on" : "")}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => { e.preventDefault(); choose(p); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM9.6 10a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0"/></svg>
              <span className="city-nm">{p.name}</span>
              <span className="city-sub">{[p.region !== p.name ? p.region : "", p.country].filter(Boolean).join(", ")}</span>
            </li>
          ))}
          {items.length === 0 && (
            <li className="city-empty" role="presentation">{busy ? "Searching…" : "No matching cities. Check the spelling or try a nearby larger city."}</li>
          )}
        </ul>
      )}
    </div>
  );
}
