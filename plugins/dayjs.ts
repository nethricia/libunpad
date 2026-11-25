import dayjs from "dayjs/esm";
import relativeTime from "dayjs/esm/plugin/relativeTime";
import utc from "dayjs/esm/plugin/utc";
import timezone from "dayjs/esm/plugin/timezone";
import updateLocale from "dayjs/esm/plugin/updateLocale";
import "dayjs/esm/locale/id";
import "dayjs/esm/locale/en";

/**
 * dayjs setup (replaces the `dayjs-nuxt` module).
 *
 * Imported from `dayjs/esm` on purpose: the CommonJS bundle (`dayjs.min.js`) is
 * UMD and has no ESM default export, which broke the client entry when the
 * module-generated virtual file imported it.
 */
export default defineNuxtPlugin(() => {
  dayjs.extend(updateLocale);
  dayjs.extend(relativeTime);
  dayjs.extend(utc);
  dayjs.extend(timezone);

  dayjs.tz.setDefault("Asia/Jakarta");
  dayjs.locale("id");

  return {
    provide: { dayjs },
  };
});
