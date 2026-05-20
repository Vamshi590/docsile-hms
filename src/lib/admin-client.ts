import "server-only";

export type AdminConfig = {
  hospital: { id: string; code: string; name: string; timezone: string };
  subscription: {
    planCode: string;
    planName: string;
    status: string;
    periodEnd: string;
  } | null;
  enabledModules: string[];
  billing: {
    status: "current" | "overdue";
    overdueInvoiceCount: number;
    oldestOverdueDate: string | null;
    bannerMessage: string | null;
  };
  fetchedAt: string;
  cacheMaxAgeSec: number;
};

type CacheEntry = {
  config: AdminConfig;
  fetchedAt: number; // epoch ms
};

const STALE_TOLERANCE_MS = 24 * 60 * 60 * 1000; // 24h before throw
const FALLBACK_REFRESH_MS = 15 * 60 * 1000; // 15 min default

// In dev, cap the cache so admin changes show up quickly. Production keeps the
// server-provided cacheMaxAgeSec (typically 15 min).
const DEV_MAX_CACHE_MS = 30 * 1000; // 30s in dev
const isProd = process.env.NODE_ENV === "production";

// Module-level state, shared across request handlers in the same Node process.
let cache: CacheEntry | null = null;
let inflight: Promise<AdminConfig> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

function getEnv() {
  const url = process.env.ADMIN_API_URL;
  const key = process.env.ADMIN_API_KEY;
  if (!url || !key) {
    throw new Error("ADMIN_API_URL and ADMIN_API_KEY must be set");
  }
  return { url, key };
}

async function fetchFresh(): Promise<AdminConfig> {
  const { url, key } = getEnv();
  const res = await fetch(`${url}/api/v1/config`, {
    headers: { "X-Hospital-Key": key },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`admin /api/v1/config returned ${res.status}: ${body}`);
  }
  const config = (await res.json()) as AdminConfig;
  cache = { config, fetchedAt: Date.now() };
  scheduleNextRefresh(config.cacheMaxAgeSec);
  return config;
}

function scheduleNextRefresh(seconds: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const ms = Math.max(seconds * 1000, FALLBACK_REFRESH_MS);
  refreshTimer = setTimeout(() => {
    fetchFresh().catch((e) => {
      // Background refresh failure: swallow; keep stale cache.
      console.error("[admin-client] background refresh failed", e);
    });
  }, ms);
  // Don't block process shutdown
  refreshTimer.unref?.();
}

/**
 * Returns the current admin config.
 *
 *   - Cold boot: synchronous fetch; throws if it fails.
 *   - Warm cache: returns cached config; triggers background refetch if stale.
 *   - Cache older than 24h with no successful refresh: throws.
 */
export async function getAdminConfig(): Promise<AdminConfig> {
  const now = Date.now();

  if (cache) {
    const ageMs = now - cache.fetchedAt;
    if (ageMs > STALE_TOLERANCE_MS) {
      // Stale beyond tolerance — try fetch, if fails throw.
      try {
        return await fetchFresh();
      } catch (e) {
        cache = null;
        throw e;
      }
    }
    // Still within tolerance — return cached. If stale-ish, trigger background refresh.
    const serverMaxAgeMs = cache.config.cacheMaxAgeSec * 1000;
    const maxAgeMs = isProd ? serverMaxAgeMs : Math.min(serverMaxAgeMs, DEV_MAX_CACHE_MS);
    if (ageMs > maxAgeMs && !inflight) {
      inflight = fetchFresh().finally(() => {
        inflight = null;
      });
      // don't await — let it run in background
      inflight.catch(() => {});
    }
    return cache.config;
  }

  // No cache — synchronous fetch.
  if (!inflight) {
    inflight = fetchFresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Best-effort heartbeat ping. Failures are ignored. */
export async function sendHeartbeat(appVersion?: string): Promise<void> {
  try {
    const { url, key } = getEnv();
    await fetch(`${url}/api/v1/heartbeat`, {
      method: "POST",
      headers: {
        "X-Hospital-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ appVersion }),
    });
  } catch {
    // ignored
  }
}
