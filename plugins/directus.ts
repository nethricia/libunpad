import {
  createDirectus,
  rest,
  readItem,
  readItems,
  createItem,
  updateItem,
  deleteItem,
  uploadFiles,
} from "@directus/sdk";

/**
 * Directus client for the browser.
 *
 * Points at the authenticated server proxy (/api/v1/directus) and carries no
 * token — the proxy decides what the caller may do.
 *
 * `useRequestFetch()` is used instead of the global `$fetch` so the session
 * cookie is forwarded during SSR; without it, authenticated reads 401 while
 * server-rendering.
 */
export default defineNuxtPlugin(() => {
  const requestUrl = useRequestURL();
  const baseUrl = new URL("/api/v1/directus", requestUrl.origin).toString();
  const requestFetch = useRequestFetch();

  const directus = createDirectus(baseUrl, {
    globals: { fetch: requestFetch as unknown as typeof globalThis.fetch },
  }).with(rest());

  return {
    provide: {
      directus,
      readItem,
      readItems,
      createItem,
      updateItem,
      deleteItem,
      uploadFiles,
    },
  };
});
