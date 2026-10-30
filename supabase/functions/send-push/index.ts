import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:aquryhasai@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SITE_ORIGIN = "https://nurislamicai.app";
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// Only our own pg_cron jobs may call this function. The shared secret lives in
// Supabase Vault and is checked inside the database (public.check_cron_secret).
async function authorised(req: Request): Promise<boolean> {
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length < 32) return false;
  const { data, error } = await supabase.rpc("check_cron_secret", { p_secret: got });
  return !error && data === true;
}

// Click-through URL must stay inside the app (relative path or our own origin).
function safeUrl(u: unknown): string {
  if (typeof u !== "string") return "/";
  if (u.startsWith("/") && !u.startsWith("//")) return u.slice(0, 300);
  if (u.startsWith(SITE_ORIGIN + "/") || u === SITE_ORIGIN) return u.slice(0, 300);
  return "/";
}

// POST body: { device_id?: string, title?: string, body?: string, url?: string, icon?: string }
// Omit device_id to broadcast to every stored subscription.
Deno.serve(async (req) => {
  if (!(await authorised(req))) return json({ error: "Unauthorized" }, 401);

  try {
    const { device_id, title, body, url, icon } = await req.json().catch(() => ({}));

    let query = supabase.from("push_subscriptions").select("*");
    if (device_id) query = query.eq("device_id", device_id);

    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({
      title: typeof title === "string" ? title.slice(0, 120) : "NŪR Islamic AI",
      body: typeof body === "string" ? body.slice(0, 600) : "",
      url: safeUrl(url),
      icon: "/icon-192.png",
    });

    const results = await Promise.allSettled(
      (subs ?? []).map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          .catch(async (err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
            throw err;
          }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return json({ sent, failed, total: results.length });
  } catch (err) {
    console.error("send-push error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
