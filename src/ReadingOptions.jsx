import { useReadingPrefs, setReadingOpt, resetReading } from "./readingPrefs.js";

const lbl = { fontSize:"calc(11px * var(--ts, 1))", fontWeight:700, letterSpacing:"1.8px", color:"var(--faint)", margin:"18px 0 9px" };

function Pills({ options, value, k, lang, sample, fontOf }) {
  return (
    <div role="radiogroup" style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      {options.map(([id, label]) => {
        const on = value === id;
        return (
          <button key={id} role="radio" aria-checked={on} className="cb" onClick={() => setReadingOpt(k, id)}
            style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", borderRadius:"12px", border:`1px solid ${on ? "var(--gold)" : "var(--lineSoft)"}`, background:on ? "var(--active)" : "var(--panel)", cursor:"pointer", textAlign:"left" }}>
            <span lang={lang} style={{ fontFamily:fontOf[id], fontSize:lang === "ar" ? "22px" : "17px", color:"var(--text)", minWidth:"54px" }}>{sample}</span>
            <span style={{ fontSize:"calc(13px * var(--ts, 1))", fontWeight:700, color:on ? "var(--gold)" : "var(--dim)" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Slider({ id, label, k, min, max, step, value, fmt }) {
  return (
    <div style={{ marginBottom:"14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
        <label htmlFor={id} style={{ fontSize:"calc(13px * var(--ts, 1))", fontWeight:600, color:"var(--dim)" }}>{label}</label>
        <span style={{ fontSize:"calc(12.5px * var(--ts, 1))", fontWeight:700, color:"var(--gold)" }}>{fmt(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => setReadingOpt(k, parseFloat(e.target.value))} style={{ width:"100%", accentColor:"var(--gold)" }}/>
    </div>
  );
}

function Switch({ label, k, on }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0" }}>
      <span style={{ fontSize:"calc(13.5px * var(--ts, 1))", fontWeight:600, color:"var(--text)" }}>{label}</span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => setReadingOpt(k, !on)}
        style={{ position:"relative", width:"40px", height:"22px", borderRadius:"11px", border:`1px solid ${on ? "var(--gold)" : "var(--line)"}`, background:on ? "var(--goldFill)" : "var(--panel2)", cursor:"pointer", padding:0 }}>
        <span style={{ position:"absolute", top:"2px", left:on ? "20px" : "2px", width:"16px", height:"16px", borderRadius:"50%", background:on ? "var(--onGold)" : "var(--faint)", transition:"left .15s" }}/>
      </button>
    </div>
  );
}

export default function ReadingOptions() {
  const o = useReadingPrefs();
  const AR = { amiri:"'Amiri', serif", scheherazade:"'Scheherazade New', serif", naskh:"'Noto Naskh Arabic', serif" };
  const EN = { nunito:"'Nunito', system-ui, sans-serif", lora:"'Lora', Georgia, serif" };
  return (
    <aside className="nur-rightpane" aria-label="Reading options" style={{ width:"320px" }}>
      <div style={{ flex:"none", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 20px 0" }}>
        <span className="hd" style={{ fontSize:"calc(22px * var(--ts, 1))", color:"var(--gold)" }}>Reading options</span>
        <button className="cb" onClick={resetReading} style={{ display:"flex", alignItems:"center", gap:"6px", height:"32px", padding:"0 12px", borderRadius:"10px", border:"1px solid var(--line)", background:"var(--chip)", color:"var(--gold)", fontSize:"calc(12.5px * var(--ts, 1))", fontWeight:700, cursor:"pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Reset
        </button>
      </div>
      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"4px 20px 24px" }}>
        <div style={{ fontSize:"calc(12.5px * var(--ts, 1))", color:"var(--faint)", marginTop:"8px" }}>Shared by the Quran and Hadith tabs.</div>
        <div style={lbl}>ARABIC FONT</div>
        <Pills options={[["amiri","Amiri"],["scheherazade","Scheherazade"],["naskh","Noto Naskh"]]} value={o.arFont} k="arFont" lang="ar" sample="اللَّهِ" fontOf={AR}/>
        <div style={lbl}>READING FONT</div>
        <Pills options={[["nunito","Nunito · Sans"],["lora","Lora · Serif"]]} value={o.enFont} k="enFont" lang="en" sample="Patience" fontOf={EN}/>
        <div style={lbl}>TEXT SIZE</div>
        <Slider id="rd-arSize" label="Arabic size" k="arSize" min={22} max={56} step={1} value={o.arSize} fmt={v => v + " px"}/>
        <Slider id="rd-enSize" label="Translation size" k="enSize" min={13} max={26} step={0.5} value={o.enSize} fmt={v => v + " px"}/>
        <Slider id="rd-width" label="Reading width" k="width" min={560} max={900} step={20} value={o.width} fmt={v => v + " px"}/>
        <div style={lbl}>SPACING</div>
        <Slider id="rd-arLh" label="Arabic line height" k="arLh" min={1.5} max={3} step={0.1} value={o.arLh} fmt={v => Number(v).toFixed(1)}/>
        <Slider id="rd-enLh" label="Translation line height" k="enLh" min={1.3} max={2.4} step={0.1} value={o.enLh} fmt={v => Number(v).toFixed(1)}/>
        <Slider id="rd-gap" label="Space between cards" k="gap" min={8} max={44} step={2} value={o.gap} fmt={v => v + " px"}/>
        <div style={lbl}>SHOW</div>
        <Switch label="Arabic text" k="showAr" on={o.showAr}/>
        <Switch label="Translation" k="showTr" on={o.showTr}/>
        <Switch label="Verse and hadith numbers" k="showNum" on={o.showNum}/>
      </div>
    </aside>
  );
}
