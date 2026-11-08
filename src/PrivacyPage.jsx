import { Children } from "react";
import { useMedia, DOCK_QUERY } from "./useMedia.js";
import LegalLayout, { slugOf } from "./LegalLayout.jsx";
import { Icon } from "./Icons.jsx";

const TOC = ["What We Collect", "Stored Only in Your Browser", "AI Questions & Answers", "What We Never Collect", "Third-Party Services", "How We Protect Data", "How Long We Keep Data", "Children's Privacy", "Your Rights & Data Deletion", "Changes to This Policy"];

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

  const sections = (
    <>
        <Section title="What We Collect">
          <Row label="Anonymous Device ID and Device Key" desc="Two random codes created the first time you open NŪR and stored only in your browser. The Device ID is used to count your daily AI messages. The Device Key is a private secret that proves requests really come from your own browser; our server keeps only a one-way hash of it, never the key itself. Neither is linked to your name, email, or any personal information."/>
          <Row label="Daily Message Count" desc="How many AI questions you have asked today, stored with your Device ID in our database. The free daily count resets at midnight in your local timezone."/>
          <Row label="Network Address (Abuse Protection)" desc="To stop abuse we apply short rate limits per network address. Your address is turned into a scrambled (keyed-hash) code before anything is stored, and those records are deleted automatically after 2 days. As with any website, our servers and hosting providers can see your IP address while handling a request."/>
          <Row label="Anonymous Usage Events" desc="Basic events tied to your Device ID: which pages and tabs you open, whether you installed the app or turned on notifications, your choice on the first-visit notice, whether Pro is active, your light or dark theme, and for AI questions the model that answered and a general topic label such as &quot;patience&quot; (never the text of your question). Deleted automatically after 90 days."/>
          <Row label="Error Reports" desc="If the app hits an error, we receive a short error message (up to 500 characters) with your Device ID and the date, so we can fix bugs. We keep these only for debugging and delete them on request."/>
          <Row label="Pro Purchase and Licence" desc="If you buy Pro, Razorpay or LemonSqueezy sends us your email address and a payment reference. We store them with your unlock code so we can email you the code, restore Pro if you reinstall, and cancel the licence if the payment is refunded. We also record which devices (up to 3) have activated the code. Your unlock code is saved in your browser to switch Pro on. We never see or store your card details."/>
          <Row label="Feedback" desc="If you send feedback we store your message, its category, your browser type and your Device ID. Your email address is stored only if you choose to give one so we can reply; you can skip it. Feedback is delivered to us by email through Resend." last/>
        </Section>

        <Section title="Stored Only in Your Browser">
          <P>The following is saved on your device and is not stored on our servers:</P>
          <P>· Your name and year of birth (optional)</P>
          <P>· Your bookmarks (Quran ayahs and Hadith)</P>
          <P>· Your prayer alarm preferences</P>
          <P>· Your chat history</P>
          <P>· Your last city and coordinates, saved so Prayer Times and Qibla load faster</P>
          <P>· Your display settings, such as theme and text size</P>
          <P last>Clearing your browser or app data removes all of it permanently, and gives you a new Device ID. Keep your Pro unlock code safe so you can restore Pro afterwards.</P>
        </Section>

        <Section title="AI Questions & Answers">
          <Row label="How Your Question Is Answered" desc="Your question, plus up to the previous 12 messages of the conversation (each cut to 4,000 characters), is sent to our server. The server searches our own Quran database and a public Hadith collection for passages related to your question, then sends your conversation and those passages to the Groq AI service, which writes the answer. Hadith lookups carry only a collection name and number, never your question. References in the answer that do not match a passage we found are removed."/>
          <Row label="Ready-Made Answers" desc="Common questions about NŪR itself, such as who made it, what Pro costs, how to redeem a code or how your data is handled, are answered from a fixed set of pre-written answers on our server. Those questions are not sent to Groq."/>
          <Row label="Age-Appropriate Answers" desc="Your year of birth never leaves your device. If it shows you are under 18, we add a short note such as &quot;the person asking is a teenager&quot; in front of your question so the answer suits your age."/>
          <Row label="What We Save" desc="Simple, general questions and their answers may be saved with your Device ID, the AI model used, the passages cited and version numbers. We use them only to check and improve answer quality. They are not used to answer other people, are not shown publicly, and cannot be read from the app or your browser. They are deleted automatically after 90 days. A question is not saved when our automatic filter judges it to be complex, personal or time-sensitive, but it is still sent to Groq so it can be answered."/>
          <Row label="Please Keep It Impersonal" desc="The filter looks for keywords. It cannot recognise names, phone numbers, email addresses, locations, or health and financial details, so please do not type personal information into the chat. We do not use your questions to train AI models. If you shared something by mistake, contact us and we will delete it." last/>
        </Section>

        <Section title="What We Never Collect">
          <P>✗ &nbsp;Your name, phone number or home address</P>
          <P>✗ &nbsp;Your email address, unless you give it in Feedback or it comes with your Pro purchase</P>
          <P>✗ &nbsp;Your precise GPS location unless you turn on prayer-time notifications — in that case the city or coordinates you chose are kept with your notification subscription so alerts arrive at the right time (turn notifications off to remove it)</P>
          <P>✗ &nbsp;Card or other payment details (handled entirely by our payment providers)</P>
          <P>✗ &nbsp;Your chat history. It stays on your device; only the filtered questions described above are saved</P>
          <P>✗ &nbsp;Cookies or trackers of our own. The free version shows an ad banner from Adsterra, which may use its own cookies or identifiers; Pro removes the ads</P>
          <P last>✗ &nbsp;Anything we sell or share for advertising</P>
        </Section>

        <Section title="Third-Party Services">
          <P>NŪR uses trusted third-party services to deliver its features. Only the minimum information necessary for each feature is shared with them, and each handles it under its own terms.</P>
          <P>· <strong style={{ color:textClr }}>Groq (AI answers)</strong> — receives your conversation and the Quran and Hadith passages we retrieved, to write the answer.</P>
          <P>· <strong style={{ color:textClr }}>Supabase (database and server functions)</strong> — stores the records described above. Our database is hosted in Mumbai, India.</P>
          <P>· <strong style={{ color:textClr }}>Vercel (hosting)</strong> — serves the app and sees standard request details such as your IP address and browser type.</P>
          <P>· <strong style={{ color:textClr }}>Prayer times, calendar &amp; location</strong> — Aladhan (prayer times and Hijri dates), Open-Meteo (city search) and OpenStreetMap Nominatim (turning coordinates into a place name). Your city or coordinates go to them directly from your browser when you use these features. We do not store them unless you turn on notifications.</P>
          <P>· <strong style={{ color:textClr }}>Quran &amp; Hadith content</strong> — verse text comes from alquran.cloud and Hadith text from a public dataset delivered through jsDelivr. No personal data is included, though like any website they can see your IP address.</P>
          <P>· <strong style={{ color:textClr }}>Push notifications</strong> — if you opt in, your device's push subscription (endpoint and encryption keys), timezone and chosen city are stored on our Supabase backend and used only to send you app notifications such as prayer alerts and the daily Hadith.</P>
          <P>· <strong style={{ color:textClr }}>Payments</strong> — handled by Razorpay (India) or LemonSqueezy (international). We receive confirmation of payment, your email address and a payment reference. Your card and payment details are never seen or stored by us.</P>
          <P last>· <strong style={{ color:textClr }}>Email (Resend)</strong> — delivers your Pro unlock code to you and feedback messages to us.</P>
        </Section>

        <Section title="How We Protect Data">
          <P>· Everything travels over HTTPS.</P>
          <P>· Our database cannot be read from your browser. The app can only write anonymous usage events and error reports. Everything else goes through our server, which checks each request, applies rate limits and daily caps, and verifies your device.</P>
          <P>· Payment notifications are accepted only when they carry a valid signature from Razorpay or LemonSqueezy, and a refund cancels the licence.</P>
          <P>· Secret keys, including our AI key, are kept on the server and never in the app.</P>
          <P>· The saved AI log is write-only: nothing in the app or on our server reads it back to answer questions.</P>
          <P last>No online service is perfectly secure, which is one more reason to keep personal details out of the chat.</P>
        </Section>

        <Section title="How Long We Keep Data">
          <Row label="Rate-limit records" desc="Deleted automatically after 2 days."/>
          <Row label="Usage events" desc="Deleted automatically after 90 days."/>
          <Row label="Saved AI questions and answers" desc="Deleted automatically after 90 days."/>
          <Row label="Daily message counts and device records" desc="Kept so your daily limit and device checks keep working. Removed on request."/>
          <Row label="Error reports and feedback" desc="Kept only as long as they are useful for fixing bugs and replying to you. Removed on request."/>
          <Row label="Notification subscription" desc="Kept until you turn notifications off or your device stops accepting alerts."/>
          <Row label="Pro licence records" desc="Kept for as long as your licence is active, so Pro can be restored if you reinstall." last/>
        </Section>

        <Section title="Children's Privacy">
          <P last>NŪR is designed to be safe for all ages. If you enter a year of birth in Profile, it stays on your device and is used only to make AI answers age-appropriate. We do not knowingly collect personal information from children. If a child has shared an email address with us, a parent or guardian can ask us to delete it using the Feedback page.</P>
        </Section>

        <Section title="Your Rights & Data Deletion">
          <P>NŪR has no accounts, so there is nothing to sign in to or close. Clearing your browser's site data removes everything stored on your device and gives you a new anonymous Device ID.</P>
          <P>Records on our side that contain your email address, such as a Pro purchase or feedback where you gave your email, can be found and deleted on request. Anonymous records are tied only to a random Device ID, so we cannot tell which are yours; usage events and saved AI questions expire automatically after 90 days, and rate-limit records after 2 days.</P>
          <P last>To ask for deletion or ask any privacy question, use the Feedback page inside NŪR and include the email address involved. If you shared personal information in a chat by mistake, tell us roughly what you wrote and when.</P>
        </Section>

        <Section title="Changes to This Policy">
          <P last>We may update this policy as NŪR grows. Changes will be reflected with a new "Last updated" date above. Continued use of NŪR after changes constitutes acceptance of the updated policy.</P>
        </Section>
    </>
  );

  if (docked) {
    const ts = textSize || 1;
    return (
      <LegalLayout title="Privacy Policy" updated="Last updated: 9 November 2026" toc={TOC} textSize={textSize}>
        <div className="card" style={{ padding:"24px 28px", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", color:gold }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.2 10"/></svg>
            <h2 className="h2" style={{ fontSize:`${24*ts}px` }}>Our Commitment</h2>
          </div>
          <div style={{ marginTop:"12px", fontSize:`${14*ts}px`, fontWeight:500, lineHeight:1.75, color:textDim }}>
            NŪR is built on trust. We collect the minimum data needed to make the app work and to keep it safe. No accounts. No selling your data. Ever.
          </div>
        </div>
        {sections}

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

        <div style={{ color:textDim, fontSize:`${11*textSize}px`, marginBottom:"20px" }}>Last updated: 9 November 2026</div>

        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"24px" }}>
          <div style={{ color:gold, fontFamily:"var(--font-head)", fontSize:`${15 * textSize}px`, fontWeight:700, marginBottom:"6px" }}>Our Commitment</div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            NŪR is built on trust. We collect the minimum data needed to make the app work and to keep it safe. No accounts. No selling your data. Ever.
          </div>
        </div>

        {sections}

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
