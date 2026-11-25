/** Methods that carry a request body. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

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
  // Prefer the server-only origin address when configured: proxying uploads
  // through the public (Cloudflare) URL hairpins the request and is subject to
  // Cloudflare's body-size/timeout limits.
  const directusUrl = (
    (config.directusInternalUrl as string | undefined) ||
    (config.directusUrl as string | undefined)
  )?.replace(/\/$/, "");
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

  // Uploads (multipart/form-data) can be large PDFs. Buffering them with
  // readRawBody doubles memory use (body + fetch copy) and, worse, leaves the
  // original Content-Length header pointing at a body that may no longer match
  // — undici then aborts the upstream request and the proxy surfaces a 502.
  //
  // Stream the body straight through instead and drop the framing headers so
  // fetch frames the request itself.
  if (BODY_METHODS.has(event.method)) {
    delete event.node.req.headers["content-length"];
    delete event.node.req.headers["transfer-encoding"];
  }

  try {
    return await proxyRequest(event, target.toString(), {
      headers: {
        authorization: clientAuth || `Bearer ${serviceToken}`,
      },
      // Streams the request body (sets `duplex: "half"`) instead of buffering.
      streamRequest: true,
    });
  } catch (error: any) {
    // The thrown H3 error hides the real network error inside `cause`.
    const cause = error?.cause ?? error;
    console.error(
      "[directus-proxy] %s %s failed: %s (%s)",
      event.method,
      path,
      cause?.message ?? error?.message,
      cause?.code ?? cause?.errno ?? cause?.name ?? "unknown",
    );
    throw createError({
      statusCode: cause?.response?.status ?? error?.response?.status ?? 502,
      message: "Upstream request failed",
    });
  }
});
