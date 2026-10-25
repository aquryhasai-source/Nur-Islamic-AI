# Edge Functions (as deployed 2026-10-19)

| Folder | Deployed slug | verify_jwt | Who calls it |
|---|---|---|---|
| nur-proxy | nur-proxy | false | the app (checks Origin, device key, rate limits itself) |
| push-subscribe | push-subscribe | false | the app (device key + endpoint allowlist) |
| send-feedback | send-feedback | false | the app (Origin allowlist + rate limit) |
| nur-rp-webhook | nur-rp-webhook | false | Razorpay (HMAC signature) |
| nur-ls-webhook | **hyper-function** | false | Lemon Squeezy (HMAC signature) |
| send-push, send-prayer-alerts, post-daily-hadith-social | same | true | pg_cron only (x-cron-secret from Vault) |
| daily-hadith | daily-hadith | true | retired stub (410) — delete in dashboard |

Secrets (Supabase → Edge Functions → Secrets): GROQ_API_KEY, RESEND_API_KEY, FEEDBACK_RECIPIENT_EMAIL,
RAZORPAY_WEBHOOK_SECRET (required — webhook rejects everything without it), LS_WEBHOOK_SECRET, LS_API_KEY,
VAPID_*, META_*. Optional: NUR_REQUIRE_DEVICE_KEY=1 (set only after the new app version has been live a few days),
NUR_GLOBAL_DAILY_CAP (default 5000), RZP_PRO_LINK_IDS / RZP_PRO_SHORT_URLS / RZP_PRO_AMOUNT_PAISE.
Vercel env: NUR_INTERNAL_SECRET (must equal Vault secret `internal_secret`).
