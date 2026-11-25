/**
 * Google sign-in (nuxt-auth-utils built-in provider).
 *
 * Only Unpad accounts are accepted, mirroring the PAuS policy.
 * Callback URL: <origin>/api/auth/callback/google
 * (the URL already registered in the Google console — kept from the previous
 * auth setup so no console change is needed).
 */
const googleHandler = defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const email = String((user as any)?.email ?? "").toLowerCase();

    if (!email.endsWith("@unpad.ac.id")) {
      return sendRedirect(event, "/login?error=domain");
    }

    await setUserSession(
      event,
      {
        user: {
          id: String((user as any)?.sub ?? email),
          name: (user as any)?.name ?? email,
          email,
          image: (user as any)?.picture,
          provider: "google",
        },
      },
      { maxAge: 60 * 20 },
    );

    return sendRedirect(event, takeAuthRedirect(event));
  },
  onError(event, error) {
    console.error("[auth/google]", (error as any)?.message);
    return sendRedirect(event, "/login?error=oauth");
  },
});

export default defineEventHandler(async (event) => {
  const { redirect } = getQuery(event);
  if (typeof redirect === "string") setAuthRedirect(event, redirect);
  return googleHandler(event);
});
