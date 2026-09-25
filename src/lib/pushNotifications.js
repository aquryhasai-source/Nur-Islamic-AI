// NUR Islamic AI — client-side push subscription helper (device_id-based)
// Usage:
//   import { subscribeToPush, unsubscribeFromPush } from './lib/pushNotifications';
//   await subscribeToPush(supabase, deviceId);
//
// `supabase` is your existing Supabase client instance.
// `deviceId` is whatever device identifier the app already generates/stores
// for the events/feedback/device_usage tables — reuse that same value here
// rather than generating a second one. If you don't have that logic handy,
// getOrCreateDeviceId() below is a plain localStorage fallback.

const VAPID_PUBLIC_KEY =
  'BHWyz3zqk3FJa7s6oAahqb2KBzpsJeoVnNokqnAsy1AY7o8tjAEVXxLn33NMI8D-_K5XerWC1PXmWjRXTng--qw';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Fallback only — prefer whatever device_id source the app already uses
// for events/feedback so all your tables agree on the same identity.
export function getOrCreateDeviceId() {
  const key = 'nur_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export async function subscribeToPush(supabase, deviceId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
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

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      device_id: deviceId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      timezone,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) throw error;

  return subscription;
}

export async function unsubscribeFromPush(supabase) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
