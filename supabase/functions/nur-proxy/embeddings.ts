// embeddings.ts — 768-dimension embedding providers (Gemini or OpenAI), fetch only.
// The SAME provider + model + dimension must be used for ingestion and for query time.
// Switching provider later means re-embedding the whole corpus (re-run ingestion with --force-embed).

export const EMBED_DIMS = 768;

export type EmbedTask = "query" | "document";

export interface EmbeddingProvider {
  readonly name: string;      // e.g. "gemini:gemini-embedding-001"
  readonly dims: number;
  embed(texts: string[], task: EmbedTask, signal?: AbortSignal): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  status?: number;
  retryAfterMs?: number;
  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "EmbeddingError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Matryoshka-truncated vectors are no longer unit length, so normalise (cosine similarity expects it). */
export function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (!Number.isFinite(norm) || norm === 0) throw new EmbeddingError("embedding has zero or invalid norm");
  return v.map((x) => x / norm);
}

function checkVectors(vectors: unknown, expected: number, dims: number): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== expected) {
    throw new EmbeddingError(`expected ${expected} embeddings, got ${Array.isArray(vectors) ? vectors.length : "none"}`);
  }
  return vectors.map((v) => {
    if (!Array.isArray(v) || v.length !== dims || !v.every((x) => typeof x === "number" && Number.isFinite(x))) {
      throw new EmbeddingError(`embedding must be ${dims} finite numbers`);
    }
    return l2Normalize(v as number[]);
  });
}

async function postJson(
  doFetch: typeof fetch, url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal,
): Promise<any> {
  let res: Response;
  try {
    res = await doFetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  } catch (err) {
    throw new EmbeddingError(`embedding request failed: ${(err as Error)?.name ?? "error"}`);
  }
  if (!res.ok) {
    const ra = Number(res.headers.get("retry-after"));
    throw new EmbeddingError(`embedding API returned ${res.status}`, res.status, Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined);
  }
  return await res.json();
}

export interface GeminiOptions { apiKey: string; model?: string; dims?: number; fetchImpl?: typeof fetch }

/** gemini-embedding-001, Matryoshka-truncated. Documents and queries use different task types. */
export function createGeminiProvider(opts: GeminiOptions): EmbeddingProvider {
  const model = opts.model ?? "gemini-embedding-001";
  const dims = opts.dims ?? EMBED_DIMS;
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = "https://generativelanguage.googleapis.com/v1beta/models";
  return {
    name: `gemini:${model}`,
    dims,
    async embed(texts, task, signal) {
      const taskType = task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
      const mk = (text: string) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: dims,
      });
      const headers = { "x-goog-api-key": opts.apiKey };
      if (texts.length === 1) {
        const json = await postJson(doFetch, `${base}/${model}:embedContent`, headers, mk(texts[0]), signal);
        return checkVectors([json?.embedding?.values], 1, dims);
      }
      const json = await postJson(doFetch, `${base}/${model}:batchEmbedContents`, headers, { requests: texts.map(mk) }, signal);
      const vectors = Array.isArray(json?.embeddings) ? json.embeddings.map((e: { values?: number[] }) => e?.values) : null;
      return checkVectors(vectors, texts.length, dims);
    },
  };
}

export interface OpenAIOptions { apiKey: string; model?: string; dims?: number; fetchImpl?: typeof fetch }

/** text-embedding-3-small with the `dimensions` parameter (native Matryoshka shortening). */
export function createOpenAIProvider(opts: OpenAIOptions): EmbeddingProvider {
  const model = opts.model ?? "text-embedding-3-small";
  const dims = opts.dims ?? EMBED_DIMS;
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    name: `openai:${model}`,
    dims,
    async embed(texts, _task, signal) {
      const json = await postJson(
        doFetch, "https://api.openai.com/v1/embeddings",
        { Authorization: `Bearer ${opts.apiKey}` },
        { model, input: texts, dimensions: dims, encoding_format: "float" }, signal,
      );
      const data = Array.isArray(json?.data) ? [...json.data].sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0)) : null;
      return checkVectors(data ? data.map((d: { embedding?: number[] }) => d?.embedding) : null, texts.length, dims);
    },
  };
}

/** EMBEDDING_PROVIDER = "gemini" | "openai" (default: gemini when GEMINI_API_KEY is set, else openai). Null when unconfigured. */
export function embeddingProviderFromEnv(get: (key: string) => string | undefined, fetchImpl?: typeof fetch): EmbeddingProvider | null {
  const want = (get("EMBEDDING_PROVIDER") ?? "").toLowerCase();
  const gemini = get("GEMINI_API_KEY");
  const openai = get("OPENAI_API_KEY");
  if ((want === "gemini" || !want) && gemini) return createGeminiProvider({ apiKey: gemini, model: get("EMBEDDING_MODEL") || undefined, fetchImpl });
  if ((want === "openai" || !want) && openai) return createOpenAIProvider({ apiKey: openai, model: get("EMBEDDING_MODEL") || undefined, fetchImpl });
  return null;
}
