# Security changes — 2026-10-19

Server (already live in Supabase): atomic daily quota, rate limits, device key, licence device cap (3), strict payload
validation, role whitelist, CORS allowlist, locked cron functions (secret in Vault), signed payment webhooks that only
mint a licence for the ₹299 Pro link, refunds revoke licences, HTML-escaped emails, push signup via `push-subscribe`.

This zip (app side): device key header, push via `push-subscribe`, service worker hardening (cache v2, same-origin
GET only, safe notification URLs), `/api/hadith-reel` requires `NUR_INTERNAL_SECRET`, `/api/hadith-card` input caps,
no more ipapi.co lookups, security headers + CSP (Report-Only) in vercel.json, corrected Privacy page,
`@vercel/blob` ^2.8.2 + package-lock.json.

Deploy order: 1) set Vercel env `NUR_INTERNAL_SECRET` (see chat), 2) upload this project to GitHub, 3) let Vercel deploy,
4) after a few days run PENDING_lockdown (Part A, then Part B).
