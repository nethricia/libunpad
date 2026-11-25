/**
 * Directus proxy.
 *
 * Purpose: keep the Directus service token out of the browser.
 *
 * This is a transparent pass-through. Access rules are exactly what they were
 * before (the client previously had the same token directly), so nothing that
 * used to load stops loading. If a caller sends their own Directus token
 * (staff login), that token is forwarded instead, so Directus still enforces
 * that user's permissions.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const directusUrl = (config.directusUrl as string | undefined)?.replace(
    /\/$/,
    "",
  );
  const serviceToken = config.directusAuthToken as string | undefined;

  if (!directusUrl || !serviceToken) {
    throw createError({
      statusCode: 503,
      message: "Directus is not configured",
    });
  }

  const path = (getRouterParam(event, "path") ?? "").replace(/^\/+/, "");
  if (!path) {
    throw createError({ statusCode: 404, message: "Not found" });
  }

  // Rebuild the target URL from the raw query string (h3's getQuery would
  // parse JSON-looking values such as `filter` into objects and drop them).
  const target = new URL(`${directusUrl}/${path}`);
  getRequestURL(event).searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const clientAuth = getHeader(event, "authorization");

  try {
    return await proxyRequest(event, target.toString(), {
      headers: {
        authorization: clientAuth || `Bearer ${serviceToken}`,
      },
    });
  } catch (error: any) {
    console.error("[directus-proxy]", error?.message);
    throw createError({
      statusCode: error?.response?.status ?? 502,
      message: "Upstream request failed",
    });
  }
});
