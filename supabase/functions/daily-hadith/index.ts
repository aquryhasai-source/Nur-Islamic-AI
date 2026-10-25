// Retired: the OneSignal-based daily push was replaced by the self-hosted push pipeline
// (send-push + pg_cron). This stub intentionally does nothing. Safe to delete from the dashboard.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "This endpoint has been retired." }), {
    status: 410, headers: { "Content-Type": "application/json" },
  })
);
