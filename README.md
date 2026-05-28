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
| **Frontend Builder** | Bolt.new | AI-assisted rapid UI scaffolding and component iteration |
| **UI Framework** | React 18 + Vite 5 | Component rendering, state management, PWA asset pipeline |
| **Backend / BaaS** | Supabase (PostgreSQL + Edge Functions) | Serverless proxy, device-scoped usage accounting, secret management |
| **LLM Inference** | Groq (Llama 3 / Mixtral) | Ultra-low-latency language model inference via REST API |
| **Quran Data** | AlQuran.cloud REST API | Arabic text (Uthmani script) + 6 translation editions |
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

### Zero-Hallucination Inference Pipeline

The core accuracy guarantee is enforced at the system-prompt layer of every inference call. Rather than relying on the model's parametric weights to recall Islamic rulings, the Edge Function constructs a **contextually bounded prompt** that:

1. **Restricts the model's epistemic scope** — the system instruction explicitly directs the LLM to answer only from the Quran and the six authenticated Hadith collections (Kutub al-Sittah), and to acknowledge uncertainty rather than speculate.

2. **Mandates citation syntax** — the model is required to emit every Quranic reference as `[Surah Name Chapter:Verse]` and every Hadith reference as `[Collection #Number]`. These tokens are parsed client-side via named regex patterns and rendered as deep-link affordances into the Quran and Hadith tabs.

3. **Enforces a scholarly disclaimer posture** — the prompt instructs the model to distinguish between established consensus (*ijma*) and areas of scholarly disagreement (*ikhtilaf*), and to recommend consultation with a qualified scholar for personal legal rulings (*fatwa*).

4. **Applies age-appropriate language shaping** — a `yearOfBirth` field stored in the user's local profile derives an age prefix injected into the user-turn context, causing the model to calibrate vocabulary complexity without any prompt engineering on the user's part.

This pipeline produces responses where every claim is traceable to a primary text, citations are verifiable in-app within two taps, and the model is structurally disincentivised from improvising.

---

## Cost Governance & Operational Stability

Unthrottled LLM APIs are a common cause of budget overruns in AI-native products. NŪR addresses this through a multi-layer cost control architecture:

### Server-Side Usage Accounting (Primary Control)

The Supabase Edge Function maintains a `usage_log` table in PostgreSQL keyed on `device_id` and `date`. Before every inference call:

- The function performs a **read-before-write** check: if the row's `count` for today's date meets or exceeds the configured cap (`DAILY_LIMIT = 15`), the request is rejected with HTTP 429 before a single token reaches the Groq API.
- On successful inference, the counter is atomically incremented within the same transaction, preventing race conditions on concurrent requests from the same device.
- Unlock codes (validated against a `license_keys` table) set the device's effective cap to `999`, bypassing the daily check without modifying the core accounting logic.

This means **API cost is bounded deterministically** at the database layer — not as a client-side suggestion.

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
- Ramadan mode: during Ramadan (detected via Hijri calendar API), a persistent banner displays a live countdown to Iftar or Suhoor, sourced from GPS coordinates or user-specified city

### Quran Reader (`QuranTab`)
- 114 Surahs fetched from AlQuran.cloud with Arabic (Uthmani) script and user-selected translation
- Response-level caching in a module-scoped `surahCache` object — subsequent opens are instant, zero additional API calls
- Full-text keyword search across the selected language edition
- Ayah-level bookmarking (Pro feature) with color-coded Quran / Hadith differentiation in the Bookmarks page
- Direct navigation from AI citations: `initialNav` prop carries `{ surah, ayah }` and `useEffect` scrolls the target ayah into view with a highlight animation

### Hadith Library (`HadithTab`)
- Six full collections loaded from CDN JSON, cached in `hadithCache` at collection level
- Cross-collection keyword search: iterates all six collections sequentially, streaming partial results to the UI as each collection resolves
- Paginated display (20 per page) with a "Load more" control to manage DOM size
- Direct navigation from AI citations with automatic page calculation and scroll-to-target

### Qibla Direction (`QiblaPage`) — Pro
- `DeviceOrientationEvent` integration (with iOS permission request flow) for live compass bearing
- Great-circle bearing calculation (`calculateQibla`) using the Haversine formula variant
- City-name fallback via Open Meteo geocoding when GPS is denied
- Animated SVG compass with rotating needle group and cardinal direction labels

### Islamic Calendar (`IslamicCalendarPage`)
- Today's Hijri date fetched from AlAdhan Gregorian-to-Hijri conversion endpoint
- Upcoming Islamic events computed from a static `ISLAMIC_EVENTS` lookup keyed on `month-day`
- Pro users see a full interactive month grid with today highlighted and event dots

### PWA & Installation
- Full Web App Manifest with `display_override: ["window-controls-overlay", "standalone"]`
- Service Worker with cache-then-network strategy; Supabase and Groq endpoints are explicitly excluded from caching
- `assetlinks.json` configured for Android Trusted Web Activity (TWA) packaging — enables Play Store distribution without a native codebase
- In-app install prompt: native `beforeinstallprompt` on Android, manual share-sheet instructions on iOS

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

### 3. Deploy the Edge Function

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

supabase login
supabase functions deploy nur-proxy --project-ref <your-project-ref>
```

### 4. Update the proxy URL

In `utils.js`, replace the `PROXY_URL` value with your own Supabase project's Edge Function URL:

```js
// utils.js
export const PROXY_URL = "https://<your-project-ref>.supabase.co/functions/v1/nur-proxy";
```

### 5. Run the development server

```bash
npm run dev
# App is available at http://localhost:3000
```

### 6. Build for production

```bash
npm run build
# Output is in /dist — deploy this directory to Vercel or any static host
```

### 7. Deploy to Vercel

```bash
# Push to GitHub, then import the repo at vercel.com
# Vercel auto-detects Vite — click Deploy
# The vercel.json rewrite rules handle SPA routing automatically
```

### Environment notes

- No `.env` file is required on the client — the Groq API key is stored exclusively as a Supabase secret and is never shipped to the browser.
- The `vite.config.js` sets `publicDir: "Public"` — ensure your local `public/` folder name matches the casing used in your OS and repository.
- Payment URLs in `GetProPage.jsx` (`LS_URL`, `RZ_URL`) should be updated to your own Lemon Squeezy and Razorpay checkout links before going live.

---

*Allahu A'lam — Allah knows best. This application is an educational tool; it does not replace the guidance of a qualified Islamic scholar.*
