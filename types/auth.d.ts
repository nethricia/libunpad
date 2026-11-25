/**
 * Session type augmentation for nuxt-auth-utils.
 * Keeps the PAuS / Google profile fields typed on `session.user`.
 */
declare module "#auth-utils" {
  interface User {
    id?: string;
    name?: string;
    username?: string | null;
    email?: string | null;
    image?: string | null;
    /** NPM / NIP from PAuS */
    identifier?: string | null;
    /** PAuS group code (e.g. mahasiswa, dosen, tendik) */
    type?: string | null;
    faculty?: string | null;
    unit?: string | null;
    study_program?: string | null;
    jenjang?: string | null;
    provider?: "paus" | "google";
  }
}

export {};
