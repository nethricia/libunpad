import { defineStore } from "pinia";

/**
 * Submitter details shared across the ETD upload steps.
 *
 * NOTE: the previous DSpace helpers in this file (CSRF token, workspace
 * fetches) were removed. They ran in the browser with a bearer token read from
 * a JS-accessible cookie, and no active page uses them. If the DSpace
 * submission flow is revived, it must go through a server route that keeps the
 * token (and any service credentials) off the client.
 */
export const getSubmitterData = defineStore("submitterData", () => {
  const namaLengkap = ref("");
  const npm = ref("");
  const email = ref("");
  const fakultas = ref("");
  const programStudi = ref("");
  const jenjang = ref("");

  return {
    namaLengkap,
    npm,
    email,
    fakultas,
    programStudi,
    jenjang,
  };
});
