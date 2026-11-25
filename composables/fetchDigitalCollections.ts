/**
 * Pustaka origin (e.g. https://pustaka.unpad.ac.id) used to open
 * collection_url / reader_url / download_url links returned by the Digital
 * Collections API. Same origin as the /search (pustaka) integration.
 */
export const usePustakaOrigin = () => {
  const config = useRuntimeConfig();
  const pustakaPublicUrl = config.public.pustakaPublicUrl as string | undefined;
  try {
    return new URL(pustakaPublicUrl ?? "").origin;
  } catch {
    return "";
  }
};
