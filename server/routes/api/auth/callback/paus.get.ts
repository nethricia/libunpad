/**
 * PAuS SSO sign-in (custom OAuth2 provider).
 *
 * PAuS is a plain OAuth2 server (no OIDC discovery, no id_token), so the flow
 * is implemented directly on top of nuxt-auth-utils' sealed session:
 *
 *   1. GET /auth/paus            -> redirect to the PAuS authorization page
 *   2. GET /auth/paus?code=...   -> validate state, exchange the code,
 *                                   read the profile, open the session
 *
 * Callback URL: <origin>/api/auth/callback/paus
 *
 * This path is deliberate — it is the URL already registered with PAuS (it was
 * next-auth's default before the auth refactor). PAuS binds the redirect URI to
 * the client and reports a mismatch as `invalid_client`, so changing the path
 * requires re-registering the client first. Override with
 * KANDAGA_PAUS_REDIRECT_URL if a different URL is ever registered.
 */
const STATE_COOKIE = "paus_oauth_state";
const STATE_MAX_AGE = 60 * 10;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const requestUrl = getRequestURL(event);
  const redirectUrl =
    (config.pausRedirectUrl as string | undefined) ||
    `${requestUrl.protocol}//${requestUrl.host}/api/auth/callback/paus`;

  const clientId = config.pausClientId as string | undefined;
  const clientSecret = config.pausClientSecret as string | undefined;

  if (!clientId || !clientSecret) {
    console.error(
      "[auth/paus] KANDAGA_PAUS_CLIENT_ID / KANDAGA_PAUS_CLIENT_SECRET are not set",
    );
    return sendRedirect(event, "/login?error=config");
  }

  // ---- Step 1: start the flow -------------------------------------------
  if (!query.code) {
    if (typeof query.redirect === "string") setAuthRedirect(event, query.redirect);

    const state = crypto.randomUUID();
    setCookie(event, STATE_COOKIE, state, {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_MAX_AGE,
    });

    const authorizationUrl = new URL(config.pausAuthorizationUrl as string);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUrl);
    authorizationUrl.searchParams.set("scope", "user.basic");
    authorizationUrl.searchParams.set("state", state);

    return sendRedirect(event, authorizationUrl.toString());
  }

  // ---- Step 2: handle the callback --------------------------------------
  const expectedState = getCookie(event, STATE_COOKIE);
  deleteCookie(event, STATE_COOKIE, { path: "/" });

  if (!expectedState || query.state !== expectedState) {
    console.error("[auth/paus] state mismatch");
    return sendRedirect(event, "/login?error=state");
  }

  // Exchange the authorization code for an access token.
  const tokens = await $fetch<any>(config.pausTokenUrl as string, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUrl,
      code: String(query.code),
    }).toString(),
  }).catch((error) => {
    console.error("[auth/paus] token exchange failed:", error?.message);
    return null;
  });

  const accessToken = tokens?.access_token;
  if (!accessToken) {
    return sendRedirect(event, "/login?error=oauth");
  }

  // Read the profile.
  const profile = await $fetch<any>(config.pausUserUrl as string, {
    query: { access_token: accessToken },
  }).catch((error) => {
    console.error("[auth/paus] profile request failed:", error?.message);
    return null;
  });

  if (!profile?.id) {
    return sendRedirect(event, "/login?error=profile");
  }

  // Require a real, active PAuS account (do not fall back to inactive ones).
  const accounts: any[] = Array.isArray(profile.accounts) ? profile.accounts : [];
  const account = accounts.find((a) => a?.is_active === true);
  if (!account) {
    return sendRedirect(event, "/login?error=inactive");
  }

  await setUserSession(
    event,
    {
      user: {
        id: String(profile.id),
        name: profile.name ?? profile.username ?? "Pengguna PAuS",
        username: profile.username ?? null,
        email: profile.email ?? null,
        image: profile.image_url ?? null,
        identifier: account.number ?? null,
        type: account.group_code ?? null,
        faculty: account.faculty_name ?? null,
        unit: account.unit_name ?? null,
        study_program: account.study_program_name ?? null,
        jenjang: account.program_name ?? null,
        provider: "paus",
      },
    },
    { maxAge: 60 * 20 },
  );

  return sendRedirect(event, takeAuthRedirect(event));
});
