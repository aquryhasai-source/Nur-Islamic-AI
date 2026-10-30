import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ALLOWED_ORIGINS = new Set([
  "https://nurislamicai.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

// Only real browser push services may be stored as an endpoint; anything else would let a caller
// make our server send requests to an arbitrary URL.
const PUSH_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.apple\.com$/,
];

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(o) ? o : "https://nurislamicai.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey, X-Client-Info, X-Device-Key",
    "Vary": "Origin",
  };
}

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacShort(v: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const m = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(v));
  return Array.from(new Uint8Array(m)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const b64url = /^[A-Za-z0-9_-]{16,200}$/;

function validEndpoint(e: unknown): e is string {
  if (typeof e !== "string" || e.length > 1000) return false;
  try {
    const u = new URL(e);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch { return false; }
}
function validTz(tz: unknown): string | null {
  if (typeof tz !== "string" || tz.length > 64) return null;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch { return null; }
}

Deno.serve(async (req) => {
  const C = cors(req);
  const J = { ...C, "Content-Type": "application/json" };
  const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: J });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: C });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return out({ error: "Forbidden" }, 403);

  try {
    const text = await req.text();
    if (text.length > 8192) return out({ error: "Request too large" }, 413);
    const b = JSON.parse(text);
    const { action, device_id } = b ?? {};

    if (typeof device_id !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(device_id)) return out({ error: "Invalid request" }, 400);
    const key = req.headers.get("x-device-key") ?? "";
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) return out({ error: "Device verification failed" }, 403);

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const { data: ok } = await supabase.rpc("hit_rate_limit", { p_key: `push:${await hmacShort(ip)}`, p_window_seconds: 600, p_max: 30 });
    if (ok === false) return out({ error: "Too many requests" }, 429);

    const { data: bind } = await supabase.rpc("bind_device_key", { p_device: device_id, p_key_hash: await sha256Hex(key) });
    if (bind === "mismatch") return out({ error: "Device verification failed" }, 403);

    if (action === "subscribe") {
      const { endpoint, p256dh, auth, timezone } = b;
      if (!validEndpoint(endpoint) || !b64url.test(p256dh ?? "") || !b64url.test(auth ?? "")) return out({ error: "Invalid subscription" }, 400);
      const { error } = await supabase.from("push_subscriptions").upsert({
        device_id, endpoint, p256dh, auth, timezone: validTz(timezone), last_seen_at: new Date().toISOString(),
      }, { onConflict: "device_id" });
      if (error) throw error;
      return out({ ok: true });
    }

    if (action === "unsubscribe") {
      const { error } = await supabase.from("push_subscriptions").delete().eq("device_id", device_id);
      if (error) throw error;
      return out({ ok: true });
    }

    if (action === "location") {
      const patch: Record<string, unknown> = {};
      if (typeof b.city === "string" && b.city.trim() && b.city.length <= 100) patch.city = b.city.trim();
      if (typeof b.lat === "number" && typeof b.lon === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lon) <= 180) {
        patch.lat = b.lat; patch.lon = b.lon;
      }
      if (Object.keys(patch).length === 0) return out({ error: "Invalid request" }, 400);
      const { error } = await supabase.from("push_subscriptions").update(patch).eq("device_id", device_id);
      if (error) throw error;
      return out({ ok: true });
    }

    return out({ error: "Invalid request" }, 400);
  } catch (e) {
    console.error("push-subscribe error:", String(e));
    return out({ error: "Something went wrong" }, 500);
  }
});
