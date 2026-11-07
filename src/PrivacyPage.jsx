import { Children } from "react";
import { useMedia, DOCK_QUERY } from "./useMedia.js";
import LegalLayout, { slugOf } from "./LegalLayout.jsx";
import { Icon } from "./Icons.jsx";

const TOC = ["What We Collect", "Stored Only in Your Browser", "What We Never Collect", "Third-Party Services", "Children's Privacy", "Your Rights & Data Deletion", "Changes to This Policy"];

export default function PrivacyPage({ onBack, onOpenSidebar, lightMode, textSize = 1 }) {
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

  const Row = ({ label, desc, last }) => docked ? (
    <div style={{ marginBottom:last?0:"16px", paddingBottom:last?0:"16px", borderBottom:last?"none":"1px solid var(--lineSoft)" }}>
      <div style={{ fontSize:`${14.5*textSize}px`, fontWeight:700, color:textClr, marginBottom:"5px" }}>{label}</div>
      <div style={{ fontSize:`${13.5*textSize}px`, fontWeight:500, lineHeight:1.75, color:textDim }}>{desc}</div>
    </div>
  ) : (
    <div style={{ marginBottom:last?0:"12px", paddingBottom:last?0:"12px", borderBottom:last?"none":`1px solid ${goldBdr}` }}>
      <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:700, marginBottom:"3px" }}>{label}</div>
      <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.75 }}>{desc}</div>
    </div>
  );

  const P = ({ children, last }) => {
    if (docked) {
      const arr = Children.toArray(children);
      const first = typeof arr[0] === "string" ? arr[0] : "";
      const isDot = first.startsWith("· ");
      const isX = first.startsWith("✗");
      const rest = isDot || isX ? [first.replace(/^(·|✗)[\s\u00a0]*/, ""), ...arr.slice(1)] : arr;
      const body = { fontSize:`${14*textSize}px`, fontWeight:500, lineHeight:1.75, color:textDim };
      if (isDot || isX) {
        return (
          <div style={{ display:"flex", alignItems:"flex-start", gap:"12px", marginBottom:last?0:"10px" }}>
            {isDot
              ? <span style={{ flex:"none", marginTop:"10px", width:"5px", height:"5px", borderRadius:"50%", background:"var(--gold)" }}/>
              : <span style={{ flex:"none", marginTop:"4px", color:"var(--warn)", display:"flex" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></span>}
            <span style={body}>{rest}</span>
          </div>
        );
      }
      return <p style={{ ...body, margin:last?"0":"0 0 12px 0" }}>{children}</p>;
    }
    const arrP = Children.toArray(children);
    const firstP = typeof arrP[0] === "string" ? arrP[0] : "";
    if (firstP.startsWith("✗")) {
      const restP = [firstP.replace(/^✗[\s\u00a0]*/, ""), ...arrP.slice(1)];
      return (
        <div style={{ display:"flex", alignItems:"flex-start", gap:"8px", margin:last?"0":"0 0 8px 0" }}>
          <span style={{ flex:"none", marginTop:`${3 * textSize}px`, color:"var(--warn)", display:"flex" }}><Icon n="close" size={14}/></span>
          <span style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>{restP}</span>
        </div>
      );
    }
    return <p style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8, margin:last?"0":"0 0 8px 0" }}>{children}</p>;
  };

  if (docked) {
    const ts = textSize || 1;
    return (
      <LegalLayout title="Privacy Policy" updated="Last updated: November 2026" toc={TOC} textSize={textSize}>
        <div className="card" style={{ padding:"24px 28px", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", color:gold }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.2 10"/></svg>
            <h2 className="h2" style={{ fontSize:`${24*ts}px` }}>Our Commitment</h2>
          </div>
          <div style={{ marginTop:"12px", fontSize:`${14*ts}px`, fontWeight:500, lineHeight:1.75, color:textDim }}>
            NŪR is built on trust. We collect the absolute minimum data needed to make the app work. No accounts. No behavioural tracking. No selling your data. Ever.
          </div>
        </div>
        <Section title="What We Collect">
          <Row label="Anonymous Device ID" desc="A randomly generated identifier created the first time you open NŪR. Stored only in your browser. Not linked to your name, email, or any personal information. Used only to track your daily AI message count."/>
          <Row label="Daily Message Count" desc="How many AI questions you have asked today. Stored with your anonymous device ID in our database. Automatically resets at midnight in your local timezone. To prevent abuse, your network address is used only briefly for rate limiting, in a scrambled (keyed-hash) form — it is not stored in readable form."/>
          <Row label="License Key (Pro users only)" desc="If you purchase Pro, your license key is saved in your browser to activate Pro features. We do not store your payment details." last/>
        </Section>

        <Section title="Stored Only in Your Browser">
          <P>The following data never leaves your device and is never sent to our servers:</P>
          <P>· Your name and year of birth (optional)</P>
          <P>· Your bookmarks (Quran ayahs and Hadith)</P>
          <P>· Your prayer alarm preferences</P>
                    {docked ? (<><P>· Your chat history</P><P last>Clearing your browser or app data removes all of it permanently.</P></>) : (<P last>· Your chat history · Clearing your browser or app data removes all of it permanently.</P>)}
        </Section>

        <Section title="What We Never Collect">
          <P>✗ &nbsp;Your name or email address</P>
          <P>✗ &nbsp;Your precise GPS location unless you turn on prayer-time notifications — in that case the city or coordinates you chose are kept with your notification subscription so alerts arrive at the right time (turn notifications off to remove it)</P>
          <P>✗ &nbsp;Your name, or anything that identifies you, in chat. Most questions are processed in real time and not kept. General, non-personal questions and the answers may be saved anonymously (tied only to the random device ID) to improve answer quality; questions that look personal or time-sensitive are not saved</P>
          <P>✗ &nbsp;Payment details (handled entirely by our payment providers)</P>
          <P last>✗ &nbsp;Cookies or trackers of our own. The free version shows an ad banner from Adsterra, which may use its own cookies or identifiers; Pro removes the ads</P>
        </Section>

        <Section title="Third-Party Services">
          <P>NŪR uses trusted third-party services to deliver its features. Only the minimum information necessary for each feature is shared with these providers.</P>
          <P>· <strong style={{ color:textClr }}>Quran, Hadith & Islamic content</strong> — sourced from reputable Islamic content providers. No personal data is included in these requests.</P>
          <P>· <strong style={{ color:textClr }}>Prayer times & location</strong> — your city name or coordinates are shared only to compute your local prayer schedule, then discarded.</P>
          <P>· <strong style={{ color:textClr }}>AI-powered responses</strong> — your questions are sent through our server to the Groq AI service to generate an answer. We do not use them to train models.</P>
          <P>· <strong style={{ color:textClr }}>Push notifications</strong> — if you opt in, your device's push subscription (endpoint and encryption keys, no personal data) is stored on our own Supabase backend and used only to send you app notifications like the daily Hadith.</P>
          <P last>· <strong style={{ color:textClr }}>Payments</strong> — handled by Razorpay (India) or LemonSqueezy (international). We receive only confirmation of payment. Your card and payment details are never seen or stored by us.</P>
        </Section>

        <Section title="Children's Privacy">
          <P last>NŪR is designed to be safe for all ages. When a year of birth is provided in Profile, the app tailors AI responses to be age-appropriate. We do not knowingly collect personal information from any user.</P>
        </Section>

        <Section title="Your Rights & Data Deletion">
          <P>Because NŪR requires no account, there is nothing to delete on our end. To remove all your data, clear your browser's site data. Your anonymous usage count in our database is tied to a random device ID with no personal connection to you.</P>
          <P last>For any privacy questions, use the Feedback page inside NŪR.</P>
        </Section>

        <Section title="Changes to This Policy">
          <P last>We may update this policy as NŪR grows. Changes will be reflected with a new "Last updated" date above. Continued use of NŪR after changes constitutes acceptance of the updated policy.</P>
        </Section>

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div lang="ar" dir="rtl" style={{ color:gold, fontSize:`${22*ts}px`, fontFamily:"var(--font-ar)", marginBottom:"5px" }}>وَاللَّهُ يَعْلَمُ وَأَنتُمْ لَا تَعْلَمُونَ</div>
          <div style={{ color:"var(--faint)", fontSize:`${12.5*ts}px` }}>"Allah knows and you do not know" — Al-Baqarah 2:216</div>
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
        <div className="nur-ph-title" style={{ flex:1, textAlign:"center", color:gold, fontSize:`${16*textSize}px`, fontWeight:700, letterSpacing:"1px" }}>Privacy Policy</div>
        <button className="nur-ph-back" onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"calc(20px * var(--ts, 1))", cursor:"pointer", lineHeight:1, padding:"4px 6px", flexShrink:0, display:"flex", alignItems:"center" }}><Icon n="back" size={20}/></button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 52px" }}>

        <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginBottom:"20px" }}>Last updated: November 2026</div>

        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"24px" }}>
          <div style={{ color:gold, fontFamily:"var(--font-head)", fontSize:`${15 * textSize}px`, fontWeight:700, marginBottom:"6px" }}>Our Commitment</div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            NŪR is built on trust. We collect the absolute minimum data needed to make the app work. No accounts. No behavioural tracking. No selling your data. Ever.
          </div>
        </div>

        <Section title="What We Collect">
          <Row label="Anonymous Device ID" desc="A randomly generated identifier created the first time you open NŪR. Stored only in your browser. Not linked to your name, email, or any personal information. Used only to track your daily AI message count."/>
          <Row label="Daily Message Count" desc="How many AI questions you have asked today. Stored with your anonymous device ID in our database. Automatically resets at midnight in your local timezone. To prevent abuse, your network address is used only briefly for rate limiting, in a scrambled (keyed-hash) form — it is not stored in readable form."/>
          <Row label="License Key (Pro users only)" desc="If you purchase Pro, your license key is saved in your browser to activate Pro features. We do not store your payment details." last/>
        </Section>

        <Section title="Stored Only in Your Browser">
          <P>The following data never leaves your device and is never sent to our servers:</P>
          <P>· Your name and year of birth (optional)</P>
          <P>· Your bookmarks (Quran ayahs and Hadith)</P>
          <P>· Your prayer alarm preferences</P>
                    {docked ? (<><P>· Your chat history</P><P last>Clearing your browser or app data removes all of it permanently.</P></>) : (<P last>· Your chat history · Clearing your browser or app data removes all of it permanently.</P>)}
        </Section>

        <Section title="What We Never Collect">
          <P>✗ &nbsp;Your name or email address</P>
          <P>✗ &nbsp;Your precise GPS location unless you turn on prayer-time notifications — in that case the city or coordinates you chose are kept with your notification subscription so alerts arrive at the right time (turn notifications off to remove it)</P>
          <P>✗ &nbsp;Your name, or anything that identifies you, in chat. Most questions are processed in real time and not kept. General, non-personal questions and the answers may be saved anonymously (tied only to the random device ID) to improve answer quality; questions that look personal or time-sensitive are not saved</P>
          <P>✗ &nbsp;Payment details (handled entirely by our payment providers)</P>
          <P last>✗ &nbsp;Cookies or trackers of our own. The free version shows an ad banner from Adsterra, which may use its own cookies or identifiers; Pro removes the ads</P>
        </Section>

        <Section title="Third-Party Services">
          <P>NŪR uses trusted third-party services to deliver its features. Only the minimum information necessary for each feature is shared with these providers.</P>
          <P>· <strong style={{ color:textClr }}>Quran, Hadith & Islamic content</strong> — sourced from reputable Islamic content providers. No personal data is included in these requests.</P>
          <P>· <strong style={{ color:textClr }}>Prayer times & location</strong> — your city name or coordinates are shared only to compute your local prayer schedule, then discarded.</P>
          <P>· <strong style={{ color:textClr }}>AI-powered responses</strong> — your questions are sent through our server to the Groq AI service to generate an answer. We do not use them to train models.</P>
          <P>· <strong style={{ color:textClr }}>Push notifications</strong> — if you opt in, your device's push subscription (endpoint and encryption keys, no personal data) is stored on our own Supabase backend and used only to send you app notifications like the daily Hadith.</P>
          <P last>· <strong style={{ color:textClr }}>Payments</strong> — handled by Razorpay (India) or LemonSqueezy (international). We receive only confirmation of payment. Your card and payment details are never seen or stored by us.</P>
        </Section>

        <Section title="Children's Privacy">
          <P last>NŪR is designed to be safe for all ages. When a year of birth is provided in Profile, the app tailors AI responses to be age-appropriate. We do not knowingly collect personal information from any user.</P>
        </Section>

        <Section title="Your Rights & Data Deletion">
          <P>Because NŪR requires no account, there is nothing to delete on our end. To remove all your data, clear your browser's site data. Your anonymous usage count in our database is tied to a random device ID with no personal connection to you.</P>
          <P last>For any privacy questions, use the Feedback page inside NŪR.</P>
        </Section>

        <Section title="Changes to This Policy">
          <P last>We may update this policy as NŪR grows. Changes will be reflected with a new "Last updated" date above. Continued use of NŪR after changes constitutes acceptance of the updated policy.</P>
        </Section>

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontFamily:"var(--font-ar)", marginBottom:"5px" }}>
            وَاللَّهُ يَعْلَمُ وَأَنتُمْ لَا تَعْلَمُونَ
          </div>
          <div style={{ color:textDim, fontSize:`${11*textSize}px` }}>"Allah knows and you do not know" — Al-Baqarah 2:216</div>
        </div>

      </div>
    </div>
  );
}
