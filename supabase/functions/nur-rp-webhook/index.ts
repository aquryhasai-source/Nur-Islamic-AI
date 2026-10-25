import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const OWNER_EMAIL = Deno.env.get("FEEDBACK_RECIPIENT_EMAIL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Only THIS payment link (the ₹299 Pro link) may mint a licence. Other links
// (e.g. the sadaqah/donation page) are ignored. Matching by id OR short URL
// so a transcription slip in one does not silently stop licences.
const PRO_LINK_IDS = (Deno.env.get("RZP_PRO_LINK_IDS") ?? "plink_Ss9d3OVxrLifU4")
  .split(",").map((s) => s.trim()).filter(Boolean);
const PRO_SHORT_URLS = (Deno.env.get("RZP_PRO_SHORT_URLS") ?? "https://rzp.io/rzp/RxurFTj")
  .split(",").map((s) => s.trim()).filter(Boolean);
const PRO_AMOUNT_PAISE = parseInt(Deno.env.get("RZP_PRO_AMOUNT_PAISE") ?? "29900", 10);

const J = { "Content-Type": "application/json" };
const reply = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: J });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!RAZORPAY_WEBHOOK_SECRET || !signature) return false; // fail closed
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(RAZORPAY_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return timingSafeEqual(hex, signature);
  } catch { return false; }
}

function generateCode(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `NUR-${uuid.slice(0, 4)}-${uuid.slice(4, 8)}-${uuid.slice(8, 12)}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    // Resend's shared sender only delivers to the account owner until a domain is verified.
    body: JSON.stringify({ from: "onboarding@resend.dev", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

async function alertOwner(subject: string, detail: string) {
  if (!OWNER_EMAIL || !RESEND_API_KEY) return;
  try { await sendEmail(OWNER_EMAIL, `[NUR] ${subject}`, `<p>${esc(detail)}</p>`); } catch (e) {
    console.error("owner alert failed:", String(e));
  }
}

function codeEmailHtml(code: string, name: string): string {
  const n = name ? `, <strong style="color:#c9a84c">${esc(name)}</strong>` : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0d1f14;border-radius:20px;overflow:hidden;">
    <div style="padding:32px 32px 20px;text-align:center;border-bottom:1px solid rgba(201,168,76,0.2);">
      <div style="font-size:32px;color:#c9a84c;letter-spacing:4px;font-weight:700;margin-bottom:4px;">NŪR</div>
      <div style="color:rgba(201,168,76,0.5);font-size:12px;letter-spacing:2px;text-transform:uppercase;">Islamic Knowledge Assistant</div>
    </div>
    <div style="padding:32px;">
      <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 8px;">As-salamu alaykum${n},</p>
      <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">Jazakallahu Khairan for supporting NŪR! Your lifetime access unlock code is ready.</p>
      <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
        <div style="color:rgba(201,168,76,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Your Unlock Code</div>
        <div style="color:#c9a84c;font-size:26px;font-weight:700;letter-spacing:4px;font-family:monospace;">${esc(code)}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:rgba(201,168,76,0.7);font-size:13px;font-weight:700;margin:0 0 12px;">How to activate:</p>
        <ol style="color:rgba(255,255,255,0.6);font-size:13px;line-height:2;margin:0;padding-left:18px;">
          <li>Open the NŪR app</li><li>Tap the ☰ menu (top left)</li>
          <li>Find <strong style="color:#c9a84c">Unlock Pro</strong> and paste your code</li>
          <li>Tap <strong style="color:#c9a84c">Activate Lifetime Access</strong></li>
        </ol>
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;line-height:1.7;text-align:center;margin:0;">Keep this email safe — you'll need this code if you reinstall the app. Your code works on up to 3 devices.</p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid rgba(201,168,76,0.1);text-align:center;">
      <div style="color:#c9a84c;font-size:16px;margin-bottom:4px;">وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ</div>
      <div style="color:rgba(201,168,76,0.3);font-size:11px;">"My success is only through Allah"</div>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const rawBody = await req.text();
    if (!(await verifySignature(rawBody, req.headers.get("X-Razorpay-Signature") ?? ""))) {
      console.error("Invalid Razorpay webhook signature");
      return reply({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(rawBody);
    const event: string = payload.event;
    const payment = payload.payload?.payment?.entity;
    const paymentLink = payload.payload?.payment_link?.entity;
    const refund = payload.payload?.refund?.entity;

    // ── Refunds: revoke the licence minted by that payment ────────────────
    if (event === "refund.processed" || event === "refund.created" || event === "payment.refunded") {
      const pid = refund?.payment_id ?? payment?.id;
      if (pid) {
        const { data } = await supabase.from("licenses")
          .update({ revoked_at: new Date().toISOString() })
          .eq("stripe_payment_id", `rp_${pid}`).is("revoked_at", null).select("id");
        if (data?.length) await alertOwner("Licence revoked after refund", `Payment ${pid} was refunded; its licence was revoked.`);
      }
      return reply({ received: true, event });
    }

    if (event !== "payment_link.paid") return reply({ received: true, skipped: event });

    const paymentId: string | undefined = payment?.id;
    const email: string | undefined = payment?.email;
    const name: string = paymentLink?.customer?.name || "";

    if (!paymentId || !email) {
      console.error("Missing paymentId or email in Razorpay payload");
      return reply({ error: "Missing payment data" }, 400);
    }

    // ── Only the Pro link / amount mints a licence ────────────────────────
    const linkOk = PRO_LINK_IDS.includes(paymentLink?.id ?? "") || PRO_SHORT_URLS.includes(paymentLink?.short_url ?? "");
    const amountOk = payment?.amount === PRO_AMOUNT_PAISE && payment?.currency === "INR" && payment?.status === "captured";
    if (!linkOk || !amountOk) {
      console.warn("payment_link.paid ignored (not the Pro link/amount):", paymentId);
      await alertOwner(
        "Payment received but no licence issued",
        `Payment ${paymentId} (${payment?.amount ?? "?"} ${payment?.currency ?? ""}) did not match the Pro link/amount, so no unlock code was created. If this was a Pro purchase, check the link id in Razorpay.`,
      );
      return reply({ received: true, ignored: "not-pro-link" });
    }

    // ── Idempotent create ─────────────────────────────────────────────────
    const key = `rp_${paymentId}`;
    let { data: row } = await supabase.from("licenses").select("unlock_code, revoked_at").eq("stripe_payment_id", key).maybeSingle();
    if (!row) {
      const { error: dbError } = await supabase.from("licenses").insert({
        email, unlock_code: generateCode(), stripe_payment_id: key, used_by: [],
      });
      if (dbError && dbError.code !== "23505") {
        console.error("Supabase insert error:", dbError.message);
        return reply({ error: "DB error" }, 500); // Razorpay will retry
      }
      ({ data: row } = await supabase.from("licenses").select("unlock_code, revoked_at").eq("stripe_payment_id", key).maybeSingle());
    }
    if (!row || row.revoked_at) return reply({ received: true });

    try {
      await sendEmail(email, "🌙 Your NŪR Pro Unlock Code", codeEmailHtml(row.unlock_code, name));
    } catch (e) {
      // Licence exists; the email did not go. Tell the owner so it can be sent manually. Don't 500 (would retry-spam).
      console.error("email failed:", String(e));
      await alertOwner("Unlock-code email failed", `Payment ${paymentId} for ${email}: licence created but the email could not be delivered (Resend onboarding sender only reaches the account owner until a domain is verified). Code: ${row.unlock_code}`);
    }
    return reply({ success: true });
  } catch (err) {
    console.error("Razorpay webhook error:", String(err));
    return reply({ error: "Internal error" }, 500);
  }
});
