/**
 * CORS for /api/** — allow-listed origins only.
 *
 * Replaces the previous `routeRules: { "/api/**": { cors: true } }`, which sent
 * `Access-Control-Allow-Origin: *` for every API route (including /api/auth).
 *
 * Configure extra origins with KANDAGA_CORS_ORIGINS (comma separated).
 */
const DEFAULT_ORIGINS = [
  "https://kandaga.unpad.ac.id",
  "https://www.kandaga.unpad.ac.id",
  "http://localhost:3000",
];

const configured = (process.env.KANDAGA_CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...DEFAULT_ORIGINS, ...configured]);

export default defineEventHandler((event) => {
  const path = event.path || "";
  if (!path.startsWith("/api/")) return;

  const origin = getHeader(event, "origin");
  const sameOrigin = !origin;

  // Same-origin requests need no CORS headers at all.
  if (sameOrigin) return;

  if (!allowedOrigins.has(origin)) {
    // Reject cross-origin preflights from unknown origins.
    if (event.method === "OPTIONS") {
      throw createError({ statusCode: 403, message: "Origin not allowed" });
    }
    return;
  }

  setHeader(event, "Access-Control-Allow-Origin", origin);
  setHeader(event, "Vary", "Origin");
  setHeader(event, "Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (event.method === "OPTIONS") {
    setHeader(event, "Access-Control-Max-Age", "600");
    return "";
  }
});
