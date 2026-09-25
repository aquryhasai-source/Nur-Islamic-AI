// NUR Islamic AI — push notification subscribe/unsubscribe
// Matches the app's existing pattern (see analytics.js): plain fetch() to
// the Supabase REST API with the anon key, no Supabase SDK needed.
//
// Uses getAnonymousId() from utils.js so the push subscription is tied to
// the SAME device_id already used for events/feedback/error_log.

import { getAnonymousId } from "../utils";

const SUPABASE_URL  = "https://dvcuisgpptxhjgiasqlp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2Y3Vpc2dwcHR4aGpnaWFzcWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzEzMTMsImV4cCI6MjA5MzIwNzMxM30.18-UGma8qHkfxcllgvnWY4QwXojL_ewvc983o_mciQg";

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

  const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=device_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      device_id: getAnonymousId(),
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      timezone,
      last_seen_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not save subscription (${res.status}): ${text}`);
  }

  return subscription;
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });
}

export function getPushPermissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}
