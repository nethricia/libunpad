/**
 * Sign out: clear the sealed session cookie and return home.
 * (nuxt-auth-utils also exposes `clear()` on the client; this route is handy
 * for plain links and for clearing server-side in one round-trip.)
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event);
  return sendRedirect(event, "/");
});
