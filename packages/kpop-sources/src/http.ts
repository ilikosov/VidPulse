import type { FetchLike } from './types';

export interface FetchJsonOptions {
  userAgent: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Retry attempts on 429/5xx/network error (default 3). */
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 3;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a URL and parse JSON, with a descriptive User-Agent, per-request timeout,
 * and exponential-backoff retries on transient failures (429 / 5xx / network).
 * `fetchImpl` is injectable so tests run without network.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions): Promise<T> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  if (!fetchImpl) {
    throw new Error('No fetch implementation available (Node 18+ or pass fetchImpl)');
  }
  const retries = options.retries ?? DEFAULT_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true; // distinguish our own timeout from an external signal abort
      controller.abort();
    }, timeoutMs);
    // Forward an external abort signal to our controller.
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent,
          Accept: 'application/sparql-results+json, application/json',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
      // Retry transient server-side conditions; fail fast on other 4xx.
      if (res.status === 429 || res.status >= 500) {
        // Capture the body so the surfaced error is actionable (e.g. MusicBrainz's
        // rate-limit message) instead of a bare status line.
        const body = await res.text().catch(() => '');
        lastError = new Error(
          `HTTP ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`,
        );
      } else {
        const body = await res.text().catch(() => '');
        throw new Error(
          `HTTP ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`,
        );
      }
    } catch (err) {
      // A timeout surfaces as an opaque AbortError; report it clearly. For undici's generic
      // "fetch failed" TypeError, the real reason (ECONNRESET/ETIMEDOUT/…) hides in err.cause.
      if (timedOut) {
        lastError = new Error(`request timed out after ${timeoutMs}ms`);
      } else if (err instanceof Error && err.message === 'fetch failed' && 'cause' in err) {
        const cause = (err as { cause?: unknown }).cause as
          | { code?: string; message?: string; errors?: unknown[] }
          | undefined;
        // undici may set cause to an AggregateError (several connect attempts) with no
        // code/message; fall back to its sub-errors' codes.
        const aggregated = Array.isArray(cause?.errors)
          ? cause.errors
              .map((e) => (e as { code?: string; message?: string })?.code ?? (e as Error)?.message)
              .filter(Boolean)
              .join(', ')
          : undefined;
        const detail = cause?.code ?? cause?.message ?? aggregated ?? String(cause);
        lastError = new Error(`fetch failed (${detail})`);
      } else {
        lastError = err;
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }

    if (attempt < retries) {
      await sleep(2 ** attempt * 1000); // 1s, 2s, 4s
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
