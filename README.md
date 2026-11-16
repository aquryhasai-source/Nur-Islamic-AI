# NŪR — Islamic Knowledge Assistant

> A production-grade, full-stack AI SaaS application delivering grounded Islamic knowledge through a zero-hallucination inference pipeline, governed by a real-time cost control layer and deployed as a cross-platform Progressive Web Application.

---

## Executive Summary

NŪR is a full-stack AI knowledge platform purpose-built for doctrinal accuracy, operational cost governance, and audience-scale distribution. The application surfaces the complete Quran (114 Surahs, 6 parallel translations), six canonical Hadith collections totalling over 34,000 authenticated narrations, and an AI chat interface that synthesizes answers exclusively from that corpus — never from parametric model memory alone.

The system is architected around three non-negotiable design constraints: **accuracy** (every AI response is contextually grounded in scripture with inline citations), **cost predictability** (a database-enforced usage cap prevents unbounded LLM spend), and **reach** (a PWA-first deployment model with Trusted Web Activity packaging enables zero-friction installation across Android and iOS without an App Store intermediary).

The product is live, monetized via dual payment gateways, and acquiring users through an automated short-form content pipeline targeting YouTube Shorts and Instagram Reels.

---

## Core Technical Stack

| Layer | Technology | Role |
|---|---|---|
| **UI Framework** | React 18 + Vite 5 | Component rendering, state management, PWA asset pipeline |
| **Backend / BaaS** | Supabase (PostgreSQL + Edge Functions) | Serverless proxy, device-scoped usage accounting, secret management |
| **LLM Inference** | Groq (Llama 3 / Mixtral / GPT-OSS) | Ultra-low-latency language model inference via REST API |
| **Quran Data** | AlQuran.cloud REST API + Supabase `quran_ayahs` table | Arabic text (Uthmani script) + 6 translation editions; full-text search via PostgreSQL RPC |
| **Hadith Data** | fawazahmed0 / jsDelivr CDN | Static JSON for Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah |
| **Prayer Times** | AlAdhan.com API | GPS-aware and city-based Salah and Ramadan timing data |
| **Payments (Global)** | Lemon Squeezy | Stripe-backed checkout, license key issuance, webhook fulfillment |
| **Payments (India)** | Razorpay | UPI, Net Banking, Cards — locale-detected at runtime |
| **Deployment** | Vercel | Global CDN, SPA rewrite rules, zero-config CI/CD from GitHub |
| **PWA Runtime** | Service Worker (Cache-then-Network) | Offline-capable shell, installable on Android (TWA) and iOS |

---

## System Architecture

### Request Flow

```
Client (PWA)
    │
    │  POST /functions/v1/nur-proxy
    │  { device_id, messages[], unlock_code? }
    ▼
Supabase Edge Function  ◄── GROQ_API_KEY (Supabase Secret — never exposed to client)
    │
    │  1. Validate device_id
    │  2. Query usage_log table → check daily count against cap
    │  3. If cap exceeded → return 429, remaining: 0
    │  4. Construct grounded system prompt (see RAG section)
    │  5. Forward enriched payload to Groq /v1/chat/completions
    │  6. Atomically increment usage counter in PostgreSQL
    │  7. Return { reply, remaining, unlocked }
    ▼
Client
    │  Optimistic local decrement (instant UI feedback)
    │  Backend sync: accept server value only if stricter or Pro
    │  Rollback remaining count on network failure
    ▼
Rendered response with tappable inline citations
    [Al-Baqarah 2:286]  →  opens QuranTab at exact ayah
    [Bukhari #6412]     →  opens HadithTab at exact narration
```

---

## Zero-Hallucination Inference Pipeline (RAG)

The core accuracy guarantee is enforced at the system-prompt layer of every inference call. Rather than relying on the model's parametric weights to recall Islamic rulings, the Edge Function constructs a **contextually bounded prompt** through a multi-stage retrieval and validation pipeline.

### RAG Pipeline Stages

#### 1. Query Understanding & Expansion
- **FAQ Matching** — Deterministic keyword/alias matching for identity/app/billing/privacy questions. Returns pre-approved answers without LLM call.
- **Query Expansion** — Maps Islamic terminology variants to canonical terms (e.g., "halal" → "permissible, lawful, halal, clean, pure, fitrah") to improve retrieval coverage.
- **Context Stripping** — Removes age/personalization preamble (`[Context: ...]`) before keyword extraction so it doesn't crowd out the real question.
- **Name Normalization** — Transliterated names mapped to Saheeh International spelling (Isa → Jesus, Musa → Moses, Ibrahim → Abraham, etc.).

#### 2. Multi-Source Retrieval (Parallel)

| Source | Method | Output |
|--------|--------|--------|
| **Quran** | PostgreSQL RPC `search_quran_ayahs` (ranked full-text search over `quran_ayahs` table with tsvector) | Up to 5 verses with Arabic text, translation, surah/ayah coordinates |
| **Hadith** | Topic-map keyword matching → CDN fetch (`cdn.jsdelivr.net/gh/fawazahmed0/hadith-api`) | Up to 8 authenticated narrations from Kutub al-Sittah, trimmed to 900 chars |
| **Entities** | `islamic_entities` + `entity_aliases` tables (canonical names + aliases) | Curated background facts for people/events (Prophets, companions, battles, etc.) |

**Hadith Topic Map** — 29 curated topics (prayer, fasting, charity, patience, knowledge, parents, etc.) each mapped to specific hadith numbers across collections. Keyword overlap triggers retrieval.

#### 3. System Prompt Construction
The prompt is dynamically assembled with three possible modes:

**With Retrieved Context (Primary Mode)**
- Injects **VERIFIED QURAN VERSES** and **VERIFIED HADITH** blocks with full text
- Enforces **Citation Rules** (7 strict rules):
  1. ONLY cite sources listed above — never from memory
  2. Content accuracy check: "Does this text LITERALLY say what I am about to claim?"
  3. Do not stretch citations — a verse about Paradise doesn't support specific details not in the text
  4. Quran format: `[Surah Name Chapter:Verse]` (e.g., `[Al-Baqarah 2:255]`)
  5. Hadith format: `[Collection #Number]` (e.g., `[Sahih Bukhari #1]`)
  6. If no source supports a point → "Islamic scholarship generally holds that..."
  7. Better to make a claim without citation than to misuse one

**Without Retrieved Context (Fallback)**
- Allows general Islamic knowledge (tafsir, sirah, qisas al-anbiya)
- **FORBIDS** specific verse/hadith citations, direct quotations, or "the Prophet ﷺ said..."
- Must say "no verified source was retrieved" and point to sunnah.com/quran.com/scholar

**Entity Block** — Curated background facts injected as reference (never cited with bracket syntax)

#### 4. Query Classification & Model Routing
- **Light** (simple definitions, history, basic concepts) → GPT-OSS-20B
- **Complex** (fiqh rulings, halal/haram, personal circumstances, fatwa-adjacent) → GPT-OSS-120B
- Uncertainty always defaults to **Complex** for safety
- Personal/time-sensitive patterns force Complex classification

#### 5. LLM Generation & Streaming
- Temperature: 0.2 (deterministic)
- Max tokens: 1200
- Primary model + one retry + fallback (Light only falls back to Complex; Complex never downgrades)

#### 6. Post-Generation Citation Validation (Server-Side)
**Hadith Validation** — Every `[Collection #N]` in response checked against `contextSet` (retrieved hadiths). Invalid citations stripped.

**Quran Validation** — Every `[Surah Chapter:Verse]` checked against retrieved verses. Invalid citations stripped.

**Result** — Cleaned response + `hadCitationIssues` flag for metrics.

#### 7. Logging & Metrics (Write-Only)
- `ai_response_log` — Full Q&A with sources, model, classification, citation issues (90-day retention, RLS blocks all reads)
- `events` table — Lightweight metrics (model, generation_type, confidence, topic_keys)
- **Safe-to-log filter** excludes: Complex queries, personal patterns, time-sensitive queries

---

## Cost Governance & Operational Stability

Unthrottled LLM APIs are a common cause of budget overruns in AI-native products. NŪR addresses this through a multi-layer cost control architecture:

### Server-Side Usage Accounting (Primary Control)

The Supabase Edge Function maintains a `usage_log` table in PostgreSQL keyed on `device_id` and `date`. Before every inference call:

- **Read-before-write check**: if the row's `count` for today's date meets or exceeds the configured cap (`DAILY_LIMIT = 15`), the request is rejected with HTTP 429 before a single token reaches the Groq API.
- **Atomic increment**: On successful inference, the counter is atomically incremented within the same transaction, preventing race conditions on concurrent requests from the same device.
- **Unlock codes** (validated against a `license_keys` table) set the device's effective cap to `999`, bypassing the daily check without modifying the core accounting logic.

This means **API cost is bounded deterministically** at the database layer — not as a client-side suggestion.

### Hybrid Authentication & Quota Identity
- **Free users**: Device key (`X-Device-Key` header) + `device_id` binding via HMAC-SHA256 verification
- **Pro users (JWT)**: Supabase Auth RS256 JWT verified against JWKS; token `sub` becomes quota identity; device key not required
- **Pro daily cap**: 200 messages/day (sanity limit)
- **UTC-day safety cap**: 30/day per device (prevents date-hopping)
- **Global daily cap**: 5000 requests/day (configurable)

### Client-Side Optimistic Accounting (UX Layer)

To eliminate the latency of a round-trip before the UI reacts, the client applies an **optimistic local decrement** the moment the user submits a message:

```js
// Instant UI feedback — no waiting for server
localRemaining = Math.max(0, remaining - 1);
setRemaining(localRemaining);
setCachedRemaining(localRemaining);

// After response: only accept server value if it is stricter or is Pro
if (nr === 999 || nr < localRemaining) {
  setRemaining(nr);
}

// On network failure: roll back the optimistic decrement
catch (err) {
  setRemaining(remaining);       // restore pre-request value
  setCachedRemaining(remaining);
}
```

This pattern ensures the user sees an immediate response to their action while the server's authoritative count — which may reflect usage across multiple devices or sessions — is used to correct drift without ever *relaxing* the limit client-side.

### Daily Reset Mechanism

A `setInterval` running every 60 seconds compares the locally cached date against the current UTC date. On rollover, the client resets its local remaining count to `DAILY_LIMIT` and clears the cached date key — aligning with the server's date-keyed PostgreSQL rows. This prevents users from being incorrectly blocked due to stale local state after midnight.

### Locale-Aware Dual Payment Gateway

The `GetProPage` component performs a runtime country detection call (`ipapi.co/json`) and routes users to the appropriate payment provider:

- **India (`country_code === "IN"`)** → Razorpay checkout at ₹299 (UPI, Net Banking, Wallets)
- **Rest of World** → Lemon Squeezy checkout at $2.99 (Cards, PayPal)

Successful payment triggers license key issuance; the user redeems the key via the in-app code entry form, which the Edge Function validates against the database before setting `nur_unlocked = true` in `localStorage` and returning `remaining: 999`.

---

## Application Feature Surface

### AI Chat (`ChatTab`)
- Streaming-style response rendering with live typing indicators
- Regex-based citation parser with two named patterns (Quran and Hadith) operating over the full response string
- Deep-link navigation: tapping a citation switches the active tab and scrolls to the exact ayah or narration
- **Citations Panel** (desktop): side panel collecting every citation in the conversation, filterable by Quran/Hadith, with "Open" deep-link and full text preview
- Ramadan mode: during Ramadan (detected via Hijri calendar API), a persistent banner displays a live countdown to Iftar or Suhoor, sourced from GPS coordinates or user-specified city
- Age-aware responses: `yearOfBirth` in profile derives an age prefix injected into user context

### Quran Reader (`QuranTab`)
- 114 Surahs fetched from AlQuran.cloud with Arabic (Uthmani) script and user-selected translation
- Response-level caching in a module-scoped `surahCache` object — subsequent opens are instant, zero additional API calls
- Full-text keyword search across the selected language edition
- Ayah-level bookmarking (Pro feature) with color-coded Quran / Hadith differentiation in the Bookmarks page
- Direct navigation from AI citations: `initialNav` prop carries `{ surah, ayah }` and `useEffect` scrolls the target ayah into view with a highlight animation
- 6 translations: English (Sahih International), Urdu, French, Turkish, Indonesian, Bangla

### Hadith Library (`HadithTab`)
- Six full collections loaded from CDN JSON, cached in `hadithCache` at collection level
- Cross-collection keyword search: iterates all six collections sequentially, streaming partial results to the UI as each collection resolves
- Paginated display (20 per page) with a "Load more" control to manage DOM size
- Direct navigation from AI citations with automatic page calculation and scroll-to-target
- Collections: Sahih Bukhari (7,563), Sahih Muslim (7,453), Abu Dawud (5,274), Tirmidhi (3,956), An-Nasai (5,758), Ibn Majah (4,341)

### Qibla Direction (`QiblaPage` / `QiblaWeb`) — Pro
- **Mobile**: `DeviceOrientationEvent` integration (with iOS permission request flow) for live compass bearing
- **Desktop**: Offline world map with city bearings table (d3-geo + topojson-client + world-atlas)
- Great-circle bearing calculation (`calculateQibla`) using Haversine formula variant
- City-name fallback via Open Meteo geocoding when GPS is denied
- Animated SVG compass with rotating needle group and cardinal direction labels

### Islamic Calendar (`IslamicCalendarPage`)
- Today's Hijri date fetched from AlAdhan Gregorian-to-Hijri conversion endpoint
- Upcoming Islamic events computed from a static `ISLAMIC_EVENTS` lookup keyed on `month-day`
- Pro users see a full interactive month grid with today highlighted and event dots
- Key events: Islamic New Year, Ashura, Mawlid, Isra wal Miraj, Shab-e-Barat, Ramadan, Laylat al-Qadr, Eid al-Fitr, Eid al-Adha, Day of Arafah

### Prayer Times (`PrayerTimesPage`)
- GPS or city-based timings via AlAdhan API (Method 1: Umm al-Qura/Karachi, School 1: Hanafi Asr)
- Cached per location per day; week-ahead view with monthly calendar batching
- Alarm scheduling via `localStorage` + `setTimeout` (survives refresh)

### PWA & Installation
- Full Web App Manifest with `display_override: ["window-controls-overlay", "standalone"]`
- Service Worker with cache-then-network strategy; Supabase and Groq endpoints explicitly excluded from caching
- `assetlinks.json` configured for Android Trusted Web Activity (TWA) packaging — enables Play Store distribution without a native codebase
- In-app install prompt: native `beforeinstallprompt` on Android, manual share-sheet instructions on iOS
- Push notifications via VAPID + Supabase `push-subscribe` function; daily hadith delivery via cron

### Landing Page (`/`) — Public, Ad-Free
- Hero with animated headline ("ASK. READ. VERIFY.")
- Interactive "How it works" (3 steps) and "Everyday tools" (4 cards)
- Free vs Pro comparison
- Search box that deep-links to `/app?q=...` pre-filling the chat input
- Theme toggle (dark/light) persisted in `localStorage`

---

## Full-Lifecycle Product Ownership

NŪR is operated end-to-end as a product, not a portfolio demo. User acquisition is driven by an **automated short-form content pipeline** producing vertical video (9:16 aspect ratio) optimised for YouTube Shorts and Instagram Reels distribution. Each content unit is designed to surface a single Islamic insight — a Quranic verse with translation, a Hadith narration, or a thematic reflection — and resolves to a CTA directing viewers to the PWA. This pipeline operates independently of paid acquisition, building an owned audience that converts to free and Pro users without per-click spend.

---

## Local Development Setup

### Prerequisites

- Node.js ≥ 18
- A Supabase project (free tier sufficient for development)
- A Groq API key (free tier available at [console.groq.com](https://console.groq.com))

### 1. Clone and install dependencies

```bash
git clone https://github.com/<your-username>/nur-islamic-ai.git
cd nur-islamic-ai
npm install
```

### 2. Configure Supabase Edge Function secrets

In your Supabase dashboard, go to **Settings → Edge Functions → Secrets** and add:

| Secret Name | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay webhook settings |
| `RESEND_API_KEY` | For unlock code emails |
| `FEEDBACK_RECIPIENT_EMAIL` | Owner notification email |
| `RESEND_FROM_EMAIL` | e.g., `noreply@yourdomain.com` |
| `SUPPORT_REPLY_TO` | e.g., `support@yourdomain.com` |
| `RZP_PRO_LINK_IDS` | Comma-separated Razorpay payment link IDs |
| `RZP_PRO_SHORT_URLS` | Comma-separated Razorpay short URLs |
| `RZP_PRO_AMOUNT_PAISE` | `29900` (₹299) |
| `NUR_GLOBAL_DAILY_CAP` | `5000` (optional) |
| `NUR_REQUIRE_DEVICE_KEY` | `1` to enforce device key (optional) |
| `NUR_CLASSIFICATION_CONFIDENCE_THRESHOLD` | `0.75` (optional) |
| `NUR_MODEL_LIGHT` | `openai/gpt-oss-20b` (optional) |
| `NUR_MODEL_COMPLEX` | `openai/gpt-oss-120b` (optional) |

### 3. Run Supabase migrations

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

supabase login
supabase db push --project-ref <your-project-ref>
```

This applies the schema including:
- `quran_ayahs` table with full-text search (tsvector + `search_quran_ayahs` RPC)
- `islamic_entities` + `entity_aliases` for curated background facts
- `usage_log`, `licenses`, `events`, `ai_response_log` for accounting/logging
- `push_subscriptions` for notifications
- RLS policies (locked down per `002_lockdown_applied_2026-10-20.sql`)

### 4. Deploy the Edge Functions

```bash
supabase functions deploy nur-proxy --project-ref <your-project-ref>
supabase functions deploy nur-rp-webhook --project-ref <your-project-ref>
supabase functions deploy push-subscribe --project-ref <your-project-ref>
supabase functions deploy send-push --project-ref <your-project-ref>
# ... other functions as needed
```

### 5. Update the proxy URL

In `utils.js`, replace the `PROXY_URL` value with your own Supabase project's Edge Function URL:

```js
// utils.js
export const PROXY_URL = "https://<your-project-ref>.supabase.co/functions/v1/nur-proxy";
```

### 6. Run the development server

```bash
npm run dev
# App is available at http://localhost:5173 (Vite default)
```

### 7. Build for production

```bash
npm run build
# Output is in /dist — deploy this directory to Vercel or any static host
```

### 8. Deploy to Vercel

```bash
# Push to GitHub, then import the repo at vercel.com
# Vercel auto-detects Vite — click Deploy
# The vercel.json rewrite rules handle SPA routing automatically
```

### Environment notes

- No `.env` file is required on the client — the Groq API key is stored exclusively as a Supabase secret and is never shipped to the browser.
- The `vite.config.js` sets `publicDir: "Public"` — ensure your local `public/` folder name matches the casing used in your OS and repository.
- Payment URLs in `GetProPage.jsx` (`LS_URL`, `RZ_URL`) should be updated to your own Lemon Squeezy and Razorpay checkout links before going live.
- Set Vercel environment variable `NUR_INTERNAL_SECRET` (shared secret for internal API routes like `/api/hadith-reel` and `/api/hadith-card`).

---

## Security Hardening (2026-10-19 / 2026-10-20)

### Server (Supabase)
- Atomic daily quota with `consume_quota` RPC (race-condition-free)
- Rate limits: per-IP (20/min), per-device (6/min), per-IP-day (150/day free), global (5000/day)
- Device key binding: HMAC-SHA256 verification (`bind_device_key` RPC)
- License device cap: 3 devices per code
- Strict payload validation: max 64KB body, max 12 history messages, max 4000 chars/message, role whitelist (user/assistant only)
- CORS allowlist: only `nurislamicai.app`, `localhost:5173`, `localhost:4173`
- Locked cron functions: secrets in Vault only
- Signed payment webhooks (Razorpay HMAC + Lemon Squeezy signature)
- Refunds automatically revoke licenses
- HTML-escaped emails (XSS prevention)
- Push subscriptions via `push-subscribe` function only (no direct table writes)

### Client (App)
- Device key header (`X-Device-Key`) on all API calls
- Push via `push-subscribe` function (no direct table writes)
- Service Worker hardening: cache v2, same-origin GET only, safe notification URLs
- Internal API routes (`/api/hadith-reel`, `/api/hadith-card`) require `NUR_INTERNAL_SECRET`
- Input caps on internal API routes
- Removed ipapi.co lookups from client (moved to server where needed)
- Security headers + CSP (Report-Only) in `vercel.json`
- Corrected Privacy page
- `@vercel/blob` ^2.8.2 + pinned `package-lock.json`

### Database (RLS)
- `revoke all on all tables in schema public from anon, authenticated`
- Only `events` and `error_log` writable by anon
- `search_quran_ayahs` RPC: execute granted to `service_role` only
- Function `search_path` hardened to `public, pg_temp`
- Push subscriptions: all anon policies dropped (Part B, after app update)

---

## November 2026 — Visual Redesign

Visual-only overhaul (theme, layout, landing page). Application logic, API calls, engine and Supabase code are unchanged.

- `/` is the public landing page (`src/Landing.jsx`, ad-free); the app lives at `/app` (old hash links such as `/#prayers` still open the app)
- Theme tokens live in `src/theme.css` (dark default, `html.nur-light` for light)
- Website view (≥1024px) uses a persistent grouped sidebar; phones keep the drawer and top ad strip
- Chat / Quran / Hadith are browser-style tabs inside Home. Chat has a Citations panel; Quran and Hadith have a Reading options panel (display preferences only, stored in `localStorage` key `nur_reading_prefs`)
- Qibla on the website shows an offline map and a city bearings table (`src/QiblaWeb.jsx`); the compass is phone-only
- New dependencies: `d3-geo`, `topojson-client`, `world-atlas` (offline Qibla map)
- Sidebar ad: create a 300×250 unit in Adsterra and fill `ADSTERRA_RECT_KEY` / `ADSTERRA_RECT_INVOKE_URL` in `src/AdBanner.jsx`; until then it uses the existing 320×50 unit
- `WelcomeScreen.jsx` was removed

---

*Allahu A'lam — Allah knows best. This application is an educational tool; it does not replace the guidance of a qualified Islamic scholar.*