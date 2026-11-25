import { createDirectus, rest, staticToken } from "@directus/sdk";

/**
 * Server-side Directus client using the service token.
 * Import only from server code — never from pages/components.
 */
const config = useRuntimeConfig();

export const directusClient = createDirectus(config.directusUrl as string)
  .with(staticToken(config.directusAuthToken as string))
  .with(rest());
