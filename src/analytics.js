// analytics.js
// Lightweight anonymous event tracking for NŪR — Beta
// All data is anonymous. Device ID only. No personal information ever stored.

const SUPABASE_URL  = "https://dvcuisgpptxhjgiasqlp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2Y3Vpc2dwcHR4aGpnaWFzcWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzEzMTMsImV4cCI6MjA5MzIwNzMxM30.18-UGma8qHkfxcllgvnWY4QwXojL_ewvc983o_mciQg";

function getDeviceId() {
  return localStorage.getItem("nur_device_id") || "unknown";
}

function getLocalDate() {
  return new Date().toLocaleDateString("en-CA");
}

function _post(table, payload) {
  fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function trackEvent(event, properties = {}) {
  _post("events", {
    device_id:  getDeviceId(),
    event,
    properties,
    local_date: getLocalDate(),
  });
}

export function trackError(message, context = "") {
  _post("error_log", {
    device_id:  getDeviceId(),
    message:    String(message).slice(0, 500),
    context:    String(context).slice(0, 100),
    local_date: getLocalDate(),
  });
}
