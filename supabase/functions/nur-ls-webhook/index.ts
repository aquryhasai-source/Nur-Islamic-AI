import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LS_WEBHOOK_SECRET = Deno.env.get("LS_WEBHOOK_SECRET") ?? "";
const LS_API_KEY = Deno.env.get("LS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const J = { "Content-Type": "application/json" };
const reply = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: J });

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!LS_WEBHOOK_SECRET || !signature) return false; // fail closed
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(LS_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return timingSafeEqual(hex, signature);
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const rawBody = await req.text();
    if (!(await verifySignature(rawBody, req.headers.get("X-Signature") ?? ""))) {
      console.error("Invalid LS webhook signature");
      return reply({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload.meta?.event_name;
    const orderId = payload.data?.id;

    // Refund → revoke the licence for that order
    if (eventName === "order_refunded") {
      if (orderId) {
        await supabase.from("licenses").update({ revoked_at: new Date().toISOString() })
          .eq("stripe_payment_id", `ls_${orderId}`).is("revoked_at", null);
      }
      return reply({ received: true, event: eventName });
    }

    if (eventName !== "order_created") return reply({ received: true, skipped: eventName });

    const email = payload.data?.attributes?.user_email;
    const status = payload.data?.attributes?.status;
    if (!orderId || !email) return reply({ error: "Missing order data" }, 400);
    if (status && status !== "paid") return reply({ received: true, ignored: `status:${status}` });

    const lsRes = await fetch(
      `https://api.lemonsqueezy.com/v1/license-keys?filter[order_id]=${encodeURIComponent(String(orderId))}`,
      { headers: { Authorization: `Bearer ${LS_API_KEY}`, Accept: "application/vnd.api+json" } },
    );
    const lsData = await lsRes.json().catch(() => ({}));
    const licenseKey = lsData.data?.[0]?.attributes?.key;
    if (!licenseKey) {
      console.error("No license key found for order", orderId);
      return reply({ error: "No license key found" }, 500); // LS retries
    }

    // Insert only if new: never overwrite used_by / revoked_at on a retried webhook.
    const { error: dbError } = await supabase.from("licenses").insert({
      email, unlock_code: licenseKey, stripe_payment_id: `ls_${orderId}`, used_by: [],
    });
    if (dbError && dbError.code !== "23505") {
      console.error("Supabase insert error:", dbError.message);
      return reply({ error: "DB error" }, 500);
    }
    return reply({ success: true });
  } catch (err) {
    console.error("LS webhook error:", String(err));
    return reply({ error: "Internal error" }, 500);
  }
});
