import {
  readItem,
  readItems,
  createItem as sdkCreateItem,
  updateItem as sdkUpdateItem,
  deleteItem as sdkDeleteItem,
} from "@directus/sdk";

/**
 * Directus item helpers (proxy-backed).
 *
 * Replaces nuxt-directus' `useDirectusItems()` so requests go through our
 * `$directus` client, which uses `useRequestFetch()` and therefore forwards the
 * session cookie during SSR. Without this, authenticated reads 401 while
 * server-rendering.
 */
export const useDirectusItemsProxy = () => {
  const nuxtApp = useNuxtApp();
  const client = () => (nuxtApp as any).$directus;

  const normalise = (params: Record<string, any> = {}) => {
    const out = { ...params };
    if (out.filter) out.filter = JSON.stringify(out.filter);
    if (out.deep) out.deep = JSON.stringify(out.deep);
    return out;
  };

  const getItems = async (data: {
    collection: string;
    params?: Record<string, any>;
  }) => {
    const params = normalise(data.params);
    const items = await client().request(
      (readItems as any)(data.collection, params),
    );
    // Match nuxt-directus: the envelope is returned when meta is requested.
    if (params.meta) return items;
    return Array.isArray(items) ? items : (items?.data ?? items);
  };

  const getSingletonItem = async (data: {
    collection: string;
    params?: Record<string, any>;
  }) => {
    const params = normalise(data.params);
    const items = await client().request(
      (readItems as any)(data.collection, params),
    );
    return Array.isArray(items) ? items[0] : items?.data?.[0];
  };

  const getItemById = async (data: {
    collection: string;
    id: string | number;
    params?: Record<string, any>;
  }) => {
    const item = await client().request(
      (readItem as any)(data.collection, data.id, normalise(data.params)),
    );
    return item?.data ?? item;
  };

  const createItems = async (data: {
    collection: string;
    items: any;
    params?: Record<string, any>;
  }) => {
    const created = await client().request(
      (sdkCreateItem as any)(data.collection, data.items),
    );
    return created?.data ?? created;
  };

  const updateItem = async (data: {
    collection: string;
    id: string | number;
    item: any;
  }) => {
    const updated = await client().request(
      (sdkUpdateItem as any)(data.collection, data.id, data.item),
    );
    return updated?.data ?? updated;
  };

  const deleteItems = async (data: {
    collection: string;
    id: string | number;
  }) => {
    return await client().request(
      (sdkDeleteItem as any)(data.collection, data.id),
    );
  };

  return {
    getItems,
    getSingletonItem,
    getItemById,
    createItems,
    updateItem,
    deleteItems,
  };
};
