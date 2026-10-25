import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RECIPIENT_EMAIL = Deno.env.get("FEEDBACK_RECIPIENT_EMAIL")!;
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = new Set([
  "https://nur-islamic-ai.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);
function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(o) ? o : "https://nur-islamic-ai.vercel.app",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Keyed hash so raw IPs are never stored.
async function hashIp(ip: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SUPABASE_SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(mac)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  const J = { ...C, "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: J });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Rate limit: 5 submissions / hour / IP
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const { data: allowed } = await supabase.rpc("hit_rate_limit", {
      p_key: `fb:${await hashIp(ip)}`, p_window_seconds: 3600, p_max: 5,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Too many submissions. Please try again later." }), { status: 429, headers: J });
    }

    const body = await req.json().catch(() => ({}));
    const { category, message, email, skip_email, device_id, browser } = body ?? {};

    if (typeof category !== "string" || typeof message !== "string" || !category.trim() || !message.trim()) {
      return new Response(JSON.stringify({ error: "Category and message are required." }), { status: 400, headers: J });
    }
    const skippedEmail = skip_email === true;
    const safeEmail = typeof email === "string" ? email.trim().slice(0, 200) : "";
    if (!skippedEmail && (!safeEmail || !EMAIL_RE.test(safeEmail))) {
      return new Response(JSON.stringify({ error: "A valid email address is required, or choose to skip it." }), { status: 400, headers: J });
    }
    const finalEmail = skippedEmail ? "" : safeEmail;

    const safeMessage = message.slice(0, 2000);
    const safeCategory = category.slice(0, 100);
    const safeBrowser = typeof browser === "string" ? browser.slice(0, 200) : "";
    const safeDevice = typeof device_id === "string" ? device_id.slice(0, 100) : "";

    // Store first (survives even if Resend fails)
    await supabase.from("feedback").insert({
      category: safeCategory, message: safeMessage, email: finalEmail || null,
      device_id: safeDevice || null, browser: safeBrowser || null,
    });

    // Everything user-supplied is HTML-escaped. Subject has newlines stripped.
    const subjCat = safeCategory.replace(/[\r\n]+/g, " ");
    const payload: Record<string, unknown> = {
      from: `NUR Feedback <${FROM_EMAIL}>`,
      to: [RECIPIENT_EMAIL],
      subject: `[NUR] ${subjCat}${finalEmail ? "" : " (no reply email)"}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#c9a84c;margin-bottom:4px;">NUR - New Feedback</h2>
          <p style="color:#666;font-size:13px;margin-top:0;">${new Date().toUTCString()}</p>
          <hr style="border:none;border-top:1px solid #eee;">
          <p><strong>Category:</strong> ${esc(safeCategory)}</p>
          <p><strong>From:</strong> ${finalEmail ? esc(finalEmail) : "(no email provided — user opted out, cannot reply)"}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left:3px solid #c9a84c;margin:0;padding:10px 16px;background:#fffdf5;">
            ${esc(safeMessage).replace(/\n/g, "<br>")}
          </blockquote>
          <hr style="border:none;border-top:1px solid #eee;margin-top:20px;">
          <p style="color:#aaa;font-size:11px;">Device: ${esc(safeDevice || "unknown")}<br>Browser: ${esc(safeBrowser || "unknown")}</p>
        </div>`,
    };
    if (finalEmail) payload.reply_to = [finalEmail];

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!emailRes.ok) console.error("Resend error status:", emailRes.status); // already saved; don't fail the user

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: J });
  } catch (err) {
    console.error("send-feedback error:", String(err));
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), { status: 500, headers: J });
  }
});
