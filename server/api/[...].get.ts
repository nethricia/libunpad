/**
 * Catch-all for unmatched /api routes.
 *
 * Previously returned HTTP 200 with the reflected request URL and a developer
 * name, which masked probing and polluted monitoring. Unknown API paths are a
 * 404.
 */
export default defineEventHandler(() => {
  throw createError({ statusCode: 404, message: "Not found" });
});
