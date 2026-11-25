/**
 * Proxy for the Pustaka units endpoint (faculty dropdown).
 * Only known query parameters are forwarded upstream.
 */

const ALLOWED_PARAMS = new Set(["search", "page", "limit"]);

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);

  const prodApiUrl = config.pustakaApiUrl as string;
  const prodApiKey = config.pustakaApiKey as string;
  const localApiUrl = config.pustakaLocalApiUrl as string;
  const localApiKey = config.pustakaLocalApiKey as string;

  if (!prodApiUrl || !prodApiKey) {
    throw createError({
      statusCode: 503,
      message: "Digital collections API is not configured",
    });
  }

  const forwarded: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!ALLOWED_PARAMS.has(key) || value === undefined || value === null) {
      continue;
    }
    forwarded[key] = String(value);
  }

  const fetchWith = (baseUrl: string, apiKey: string) =>
    $fetch(`${baseUrl}/units`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      query: forwarded,
    });

  try {
    // In dev, try local first; fall back to prod if local is unavailable
    if (import.meta.dev && localApiUrl && localApiKey) {
      try {
        return await fetchWith(localApiUrl, localApiKey);
      } catch {
        // Local API unavailable — fall through to prod
      }
    }
    return await fetchWith(prodApiUrl, prodApiKey);
  } catch (error: any) {
    const statusCode = error?.response?.status ?? error?.statusCode ?? 502;
    console.error("[units-proxy]", error?.message);
    throw createError({
      statusCode,
      message: "Failed to fetch from Units API",
    });
  }
});
