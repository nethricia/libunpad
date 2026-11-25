import type dayjs from "dayjs/esm";

/**
 * Access the shared dayjs instance (configured in plugins/dayjs.ts).
 * Keeps the `useDayjs()` API that pages already use.
 */
export const useDayjs = () => useNuxtApp().$dayjs as typeof dayjs;
