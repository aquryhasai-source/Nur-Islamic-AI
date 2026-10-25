// NUR Islamic AI — push notification subscribe/unsubscribe
// All writes go through the `push-subscribe` Edge Function, which checks the per-device secret
// (X-Device-Key) and validates the subscription. The browser no longer has direct table access.

import { getAnonymousId, deviceHeaders } from "../utils";

const PUSH_FN_URL = "https://dvcuisgpptxhjgiasqlp.supabase.co/functions/v1/push-subscribe";

async function callPushFn(body) {
  return fetch(PUSH_FN_URL, {
    method: "POST",
    headers: deviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ device_id: getAnonymousId(), ...body }),
  });
}

// Public VAPID key — safe to ship in client code (the private key lives only
// as a secret on the send-push Edge Function).
const VAPID_PUBLIC_KEY =
  "BHWyz3zqk3FJa7s6oAahqb2KBzpsJeoVnNokqnAsy1AY7o8tjAEVXxLn33NMI8D-_K5XerWC1PXmWjRXTng--qw";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Kolkata"

  const res = await callPushFn({
    action: "subscribe",
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth: subJson.keys.auth,
    timezone,
  });

  if (!res.ok) {
    throw new Error(`Could not save subscription (${res.status})`);
  }

  return subscription;
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await subscription.unsubscribe();

  try { await callPushFn({ action: "unsubscribe" }); } catch { /* best-effort */ }
}

export function getPushPermissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

// Silently attaches a location to this device's existing push subscription
// (used for prayer-time alerts). Does nothing if the device hasn't enabled
// notifications yet — there's no row to attach it to, by design.
export async function syncPrayerLocation({ city, lat, lon }) {
  const payload = {};
  if (city) payload.city = city;
  if (lat != null && lon != null) { payload.lat = lat; payload.lon = lon; }
  if (Object.keys(payload).length === 0) return;

  try {
    await callPushFn({ action: "location", ...payload });
  } catch {
    // best-effort — never break the Prayer Times page over this
  }
}
