/**
 * Baseline security headers.
 *
 * A CSP is included to limit the impact of any remaining HTML injection:
 * scripts are restricted to self plus the third-party embeds the site uses.
 */
const CSP = [
  "default-src 'self'",
  // Nuxt needs inline bootstrap scripts; Turnstile, Instagram, YouTube, GA,
  // Cloudflare Web Analytics and the Tawk.to live-chat widget.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://*.tawk.to https://www.instagram.com https://www.youtube-nocookie.com https://www.googletagmanager.com https://www.google-analytics.com",
  // Tawk.to injects its widget stylesheets into the parent document, so
  // style-src (not just script-src) must allow it.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to",
  "font-src 'self' data: https://fonts.gstatic.com https://*.tawk.to",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "frame-src 'self' https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com https://drive.google.com https://www.instagram.com https://*.tawk.to",
  // `https:` does not cover websockets, and Tawk.to chats over wss://.
  "connect-src 'self' https: https://*.tawk.to wss://*.tawk.to",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

export default defineEventHandler((event) => {
  const path = event.path || "";

  setHeader(event, "X-Content-Type-Options", "nosniff");
  setHeader(event, "Referrer-Policy", "strict-origin-when-cross-origin");
  setHeader(event, "X-Frame-Options", "SAMEORIGIN");
  setHeader(event, "Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // Only advertise HSTS when the request actually arrived over TLS.
  const forwardedProto = getHeader(event, "x-forwarded-proto");
  const isHttps =
    forwardedProto?.split(",")[0]?.trim() === "https" ||
    Boolean((event.node.req.socket as any)?.encrypted);
  if (isHttps) {
    setHeader(
      event,
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (path.startsWith("/api/")) {
    // API responses must not be cached by shared caches.
    setHeader(event, "Cache-Control", "no-store");
    return;
  }

  setHeader(event, "Content-Security-Policy", CSP);
});
