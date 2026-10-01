import { SADAQAH_ENABLED, useSadaqahLink } from "./sadaqah.js";
import { trackEvent } from "./analytics.js";

// Jumu'ah card — shown once per user on Fridays (see shouldShowFridayCard).
export default function FridayCard({ onClose, onReadKahf, lightMode, textSize = 1, name }) {
  const sadaqahUrl = useSadaqahLink();

  const gold     = lightMode ? "#7a5810" : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.6)" : "rgba(201,168,76,0.6)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.25)" : "rgba(201,168,76,0.25)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)" : "rgba(201,168,76,0.08)";
  const textClr  = lightMode ? "rgba(26,15,0,0.85)" : "rgba(255,255,240,0.85)";
  const textDim  = lightMode ? "rgba(26,15,0,0.55)" : "rgba(255,255,255,0.5)";
  const cardBg   = lightMode ? "#fdf8ed" : "#0d1f14";
  const btnText  = lightMode ? "#fff" : "#0d1f14";
  const btnBg    = `linear-gradient(135deg,${gold},${lightMode ? "#a07020" : "#a8862e"})`;

  const label = { color:gold, fontSize:`${11*textSize}px`, fontWeight:800, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"8px" };
  const body  = { color:textDim, fontSize:`${12.5*textSize}px`, lineHeight:1.7 };
  const block = { background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"14px 16px", marginBottom:"12px" };

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, zIndex:900, background:"rgba(0,0,0,0.62)", backdropFilter:"blur(5px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width:"100%", maxWidth:"380px", maxHeight:"90vh", overflowY:"auto", background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"22px", padding:"26px 20px 20px", boxShadow:"0 20px 60px rgba(0,0,0,0.45)", fontFamily:"Nunito,sans-serif" }}>

        {/* Greeting */}
        <div style={{ textAlign:"center", marginBottom:"18px" }}>
          <div style={{ color:gold, fontSize:`${28*textSize}px`, fontFamily:"Georgia,serif", marginBottom:"4px" }}>جُمُعَة مُبَارَكَة</div>
          <div style={{ color:textClr, fontSize:`${18*textSize}px`, fontWeight:800 }}>Jumu'ah Mubarak 🌙</div>
          {name && <div style={{ color:textDim, fontSize:`${12.5*textSize}px`, marginTop:"4px" }}>As-salamu alaykum, {name}</div>}
        </div>

        {/* Surah */}
        <div style={block}>
          <div style={label}>Recite today</div>
          <div style={{ color:textClr, fontSize:`${15*textSize}px`, fontWeight:700, marginBottom:"4px" }}>Surah Al-Kahf (18)</div>
          <div style={body}>
            It is reported that whoever recites it on Friday is given a light that shines between the two Fridays. (al-Ḥākim, al-Bayhaqī)
          </div>
          <button onClick={onReadKahf}
            style={{ marginTop:"10px", padding:"9px 18px", borderRadius:"20px", background:"transparent", border:`1px solid ${gold}`, color:gold, fontSize:`${12.5*textSize}px`, fontWeight:700, cursor:"pointer", fontFamily:"Nunito,sans-serif" }}>
            Read Al-Kahf →
          </button>
        </div>

        {/* Adhkar */}
        <div style={block}>
          <div style={label}>Adhkar for today</div>

          <div style={{ color:textClr, fontSize:`${13.5*textSize}px`, fontWeight:700, marginBottom:"2px" }}>Send abundant salawat upon the Prophet ﷺ</div>
          <div style={{ color:gold, fontSize:`${19*textSize}px`, fontFamily:"Georgia,serif", textAlign:"center", margin:"8px 0 4px", lineHeight:1.9 }}>
            اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ
          </div>
          <div style={{ ...body, marginBottom:"12px" }}>The Prophet ﷺ encouraged increasing salawat upon him on Fridays. (Abū Dāwūd, Ibn Mājah)</div>

          <div style={{ color:textClr, fontSize:`${13.5*textSize}px`, fontWeight:700, marginBottom:"2px" }}>Make dua and istighfar</div>
          <div style={{ color:gold, fontSize:`${18*textSize}px`, fontFamily:"Georgia,serif", textAlign:"center", margin:"8px 0 4px", lineHeight:1.9 }}>
            أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ
          </div>
          <div style={body}>Friday has an hour in which dua is accepted. Many scholars place it between Asr and Maghrib. Allahu A'lam.</div>
        </div>

        {/* Sadaqah */}
        {SADAQAH_ENABLED && sadaqahUrl && (
          <div style={{ ...block, textAlign:"center" }}>
            <div style={{ color:textClr, fontSize:`${14*textSize}px`, fontWeight:700, marginBottom:"4px" }}>Friday is a blessed day for giving</div>
            <div style={{ ...body, marginBottom:"12px" }}>
              Give sadaqah jariyah to keep NŪR free for everyone. Any amount helps with servers and AI costs.
            </div>
            <a href={sadaqahUrl} target="_blank" rel="noreferrer"
              onClick={() => trackEvent("sadaqah_click", { source:"friday_card" })}
              style={{ display:"block", padding:"13px", borderRadius:"50px", background:btnBg, color:btnText, fontSize:`${15*textSize}px`, fontWeight:800, textDecoration:"none" }}>
              💛 Give sadaqah
            </a>
          </div>
        )}

        <button onClick={onClose}
          style={{ display:"block", margin:"6px auto 0", background:"none", border:"none", color:goldDim, fontSize:`${13*textSize}px`, cursor:"pointer", fontFamily:"Nunito,sans-serif", padding:"8px 16px" }}>
          Close
        </button>
      </div>
    </div>
  );
}
