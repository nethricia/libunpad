/**
 * Proxy for the licensed Pustaka API.
 *
 * The upstream bearer key stays server-side. Only a small allow-list of
 * resources and query parameters is forwarded, and identifiers are validated,
 * so callers cannot traverse to other upstream paths or lift data filters.
 */

/** Upstream resources this app is allowed to read. */
const ALLOWED_RESOURCES = new Set(["collections", "items", "ebooks"]);

/** Query parameters forwarded upstream. */
const ALLOWED_PARAMS = new Set([
  "search",
  "status",
  "access_level",
  "glam_type",
  "collection_type",
  "unit_id",
  "page",
  "limit",
  "sort",
  "fields",
  "filter",
]);

/** IDs are numeric or UUID; anything else is rejected. */
const isValidId = (value: string) =>
  /^[0-9a-fA-F-]{1,64}$/.test(value) && !value.includes("..");

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
      message: "Pustaka API is not configured",
    });
  }

  const { resource = "collections", id, ...params } = query;

  const resourceName = String(resource);
  if (!ALLOWED_RESOURCES.has(resourceName)) {
    throw createError({ statusCode: 400, message: "Invalid resource" });
  }
  if (id !== undefined && !isValidId(String(id))) {
    throw createError({ statusCode: 400, message: "Invalid id" });
  }

  // Only forward known parameters.
  const forwarded: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key) || value === undefined || value === null) {
      continue;
    }
    forwarded[key] = String(value);
  }

  const endpoint = (base: string) =>
    id
      ? `${base}/${resourceName}/${encodeURIComponent(String(id))}`
      : `${base}/${resourceName}`;

  const fetchWith = (baseUrl: string, apiKey: string) =>
    $fetch(endpoint(baseUrl), {
      headers: { Authorization: `Bearer ${apiKey}` },
      ...(id ? {} : { query: forwarded }),
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
    // Do not leak upstream error payloads/URLs to the client.
    console.error("[pustaka-proxy]", error?.message);
    throw createError({
      statusCode,
      message: "Failed to fetch from Pustaka API",
    });
  }
});
