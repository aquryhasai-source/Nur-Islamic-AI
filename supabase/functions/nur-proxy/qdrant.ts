// qdrant.ts — minimal Qdrant Cloud REST client (fetch only, no dependencies).
// Runs unchanged in Deno (Supabase Edge Functions) and Node >= 20 (ingestion script, tests).
//
// Qdrant holds ONLY: the vector, the Supabase `islamic_texts.id` as the point id, and thin filter payload.
// It never holds text. Every citation is hydrated from Supabase.

export type SourceType = "quran" | "hadith";
export type Grade = "Sahih" | "Hasan";

export const DEFAULT_COLLECTION = "islamic_texts";
export const VECTOR_DIMS = 768;

/** Strip whitespace and ALL trailing slashes so `${base}/collections` can never become `//collections`. */
export function normalizeBaseUrl(raw: string | null | undefined): string {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+/i.test(url)) {
    throw new QdrantError("config", "QDRANT_URL is missing or not an http(s) URL");
  }
  return url;
}

export type QdrantErrorKind = "config" | "http" | "timeout" | "network" | "bad_response";

export class QdrantError extends Error {
  kind: QdrantErrorKind;
  status?: number;
  constructor(kind: QdrantErrorKind, message: string, status?: number) {
    super(message);
    this.name = "QdrantError";
    this.kind = kind;
    this.status = status;
  }
}

export interface QdrantConfig {
  url: string;
  apiKey: string;
  collection?: string;
  fetchImpl?: typeof fetch;
}

/** Returns null (instead of throwing) when the secrets are not set, so callers can degrade to lexical-only. */
export function qdrantConfigFromEnv(get: (key: string) => string | undefined): QdrantConfig | null {
  const url = get("QDRANT_URL");
  const apiKey = get("QDRANT_API_KEY");
  if (!url || !apiKey) return null;
  try {
    return { url: normalizeBaseUrl(url), apiKey, collection: get("QDRANT_COLLECTION") || DEFAULT_COLLECTION };
  } catch {
    return null;
  }
}

export interface VectorFilter {
  sourceType?: SourceType;
  book?: string;        // hadith collection slug: 'bukhari', 'muslim', ...
  grade?: Grade;
  surahNumber?: number;
}

export interface VectorHit {
  id: number;
  score: number;
}

export interface ThinPayload {
  source_type: SourceType;
  book?: string;
  grade?: Grade;
  surah_number?: number;
}

export interface QdrantPoint {
  id: number;
  vector: number[];
  payload: ThinPayload;
}

export function toQdrantFilter(f?: VectorFilter): Record<string, unknown> | undefined {
  if (!f) return undefined;
  const must: unknown[] = [];
  if (f.sourceType) must.push({ key: "source_type", match: { value: f.sourceType } });
  if (f.book) must.push({ key: "book", match: { value: f.book } });
  if (f.grade) must.push({ key: "grade", match: { value: f.grade } });
  if (typeof f.surahNumber === "number") must.push({ key: "surah_number", match: { value: f.surahNumber } });
  return must.length ? { must } : undefined;
}

export interface QdrantClient {
  readonly baseUrl: string;
  readonly collection: string;
  /** GET /collections — cheap liveness call (also what the keep-alive uses). */
  ping(signal?: AbortSignal): Promise<{ status: number; collections: string[] }>;
  /** GET / — returns the server version string, or null if it cannot be read. */
  serverVersion(signal?: AbortSignal): Promise<string | null>;
  collectionExists(signal?: AbortSignal): Promise<boolean>;
  query(args: { vector: number[]; limit: number; filter?: VectorFilter; scoreThreshold?: number; signal?: AbortSignal }): Promise<VectorHit[]>;
  upsert(points: QdrantPoint[], signal?: AbortSignal): Promise<void>;
  /** Removes points by id (used by ingestion --prune when a hadith no longer qualifies). */
  deletePoints(ids: number[], signal?: AbortSignal): Promise<void>;
  createCollection(opts?: { quantization?: boolean }, signal?: AbortSignal): Promise<void>;
  createPayloadIndexes(signal?: AbortSignal): Promise<void>;
  count(signal?: AbortSignal): Promise<number>;
}

/** Qdrant 1.19 renamed scalar-quantization `always_ram` to `memory: "pinned"`. */
export function versionAtLeast(version: string | null, major: number, minor: number): boolean {
  const m = /^(\d+)\.(\d+)/.exec(version ?? "");
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a > major || (a === major && b >= minor);
}

export function createQdrantClient(cfg: QdrantConfig): QdrantClient {
  const baseUrl = normalizeBaseUrl(cfg.url);
  const collection = cfg.collection || DEFAULT_COLLECTION;
  const doFetch: typeof fetch = cfg.fetchImpl ?? ((...a) => fetch(...a));

  async function call(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<any> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: { "api-key": cfg.apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "AbortError" || name === "TimeoutError") throw new QdrantError("timeout", `Qdrant ${method} ${path} aborted`);
      throw new QdrantError("network", `Qdrant ${method} ${path} failed: ${(err as Error)?.message ?? err}`);
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      throw new QdrantError("http", `Qdrant ${method} ${path} -> ${res.status} ${detail}`, res.status);
    }
    try {
      return await res.json();
    } catch {
      throw new QdrantError("bad_response", `Qdrant ${method} ${path} returned non-JSON`, res.status);
    }
  }

  const c = encodeURIComponent(collection);

  return {
    baseUrl,
    collection,

    async ping(signal) {
      const json = await call("GET", "/collections", undefined, signal);
      const list = json?.result?.collections;
      if (!Array.isArray(list)) throw new QdrantError("bad_response", "unexpected /collections payload");
      return { status: 200, collections: list.map((x: { name?: string }) => String(x?.name ?? "")) };
    },

    async serverVersion(signal) {
      try {
        const json = await call("GET", "/", undefined, signal);
        return typeof json?.version === "string" ? json.version : null;
      } catch {
        return null;
      }
    },

    async collectionExists(signal) {
      try {
        await call("GET", `/collections/${c}`, undefined, signal);
        return true;
      } catch (err) {
        if (err instanceof QdrantError && err.status === 404) return false;
        throw err;
      }
    },

    async query({ vector, limit, filter, scoreThreshold, signal }) {
      const body: Record<string, unknown> = {
        query: vector,
        limit,
        with_payload: false,
        with_vector: false,
        params: { hnsw_ef: 128, quantization: { rescore: true, oversampling: 2.0 } },
      };
      const f = toQdrantFilter(filter);
      if (f) body.filter = f;
      if (typeof scoreThreshold === "number") body.score_threshold = scoreThreshold;
      const json = await call("POST", `/collections/${c}/points/query`, body, signal);
      const points = json?.result?.points;
      if (!Array.isArray(points)) throw new QdrantError("bad_response", "unexpected query payload");
      const hits: VectorHit[] = [];
      for (const p of points) {
        const id = Number(p?.id);
        const score = Number(p?.score);
        if (Number.isSafeInteger(id) && Number.isFinite(score)) hits.push({ id, score });
      }
      return hits;
    },

    async upsert(points, signal) {
      if (!points.length) return;
      await call("PUT", `/collections/${c}/points?wait=true`, { points }, signal);
    },

    async deletePoints(ids, signal) {
      if (!ids.length) return;
      await call("POST", `/collections/${c}/points/delete?wait=true`, { points: ids }, signal);
    },

    async createCollection(opts = {}, signal) {
      const body: Record<string, unknown> = {
        vectors: { size: VECTOR_DIMS, distance: "Cosine" },
        hnsw_config: { m: 16, ef_construct: 128 },
      };
      if (opts.quantization !== false) {
        const version = await this.serverVersion(signal);
        const scalar: Record<string, unknown> = { type: "int8", quantile: 0.99 };
        if (versionAtLeast(version, 1, 19)) scalar.memory = "pinned";
        else scalar.always_ram = true;
        body.quantization_config = { scalar };
      }
      await call("PUT", `/collections/${c}`, body, signal);
    },

    async createPayloadIndexes(signal) {
      const fields: Array<[string, string]> = [
        ["source_type", "keyword"],
        ["book", "keyword"],
        ["grade", "keyword"],
        ["surah_number", "integer"],
      ];
      for (const [field_name, field_schema] of fields) {
        await call("PUT", `/collections/${c}/index`, { field_name, field_schema }, signal);
      }
    },

    async count(signal) {
      const json = await call("POST", `/collections/${c}/points/count`, { exact: true }, signal);
      const n = Number(json?.result?.count);
      if (!Number.isFinite(n)) throw new QdrantError("bad_response", "unexpected count payload");
      return n;
    },
  };
}
