/**
 * Helpers for the post-login redirect (shared by the Google and PAuS handlers).
 *
 * The target is stashed in a short-lived httpOnly cookie so it survives the
 * OAuth round-trip, and is restricted to same-origin relative paths.
 */

export const AUTH_REDIRECT_COOKIE = "auth_redirect";

export const safeRedirectPath = (value: unknown, fallback = "/"): string => {
  if (typeof value !== "string") return fallback;
  // Only relative paths; reject protocol-relative (`//evil.com`) and auth routes.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/auth/")) return fallback;
  return value;
};

export const setAuthRedirect = (event: any, value: unknown) => {
  setCookie(event, AUTH_REDIRECT_COOKIE, safeRedirectPath(value), {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
};

export const takeAuthRedirect = (event: any): string => {
  const path = safeRedirectPath(getCookie(event, AUTH_REDIRECT_COOKIE));
  deleteCookie(event, AUTH_REDIRECT_COOKIE, { path: "/" });
  return path;
};
