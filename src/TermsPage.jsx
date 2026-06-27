export default function TermsPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const gold     = lightMode ? "#7a5810"                 : "#c9a84c";
  const goldDim  = lightMode ? "rgba(122,88,16,0.55)"   : "rgba(201,168,76,0.5)";
  const goldBdr  = lightMode ? "rgba(122,88,16,0.2)"    : "rgba(201,168,76,0.2)";
  const goldFaint= lightMode ? "rgba(122,88,16,0.08)"   : "rgba(201,168,76,0.07)";
  const textClr  = lightMode ? "rgba(26,15,0,0.82)"     : "rgba(255,255,240,0.82)";
  const textDim  = lightMode ? "rgba(26,15,0,0.4)"      : "rgba(255,255,255,0.38)";
  const headerBg = lightMode ? "rgba(253,248,237,0.97)" : "rgba(8,21,16,0.95)";
  const cardBg   = lightMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.04)";

  const Section = ({ title, children }) => (
    <div style={{ marginBottom:"22px" }}>
      <div style={{ color:gold, fontSize:`${11 * textSize}px`, fontWeight:800, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"10px" }}>
        {title}
      </div>
      <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px" }}>
        {children}
      </div>
    </div>
  );

  const P = ({ children, last }) => (
    <p style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8, margin:last?"0":"0 0 10px 0" }}>{children}</p>
  );

  const Bold = ({ children }) => (
    <span style={{ color:textClr, fontWeight:700 }}>{children}</span>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onOpenSidebar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"13px", height:"2px", background:gold, borderRadius:"2px" }}/>
          <div style={{ width:"18px", height:"2px", background:gold, borderRadius:"2px" }}/>
        </button>
        <div style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Terms of Use</div>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"20px", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0 }}>←</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 52px" }}>

        <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginBottom:"20px" }}>Last updated: June 2026 · Beta Release</div>

        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"24px" }}>
          <div style={{ color:gold, fontSize:`${13 * textSize}px`, fontWeight:800, marginBottom:"8px" }}>
            ⚠️ Important — Read This First
          </div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            NŪR is an <Bold>educational tool</Bold>, not a source of religious authority. AI responses are generated for learning purposes and <Bold>must not replace the guidance of a qualified Islamic scholar (Alim)</Bold>. For personal religious rulings (fatwa), legal matters, or important Islamic decisions — always consult a qualified scholar.
          </div>
          <div style={{ color:goldDim, fontSize:`${12 * textSize}px`, lineHeight:1.6, marginTop:"10px", fontStyle:"italic" }}>
            Allahu A'lam — Allah knows best.
          </div>
        </div>

        <Section title="Acceptance of Terms">
          <P>By using NŪR, you agree to these Terms of Use. If you do not agree, please discontinue use of the app.</P>
          <P last>NŪR is currently in <Bold>Beta</Bold>. Features may change, be removed, or experience downtime as we improve the product.</P>
        </Section>

        <Section title="Educational Purpose Only">
          <P>NŪR is designed to help Muslims and those curious about Islam explore the Quran, Hadith, and Islamic knowledge. The app is intended for personal learning, reflection, and general Islamic education.</P>
          <P last>NŪR is <Bold>not intended</Bold> to be used as a source for issuing or receiving religious rulings, fatwas, or authoritative legal opinions.</P>
        </Section>

        <Section title="AI Disclaimer">
          <P>The AI chat feature generates responses based on information from the Quran and canonical Hadith collections. While we strive for accuracy:</P>
          <P>· <Bold>AI can make errors.</Bold> Responses may occasionally be incomplete, miscontextualised, or inaccurate.</P>
          <P>· Citations are provided so you can verify information yourself in the Quran and Hadith tabs.</P>
          <P>· The AI is instructed to acknowledge uncertainty and recommend scholarly consultation for complex matters.</P>
          <P last>You are responsible for verifying any AI-generated information before acting on it. We recommend cross-referencing with qualified scholars and authoritative Islamic sources.</P>
        </Section>

        <Section title="Content & Third-Party Sources">
          <P last>NŪR uses reputable third-party sources and services to provide Quran content, Hadith references, prayer times, and related Islamic features. While we strive for accuracy, we cannot guarantee that all content is free from errors, omissions, or differences in scholarly interpretation. For critical matters, always refer to authoritative Islamic sources and qualified scholars.</P>
        </Section>

        <Section title="Pro Subscription">
          <P>Pro is a <Bold>lifetime, one-time purchase</Bold> that removes ads and unlocks unlimited daily AI messages. "Lifetime" refers to the lifetime of the NŪR product.</P>
          <P>· Pro pricing: ₹299 (India) or $2.99 (international)</P>
          <P>· Payments are processed by Razorpay (India) or LemonSqueezy (international)</P>
          <P>· License keys are non-transferable and tied to the device on which they are activated</P>
          <P last>Refunds are handled on a case-by-case basis. Contact us via the Feedback page if you experience a payment issue.</P>
        </Section>

        <Section title="Acceptable Use">
          <P last>You agree not to use NŪR to spread misinformation about Islam, attempt to circumvent usage limits through technical means, or use the app in any way that violates applicable laws in your jurisdiction.</P>
        </Section>

        <Section title="Limitation of Liability">
          <P last>NŪR is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for decisions made based on AI-generated responses, service interruptions or data loss, or any harm arising from the use or inability to use NŪR.</P>
        </Section>

        <Section title="Changes & Contact">
          <P>We may update these terms as NŪR evolves. Continued use after changes means you accept the revised terms.</P>
          <P last>For questions, use the Feedback page inside NŪR or reach us on Instagram <Bold>@nur.islamic.ai</Bold>.</P>
        </Section>

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontFamily:"Georgia,serif", marginBottom:"5px" }}>
            وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ
          </div>
          <div style={{ color:textDim, fontSize:`${11*textSize}px` }}>"My success is only through Allah" — Hud 11:88</div>
        </div>

      </div>
    </div>
  );
}
