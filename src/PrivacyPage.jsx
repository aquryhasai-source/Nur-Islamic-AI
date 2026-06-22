export default function PrivacyPage({ onBack, lightMode, textSize = 1 }) {
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

  const Row = ({ label, desc, last }) => (
    <div style={{ marginBottom: last ? 0 : "12px", paddingBottom: last ? 0 : "12px", borderBottom: last ? "none" : `1px solid ${goldBdr}` }}>
      <div style={{ color:textClr, fontSize:`${13 * textSize}px`, fontWeight:700, marginBottom:"3px" }}>{label}</div>
      <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.75 }}>{desc}</div>
    </div>
  );

  const P = ({ children }) => (
    <p style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8, margin:"0 0 8px 0" }}>{children}</p>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:`1px solid ${goldBdr}`, background:headerBg, backdropFilter:"blur(14px)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:gold, fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"4px" }}>←</button>
        <div style={{ color:gold, fontSize:"16px", fontWeight:700, letterSpacing:"1px" }}>Privacy Policy</div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"24px 20px 52px" }}>

        <div style={{ color:textDim, fontSize:"11px", marginBottom:"20px" }}>Last updated: June 2026</div>

        {/* Commitment card */}
        <div style={{ background:goldFaint, border:`1px solid ${goldBdr}`, borderRadius:"14px", padding:"16px 18px", marginBottom:"24px" }}>
          <div style={{ color:gold, fontSize:`${13 * textSize}px`, fontWeight:800, marginBottom:"6px" }}>Our Commitment</div>
          <div style={{ color:textDim, fontSize:`${12 * textSize}px`, lineHeight:1.8 }}>
            NŪR is built on trust. We collect the absolute minimum data needed to make the app work. No accounts. No behavioural tracking. No selling your data. Ever.
          </div>
        </div>

        <Section title="What We Collect">
          <Row
            label="Anonymous Device ID"
            desc="A randomly generated identifier (UUID) created the first time you open NŪR. Stored only in your browser. Not linked to your name, email, or any personal information. Used only to track your daily AI message count."
          />
          <Row
            label="Daily Message Count"
            desc="How many AI questions you have asked today. Stored with your anonymous device ID in our database. Automatically resets at midnight in your local timezone."
          />
          <Row
            label="License Key (Pro users only)"
            desc="If you purchase Pro, your license key is saved in your browser to activate Pro features. We do not store your payment details — those are handled entirely by LemonSqueezy or Razorpay."
            last
          />
        </Section>

        <Section title="Stored Only in Your Browser">
          <P>The following data never leaves your device and is never sent to our servers:</P>
          <P>· Your name and year of birth (optional, from Profile)</P>
          <P>· Your bookmarks (Quran ayahs and Hadith)</P>
          <P>· Your city name for prayer times</P>
          <P>· Your prayer alarm settings</P>
          <P>· Your chat history</P>
          <P style={{ margin:0 }}>Clearing your browser or app data removes all of it permanently.</P>
        </Section>

        <Section title="What We Never Collect">
          <P>✗ &nbsp;Your name or email address</P>
          <P>✗ &nbsp;Your precise GPS location (used only temporarily to fetch prayer times — never stored)</P>
          <P>✗ &nbsp;Your chat messages (processed in real-time, not logged on our servers)</P>
          <P>✗ &nbsp;Payment details (handled entirely by LemonSqueezy / Razorpay)</P>
          <P style={{ margin:0 }}>✗ &nbsp;Cookies, advertising identifiers, or cross-site trackers</P>
        </Section>

        <Section title="Third-Party Services">
          <Row label="AlQuran.cloud" desc="Provides Quran text and translations. Requests include the surah or verse you are viewing."/>
          <Row label="AlAdhan.com" desc="Provides prayer times. Your coordinates or city name are sent to compute your local prayer schedule."/>
          <Row label="jsDelivr CDN" desc="Serves Hadith JSON files. Standard CDN access — no personal data included."/>
          <Row label="Open Meteo" desc="Used for geocoding your city name when finding the Qibla direction."/>
          <Row label="Groq AI (via our server)" desc="Processes your AI questions. Your message is forwarded to Groq through our Supabase Edge Function. Messages are not stored or used for model training."/>
          <Row label="OneSignal" desc="Powers push notifications if you opt in. OneSignal manages your push token under their own Privacy Policy at onesignal.com/privacy."/>
          <Row label="LemonSqueezy / Razorpay" desc="Handles Pro payments. We only receive confirmation that a payment was completed. All card and payment data is managed exclusively by these providers." last/>
        </Section>

        <Section title="Children's Privacy">
          <P>NŪR is designed to be safe for all ages. When a year of birth is provided in Profile, the app tailors AI responses to be age-appropriate. We do not knowingly collect personal information from any user.</P>
        </Section>

        <Section title="Your Rights & Data Deletion">
          <P>Because NŪR requires no account, there is nothing to "delete" on our end. To remove all your data:</P>
          <P>1. Clear your browser's site data (localStorage) to remove all local settings, bookmarks, and history.</P>
          <P>2. Your anonymous usage count in our database is tied to a random device ID with no personal connection to you.</P>
          <P style={{ margin:0 }}>For any privacy questions, use the Feedback page inside NŪR.</P>
        </Section>

        <Section title="Changes to This Policy">
          <P style={{ margin:0 }}>We may update this policy as NŪR grows. Changes will be reflected with a new "Last updated" date above. Continued use of NŪR after changes constitutes acceptance of the updated policy.</P>
        </Section>

        <div style={{ textAlign:"center", marginTop:"32px" }}>
          <div style={{ color:gold, fontSize:`${16 * textSize}px`, fontFamily:"Georgia,serif", marginBottom:"5px" }}>
            وَاللَّهُ يَعْلَمُ وَأَنتُمْ لَا تَعْلَمُونَ
          </div>
          <div style={{ color:textDim, fontSize:"11px" }}>"Allah knows and you do not know" — Al-Baqarah 2:216</div>
        </div>

      </div>
    </div>
  );
}
