// / https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  app: {
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "in-out" },
    head: {
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
    },
  },

  devtools: {
    enabled: true,
  },

  routeRules: {
    // CORS is handled per-origin in server/middleware/cors.ts
    // (the previous wildcard `cors: true` exposed every API route to any site).
    "/visitor/rekap": { redirect: "/error" },
    "/pengajuan/unggah-mandiri/submit/**": {
      redirect: "/pengajuan/unggah-mandiri",
    },
  },

  modules: [
    "@unocss/nuxt",
    "nuxt-directus",
    "@pinia/nuxt",
    "@nuxt/image",
    "@nuxtjs/i18n",
    "nuxt-auth-utils",
    "@nuxtjs/turnstile",
    "nuxt-gtag",
  ],

  unocss: {
    preflight: true,
  },

  i18n: {
    locales: [
      {
        name: "id",
        code: "id",
        file: "indonesia.ts",
      },
      {
        name: "en",
        code: "en",
        file: "english.ts",
      },
    ],
    defaultLocale: "id",
    strategy: "prefix_and_default",
    langDir: "lang",
    // Resolved relative to the i18n directory (restructureDir), not the project
    // root — hence the "../" prefix.
    vueI18n: "../i18n.config.ts",
    skipSettingLocaleOnNavigate: true,
    detectBrowserLanguage: false,
    defaultDirection: "auto",
  },

  auth: {
    // nuxt-auth-utils: sealed-cookie sessions (no next-auth / next / react).
    // The session secret is derived from Nuxt's appSecret — set NUXT_APP_SECRET
    // (>= 32 chars) in production, e.g. `openssl rand -base64 32`.
    loadStrategy: "server-first",
  },

  directus: {
    autoFetch: true,
    // All Directus traffic goes through the authenticated server proxy at
    // /api/v1/directus. The service token stays server-side (see
    // server/api/v1/directus/[...path].ts) and is never sent to the browser.
    url: "/api/v1/directus",
  },

  runtimeConfig: {
    // Session sealing secret. nuxt-auth-utils derives the cookie key from
    // Nuxt's `appSecret`; NUXT_APP_SECRET overrides this at runtime.
    appSecret:
      process.env.NUXT_APP_SECRET ?? process.env.AUTH_KANDAGA_SECRET ?? "",
    // PAuS OAuth (custom provider — see server/routes/auth/paus.get.ts)
    pausClientId: process.env.KANDAGA_PAUS_CLIENT_ID,
    pausClientSecret: process.env.KANDAGA_PAUS_CLIENT_SECRET,
    pausAuthorizationUrl:
      process.env.KANDAGA_PAUS_AUTHORIZATION_URL ??
      "https://paus.unpad.ac.id/oauth",
    pausTokenUrl:
      process.env.KANDAGA_PAUS_TOKEN_URL ??
      "https://paus.unpad.ac.id/oauth/access-token",
    pausUserUrl:
      process.env.KANDAGA_PAUS_USER_URL ??
      "https://paus.unpad.ac.id/api/accounts",
    // Only set this if a different callback URL is registered with PAuS.
    pausRedirectUrl: process.env.KANDAGA_PAUS_REDIRECT_URL,
    // Google OAuth (built-in nuxt-auth-utils provider)
    oauth: {
      google: {
        clientId: process.env.AUTH_KANDAGA_GOOGLE_CLIENT_ID,
        clientSecret: process.env.AUTH_KANDAGA_GOOGLE_CLIENT_SECRET,
      },
    },
    urlApiKandaga: process.env.KANDAGA_URL_API_KANDAGA,
    pustakaApiUrl: process.env.KANDAGA_PUSTAKA_API_URL,
    pustakaApiKey: process.env.KANDAGA_PUSTAKA_API_KEY,
    pustakaLocalApiUrl: process.env.KANDAGA_PUSTAKA_LOCAL_API_URL,
    pustakaLocalApiKey: process.env.KANDAGA_PUSTAKA_LOCAL_API_KEY,
    directusUrl: process.env.KANDAGA_DIRECTUS_BASE_URL,
    // Optional server-only Directus address. The public URL points at
    // https://…/backoffice, so proxying through it makes the server call back
    // out through Cloudflare (slow, and subject to Cloudflare upload/timeout
    // limits). Set this to the origin (e.g. http://127.0.0.1:8055) so the
    // server talks to Directus directly while browsers keep the public URL.
    directusInternalUrl: process.env.KANDAGA_DIRECTUS_INTERNAL_URL,
    directusAuthToken: process.env.KANDAGA_DIRECTUS_ACCESS_TOKEN,
    dbHost: process.env.KANDAGA_DRIZZLE_HOST,
    dbUsername: process.env.KANDAGA_DRIZZLE_USERNAME,
    dbName: process.env.KANDAGA_DRIZZLE_DATABASE,
    dbPassword: process.env.KANDAGA_DRIZZLE_PASSWORD,
    dbPort: Number(process.env.KANDAGA_DRIZZLE_PORT),
    dbSsl: process.env.KANDAGA_DRIZZLE_SSL === "true",
    dbConnectionLimit: Number(process.env.KANDAGA_DRIZZLE_CONNECTION_LIMIT ?? 10),
    scopusApiKey: process.env.KANDAGA_SCOPUS_API_KEY,
    // Sealed-session cookie lifetime (matches the previous 20-minute session).
    session: {
      maxAge: 60 * 20,
    },
    turnstile: {
      secretKey: process.env.KANDAGA_TURNSTILE_SECRETKEY,
    },
    public: {
      meiliHost: process.env.KANDAGA_MEILI_HOST,
      directusPublicUrl: process.env.KANDAGA_DIRECTUS_BASE_URL,
      pustakaPublicUrl: process.env.KANDAGA_PUSTAKA_API_URL,
    },
  },

  image: {
    // Allow NuxtImg/IPX to fetch Directus assets from the public Directus host
    // (derived from the same env var the proxy uses).
    domains: (() => {
      const base = process.env.KANDAGA_DIRECTUS_BASE_URL;
      if (!base) return [];
      try {
        return [new URL(base).host];
      } catch {
        return [];
      }
    })(),
    quality: 80,
    format: ["webp"],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
    },
  },

  compatibilityDate: "2024-07-22",

  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  vite: {
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          target: "esnext",
        },
      },
    },
    optimizeDeps: {
      include: ["@directus/sdk"],
    },
  },
  turnstile: {
    siteKey: process.env.KANDAGA_TURNSTILE_SITEKEY,
  },
  gtag: {
    id: process.env.KANDAGA_GTAG_ID,
  },
});
