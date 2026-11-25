/**
 * Proxy for the Pustaka Digital Collections API.
 *
 * The upstream bearer key stays server-side; only known query parameters are
 * forwarded and the collection id is validated to prevent path traversal.
 */

const ALLOWED_PARAMS = new Set([
  "search",
  "unit_id",
  "file_type",
  "access_level",
  "page",
  "limit",
]);

/** Collection ids are UUIDs. */
const isValidId = (value: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );

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

  const { id, ...params } = query;

  if (id !== undefined && !isValidId(String(id))) {
    throw createError({ statusCode: 400, message: "Invalid id" });
  }

  const forwarded: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key) || value === undefined || value === null) {
      continue;
    }
    forwarded[key] = String(value);
  }

  const fetchWith = (baseUrl: string, apiKey: string) =>
    id
      ? $fetch(`${baseUrl}/digital-collections/${encodeURIComponent(String(id))}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        }).then((res: any) => res?.data ?? res) // detail is wrapped in { data }
      : $fetch(`${baseUrl}/digital-collections`, {
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
    console.error("[digital-collections-proxy]", error?.message);
    throw createError({
      statusCode,
      message: "Failed to fetch from Digital Collections API",
    });
  }
});
