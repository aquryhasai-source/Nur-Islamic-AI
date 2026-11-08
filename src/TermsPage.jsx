import { Children } from "react";
import { useMedia, DOCK_QUERY } from "./useMedia.js";
import LegalLayout, { slugOf } from "./LegalLayout.jsx";
import { Icon } from "./Icons.jsx";

const TOC = ["Acceptance of Terms", "Educational Purpose Only", "AI Disclaimer", "Your Questions & Saved Data", "Content & Third-Party Sources", "Usage Limits & Fair Use", "Pro Subscription", "Acceptable Use", "Security & Enforcement", "Limitation of Liability", "Changes & Contact"];

export default function TermsPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
  const docked = useMedia(DOCK_QUERY);
  const gold = "var(--gold)";
  const goldDim = "var(--goldDim)";
  const goldBdr = "var(--line)";
  const goldFaint = "var(--chip)";
  const textClr = "var(--text)";
  const textDim = "var(--dim)";
  const headerBg = "var(--head)";
  const cardBg = "var(--panel)";

  const Section = ({ title, children }) => docked ? (
    <section id={slugOf(title)} className="card" style={{ padding:"26px 30px", marginBottom:"20px", scrollMarginTop:"8px" }}>
      <h2 className="h2" style={{ fontSize:`${24*textSize}px`, marginBottom:"16px" }}>{title}</h2>
      {children}
    </section>
  ) : (
    <div style={{ marginBottom:"22px" }}>
      <div style={{ color:gold, fontFamily:"var(--font-head)", fontSize:`${17 * textSize}px`, fontWeight:700, letterSpacing:"0.5px", marginBottom:"10px" }}>
        {title}
      </div>
      <div style={{ background:cardBg, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px" }}>
        {children}
      </div>
    </div>
  );

  const P = ({ children, last }) => {
    if (docked) {
      const arr = Children.toArray(children);
      const first = typeof arr[0] === "string" ? arr[0] : "";
      const body = { fontSize:`${14*textSize}px`, fontWeight:500, lineHeight:1.75, color:textDim };
      if (first.startsWith("· ")) {
        const rest = [first.replace(/^·[\s\u00a0]*/, ""), ...arr.slice(1)];
        return (
          <div style={{ display:"flex", alignItems:"flex-start", gap:"12px", marginBottom:last?0:"10px" }}>
            <span style={{ flex:"none", marginTop:"10px", width:"5px", height:"5px", borderRadius:"50%", background:"var(--gold)" }}/>
            <span style={body}>{rest}</span>
          </div>
        );
      }
      return <p style={{ ...body, margin:last?"0":"0 0 12px 0" }}>{children}</p>;
    }
    return <p style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8, margin:last?"0":"0 0 10px 0" }}>{children}</p>;
  };

  const Bold = ({ children }) => (
    <span style={{ color:textClr, fontWeight:700 }}>{children}</span>
  );

  const sections = (
    <>
        <Section title="Acceptance of Terms">
          <P>By using NŪR, you agree to these Terms of Use and to our Privacy Policy, which explains what data we handle. If you do not agree, please discontinue use of the app.</P>
          <P last>NŪR is currently in <Bold>Beta</Bold>. Features may change, be removed, or experience downtime as we improve the product. We may also change usage limits, AI providers or security measures at any time.</P>
        </Section>

        <Section title="Educational Purpose Only">
          <P>NŪR is designed to help Muslims and those curious about Islam explore the Quran, Hadith, and Islamic knowledge. The app is intended for personal learning, reflection, and general Islamic education.</P>
          <P last>NŪR is <Bold>not intended</Bold> to be used as a source for issuing or receiving religious rulings, fatwas, or authoritative legal opinions.</P>
        </Section>

        <Section title="AI Disclaimer">
          <P>The AI chat feature finds passages from the Quran and canonical Hadith collections that relate to your question, and an AI model uses them to write a response. While we strive for accuracy:</P>
          <P>· <Bold>AI can make errors.</Bold> Responses may occasionally be incomplete, miscontextualised, or inaccurate, and the passages found may not be the most relevant ones for your question.</P>
          <P>· Quran and Hadith references in a response are checked against the passages we found, and references that do not match are removed. A checked reference does not guarantee that the response interprets it correctly. Use the citations to verify information yourself in the Quran and Hadith tabs.</P>
          <P>· Common questions about NŪR itself (such as who made it, pricing and privacy) are answered with fixed, pre-written answers. If one ever differs from these Terms or the Privacy Policy, the Terms and Privacy Policy apply.</P>
          <P>· The AI is instructed to acknowledge uncertainty and recommend scholarly consultation for complex matters.</P>
          <P last>You are responsible for verifying any AI-generated information before acting on it. We recommend cross-referencing with qualified scholars and authoritative Islamic sources.</P>
        </Section>

        <Section title="Your Questions & Saved Data">
          <P>When you use AI chat, your questions are sent to our server and to the Groq AI service to produce an answer. Simple, general questions and their answers may be saved anonymously for 90 days to check and improve answer quality, as described in the Privacy Policy.</P>
          <P>· Do not enter personal, confidential, medical, legal or financial information into the chat.</P>
          <P>· Your chat history is kept only on your device. Clearing your browser data deletes it.</P>
          <P last>You are responsible for what you type and for keeping your device and your Pro unlock code safe.</P>
        </Section>

        <Section title="Content & Third-Party Sources">
          <P last>NŪR uses reputable third-party sources and services to provide Quran content, Hadith references, prayer times, and related Islamic features. While we strive for accuracy, we cannot guarantee that all content is free from errors, omissions, or differences in scholarly interpretation. For critical matters, always refer to authoritative Islamic sources and qualified scholars.</P>
        </Section>

        <Section title="Usage Limits & Fair Use">
          <P>To keep NŪR available for everyone, we apply limits:</P>
          <P>· Free: 15 AI messages per day, resetting at your local midnight. Pro: unlimited for normal personal use, subject to a generous daily fair-use ceiling.</P>
          <P>· Short-term rate limits apply to everyone, so if you send messages very quickly you may be asked to wait a moment.</P>
          <P>· The service has an overall daily capacity. When it is reached, or when our AI provider is busy, AI answers may be temporarily unavailable. A message that does not produce an answer is not counted against your daily limit.</P>
          <P last>We may change these limits as NŪR grows.</P>
        </Section>

        <Section title="Pro Subscription">
          <P>Pro is a <Bold>lifetime, one-time purchase</Bold> that removes ads and unlocks unlimited daily AI messages for normal personal use. "Lifetime" refers to the lifetime of the NŪR product.</P>
          <P>· Pro pricing: ₹299 (India) or $2.99 (international)</P>
          <P>· Payments are processed by Razorpay (India) or LemonSqueezy (international)</P>
          <P>· Your unlock code is emailed to the address used at checkout. It is personal, may not be shared or resold, and can be active on up to 3 devices at once</P>
          <P>· If a payment is refunded, the licence for that payment is cancelled automatically</P>
          <P last>Refunds are handled on a case-by-case basis. Contact us via the Feedback page if you experience a payment issue.</P>
        </Section>

        <Section title="Acceptable Use">
          <P>You agree not to:</P>
          <P>· spread misinformation about Islam, or use NŪR to harass, deceive or harm others</P>
          <P>· get around usage limits, rate limits, device checks or licence limits, including by forging or resetting device identifiers, or by sharing or reselling unlock codes</P>
          <P>· use bots, scripts or other automated tools to access NŪR or its AI, or to copy its content in bulk</P>
          <P>· attack, overload or probe the service for weaknesses. If you find a security problem, please report it through the Feedback page instead</P>
          <P last>· use the app in any way that violates applicable laws in your jurisdiction</P>
        </Section>

        <Section title="Security & Enforcement">
          <P last>We use technical measures such as rate limits, device verification, daily caps and signed payment checks to protect NŪR and its users. If we detect abuse, we may limit, block or suspend access, and may cancel a Pro licence that was used beyond its limits or came from a payment that was refunded, without notice where needed to protect the service.</P>
        </Section>

        <Section title="Limitation of Liability">
          <P last>NŪR is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for decisions made based on AI-generated responses, service interruptions or data loss, or any harm arising from the use or inability to use NŪR.</P>
        </Section>

        <Section title="Changes & Contact">
          <P>We may update these terms as NŪR evolves. Continued use after changes means you accept the revised terms.</P>
          <P last>For questions, use the Feedback page inside NŪR or reach us on Instagram <Bold>@nur.islamic.ai</Bold>.</P>
        </Section>
    </>
  );

  if (docked) {
    const ts = textSize || 1;
    return (
      <LegalLayout title="Terms of Use" updated="Last updated: 9 November 2026 · Beta Release" toc={TOC} textSize={textSize}>
        <div className="card" style={{ padding:"24px 28px", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", color:"var(--warn)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 10v4M12 16.6v.1"/></svg>
            <h2 className="h2" style={{ fontSize:`${24*ts}px`, color:gold }}>Important — Read This First</h2>
          </div>
          <div style={{ marginTop:"12px", fontSize:`${14*ts}px`, fontWeight:500, lineHeight:1.75, color:textDim }}>
            NŪR is an <Bold>educational tool</Bold>, not a source of religious authority. AI responses are generated for learning purposes and <Bold>must not replace the guidance of a qualified Islamic scholar (Alim)</Bold>. For personal religious rulings (fatwa), legal matters, or important Islamic decisions — always consult a qualified scholar.
          </div>
          <div style={{ marginTop:"10px", fontSize:`${13*ts}px`, fontStyle:"italic", color:"var(--faint)" }}>Allahu A'lam — Allah knows best.</div>
        </div>
        {sections}

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div lang="ar" dir="rtl" style={{ color:gold, fontSize:`${22*ts}px`, fontFamily:"var(--font-ar)", marginBottom:"5px" }}>وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ</div>
          <div style={{ color:"var(--faint)", fontSize:`${12.5*ts}px` }}>"My success is only through Allah" — Hud 11:88</div>
        </div>
      </LegalLayout>
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
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Terms of Use</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0, display:"flex", alignItems:"center" }}><Icon n="back" size={20}/></button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 52px" }}>

        <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginBottom:"20px" }}>Last updated: 9 November 2026 · Beta Release</div>

        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", color:gold, fontFamily:"var(--font-head)", fontSize:`${15 * textSize}px`, fontWeight:700, marginBottom:"8px" }}>
            <span style={{ color:"var(--warn)", display:"flex" }}><Icon n="warning" size={16}/></span>Important — Read This First
          </div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            NŪR is an <Bold>educational tool</Bold>, not a source of religious authority. AI responses are generated for learning purposes and <Bold>must not replace the guidance of a qualified Islamic scholar (Alim)</Bold>. For personal religious rulings (fatwa), legal matters, or important Islamic decisions — always consult a qualified scholar.
          </div>
          <div style={{ color:goldDim, fontSize:`${12 * textSize}px`, lineHeight:1.6, marginTop:"10px", fontStyle:"italic" }}>
            Allahu A'lam — Allah knows best.
          </div>
        </div>

        {sections}

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontFamily:"var(--font-ar)", marginBottom:"5px" }}>
            وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ
          </div>
          <div style={{ color:textDim, fontSize:`${11*textSize}px` }}>"My success is only through Allah" — Hud 11:88</div>
        </div>

      </div>
    </div>
  );
}
