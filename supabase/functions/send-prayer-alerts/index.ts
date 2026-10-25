import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:aquryhasai@gmail.com";
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Only our own pg_cron jobs may call this function (secret checked in the database).
async function authorised(req: Request): Promise<boolean> {
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length < 32) return false;
  const { data, error } = await supabase.rpc("check_cron_secret", { p_secret: got });
  return !error && data === true;
}

// Matches PrayerTimesPage.jsx's PRAYER_LIST (alarm-eligible prayers only — no Sunrise)
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function localDateAndTime(tz: string | null) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "UTC",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const timingsCache = new Map<string, Record<string, string> | null>();

async function getTimingsForCity(city: string) {
  if (timingsCache.has(city)) return timingsCache.get(city)!;
  const commaIdx = city.indexOf(",");
  const cityName = commaIdx > 0 ? city.slice(0, commaIdx).trim() : city;
  const country = commaIdx > 0 ? city.slice(commaIdx + 1).trim() : "";
  const params = new URLSearchParams({ city: cityName, method: "1", school: "1" });
  if (country) params.set("country", country);
  try {
    const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?${params}`);
    const data = await res.json();
    const timings = data.code === 200 ? data.data.timings : null;
    timingsCache.set(city, timings);
    return timings;
  } catch {
    timingsCache.set(city, null);
    return null;
  }
}

async function getTimingsForCoords(lat: number, lon: number) {
  const key = `${lat},${lon}`;
  if (timingsCache.has(key)) return timingsCache.get(key)!;
  const ts = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(
      `https://api.aladhan.com/v1/timings/${ts}?latitude=${lat}&longitude=${lon}&method=1&school=1`,
    );
    const data = await res.json();
    const timings = data.code === 200 ? data.data.timings : null;
    timingsCache.set(key, timings);
    return timings;
  } catch {
    timingsCache.set(key, null);
    return null;
  }
}

Deno.serve(async (req) => {
  if (!(await authorised(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Light housekeeping so the dedup table doesn't grow forever
  await supabase
    .from("prayer_notifications_sent")
    .delete()
    .lt("prayer_date", new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10));

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .or("city.not.is.null,lat.not.is.null");

  if (error) {
    console.error("send-prayer-alerts query error:", error.message);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let checked = 0, sent = 0, failed = 0;

  for (const sub of subs ?? []) {
    checked++;
    const { date, time } = localDateAndTime(sub.timezone);
    const nowMinutes = toMinutes(time);

    const timings = sub.city
      ? await getTimingsForCity(sub.city)
      : sub.lat != null && sub.lon != null
      ? await getTimingsForCoords(sub.lat, sub.lon)
      : null;
    if (!timings) continue;

    for (const prayer of PRAYERS) {
      const prayerTime = (timings[prayer] || "").slice(0, 5);
      if (!prayerTime) continue;
      const diff = nowMinutes - toMinutes(prayerTime);
      if (diff < 0 || diff >= 5) continue; // only within 5 min after the prayer time

      // Atomic claim: if this insert fails (duplicate key), it's already been sent
      const { error: claimErr } = await supabase
        .from("prayer_notifications_sent")
        .insert({ device_id: sub.device_id, prayer_date: date, prayer_name: prayer });
      if (claimErr) continue;

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `🕌 ${prayer} — Time to Pray`,
            body: `It's ${prayerTime} — time for ${prayer} prayer.`,
            url: "/#prayers",
          }),
        );
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ checked, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
