/**
 * Server-side Scopus search proxy.
 *
 * The Elsevier API key must never reach the browser, and must never be
 * committed to the repository — it is read from KANDAGA_SCOPUS_API_KEY only.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = config.scopusApiKey as string | undefined;

  if (!apiKey) {
    throw createError({
      statusCode: 503,
      message: "Scopus is not configured",
    });
  }

  const { query, count = 12 } = getQuery(event);
  if (!query) {
    throw createError({ statusCode: 400, message: "Missing query" });
  }

  try {
    return await $fetch("https://api.elsevier.com/content/search/scopus", {
      query: { query, count, apiKey },
    });
  } catch (error: any) {
    // Do not leak upstream error payloads to the client.
    console.error("[scopus]", error?.message);
    throw createError({
      statusCode: error?.response?.status ?? 502,
      message: "Scopus search failed",
    });
  }
});
