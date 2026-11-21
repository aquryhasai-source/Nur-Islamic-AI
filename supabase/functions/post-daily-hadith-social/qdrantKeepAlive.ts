// qdrantKeepAlive.ts — daily Qdrant Cloud keep-alive (free clusters are suspended after ~1 week of inactivity).
//
// Self-contained on purpose (no imports from ../nur-proxy) so it bundles with this function however it is deployed.
// It NEVER throws and never leaks the URL or key into logs: a Qdrant blip must not stop the social post.
//
// Secrets (Supabase → Edge Functions → Secrets — Vercel env vars are NOT visible to Edge Functions):
//   QDRANT_URL, QDRANT_API_KEY

export interface KeepAliveResult {
  ok: boolean;
  /** true = secrets not set (nothing to keep alive). */
  skipped?: boolean;
  status?: number;
  collections?: number;
  ms: number;
  error?: string;
}

/** Strip whitespace and ALL trailing slashes so `${base}/collections` can never become `//collections`. */
export function normalizeQdrantUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+/i.test(url) ? url : null;
}

export interface KeepAliveOptions {
  url?: string | null;
  apiKey?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function envGet(key: string): string | undefined {
  try {
    // deno-lint-ignore no-explicit-any
    return (globalThis as any).Deno?.env?.get(key) ?? undefined;
  } catch {
    return undefined; // env access denied or unavailable
  }
}

/** GET {QDRANT_URL}/collections with the api-key header. Resolves (never rejects) with the outcome. */
export async function pingQdrant(opts: KeepAliveOptions = {}): Promise<KeepAliveResult> {
  const started = Date.now();
  const done = (r: Omit<KeepAliveResult, "ms">): KeepAliveResult => ({ ...r, ms: Date.now() - started });
  try {
    const base = normalizeQdrantUrl(opts.url ?? envGet("QDRANT_URL"));
    const apiKey = (opts.apiKey ?? envGet("QDRANT_API_KEY") ?? "").trim();
    if (!base || !apiKey) return done({ ok: false, skipped: true, error: "QDRANT_URL / QDRANT_API_KEY not set" });

    const doFetch = opts.fetchImpl ?? fetch;
    const res = await doFetch(`${base}/collections`, {
      method: "GET",
      headers: { "api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
    });
    if (!res.ok) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return done({ ok: false, status: res.status, error: `HTTP ${res.status}` });
    }
    let collections: number | undefined;
    try {
      const json = await res.json();
      if (Array.isArray(json?.result?.collections)) collections = json.result.collections.length;
    } catch { /* body is irrelevant; the request itself is the keep-alive */ }
    return done({ ok: true, status: res.status, collections });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    return done({ ok: false, error: name === "TimeoutError" || name === "AbortError" ? "timeout" : `network: ${name ?? "error"}` });
  }
}

/**
 * Fire-and-forget wrapper for Edge Functions: runs the ping in the background (EdgeRuntime.waitUntil keeps the
 * isolate alive until it settles) and logs a one-line outcome. Does not delay or affect the caller's response.
 */
export function keepQdrantAlive(options: KeepAliveOptions = {}): void {
  try {
    const task = pingQdrant(options).then((r) => {
      const detail = r.skipped ? "skipped (not configured)" : r.ok ? `ok ${r.status} in ${r.ms}ms` : `failed (${r.error}) in ${r.ms}ms`;
      console.log(`[qdrant-keepalive] ${detail}`);
    }).catch(() => { /* pingQdrant never rejects; belt and braces */ });
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
  } catch { /* a keep-alive problem must never reach the caller */ }
}
