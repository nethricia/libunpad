import { proxyRequest } from "h3";

/**
 * Authenticated proxy for Directus.
 *
 * The browser never receives a Directus token. Requests are forwarded with the
 * caller's own Directus token when present, otherwise with the server-side
 * service token, and only for explicitly allowed operations.
 */

/** Collections anyone may read (public content). */
const PUBLIC_READ = new Set([
  "artikel",
  "berita_kunjungan",
  "highlight_berita_depan",
  "koleksi_archive",
  "koleksi_ebook",
  "koleksi_gallery",
  "koleksi_museum",
  "koleksi_teater",
  "koleksi_tumbuhan",
  "koleksi_tugas_akhir",
  "collector_hayati",
  "kandaga_lens",
  "kandaga_lens_profile",
  "kandaga_faq",
  "agenda_kegiatan",
  "layanan_kandaga",
  "layanan_daring_kandaga",
  "layanan_luring_kandaga",
  "layanan_riset_kandaga",
  "regulasi_kandaga",
  "fasilitas_kandaga",
  "fitur_peminjaman_ruangan",
  "jam_layanan_perpustakaan",
  "jadwal_kelas_literasi",
  "konten_literasi_informasi",
  "daftar_courses",
  "pimnas",
  "piket_layanan",
  "tipe_koleksi",
  "tbtMhsUploadThesis",
  // Public visitor kiosk / check-in screens
  "data_kunjungan",
  "survey_kunjungan",
  "list_kesediaan_loker",
  "list_peminjaman_loker",
  "jam_layanan_perpustakaan",
]);

/** Collections anyone may write to (public submission forms). */
const PUBLIC_WRITE = new Set([
  "pesan_kontak_kandaga",
  "data_kunjungan",
  "data_kunjungan_panduan_libtour",
  "data_komplain",
  "survey_kunjungan",
  "peminjaman_ruangan",
  "pengajuan_surat_bebas_pustaka",
  "pengajuan_pemeriksaan_turnitin",
  "pengajuan_kelas_literasi_informasi",
  "list_kesediaan_loker",
  "list_peminjaman_loker",
  // Visitor kiosk records the extended-hours headcount here
  "piket_layanan",
]);

/** Auth endpoints that must stay reachable so staff can sign in. */
const AUTH_PASSTHROUGH = new Set(["login", "refresh", "logout"]);

const buildTarget = (base: string, path: string, source: URL) => {
  const url = new URL(`${base}/${path}`);
  // Use the raw query string: h3's getQuery() parses JSON values into objects
  // (which drops Directus filters), while URLSearchParams preserves them.
  source.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  return url;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const directusUrl = (config.directusUrl as string | undefined)?.replace(
    /\/$/,
    "",
  );
  const serviceToken = config.directusAuthToken as string | undefined;

  if (!directusUrl) {
    throw createError({
      statusCode: 503,
      message: "Directus is not configured",
    });
  }

  const path = (getRouterParam(event, "path") ?? "").replace(/^\/+/, "");
  const segments = path.split("/").filter(Boolean);
  const [head, collection] = segments;
  const method = (event.method || "GET").toUpperCase();

  if (!head) {
    throw createError({ statusCode: 404, message: "Not found" });
  }

  const target = buildTarget(directusUrl, path, getRequestURL(event)).toString();
  const clientAuth = getHeader(event, "authorization");

  const forward = (authorization?: string) =>
    proxyRequest(event, target, {
      headers: authorization ? { authorization } : {},
    });

  // --- Staff auth flow: forwarded untouched, no service token involved ---
  if (head === "auth") {
    if (!AUTH_PASSTHROUGH.has(segments[1] ?? "")) {
      throw createError({ statusCode: 404, message: "Not found" });
    }
    return await forward(clientAuth ?? undefined);
  }

  // --- Caller's own Directus token: their permissions apply ---
  if (clientAuth) {
    return await forward(clientAuth);
  }

  if (!serviceToken) {
    throw createError({
      statusCode: 503,
      message: "Directus is not configured",
    });
  }

  const isRead = method === "GET" || method === "HEAD";
  // Assets (images) are public; the /files listing is not — it exposes ids that
  // would let anonymous users fetch protected repository chapters.
  const isPublicAsset = isRead && head === "assets";

  // Public staff-name lookups (calendars, article authors, visitor kiosk).
  // Force a minimal field set so emails/roles/tokens are never returned.
  const isPublicUserLookup = isRead && head === "users";
  if (isPublicUserLookup) {
    const url = new URL(target);
    url.searchParams.set("fields", "id,first_name,last_name");
    return await proxyRequest(event, url.toString(), {
      headers: { authorization: `Bearer ${serviceToken}` },
    });
  }

  const isPublic =
    isPublicAsset ||
    (isRead && head === "items" && PUBLIC_READ.has(collection ?? "")) ||
    (!isRead && head === "items" && PUBLIC_WRITE.has(collection ?? ""));

  // --- Repository thesis records: hide protected chapters unless signed in ---
  const PROTECTED_COLLECTIONS = new Set([
    "tbtMhsUploadThesis",
    "koleksi_tugas_akhir",
  ]);
  if (
    isRead &&
    head === "items" &&
    PROTECTED_COLLECTIONS.has(collection ?? "")
  ) {
    const session = await getUserSession(event);
    if (session?.user) {
      return await forward(`Bearer ${serviceToken}`);
    }
    const upstream: any = await $fetch(target, {
      headers: { Authorization: `Bearer ${serviceToken}` },
    });
    const PROTECTED_FIELDS = [
      "FileBab2",
      "FileBab3",
      "FileBab4",
      "FileBab5",
      "FileBab6",
      "FileLampiran",
      "FileFullText",
      "fileBab2",
      "fileBab3",
      "fileBab4",
      "fileBab5",
      "fileBab6",
      "fileLampiran",
      "fileFullText",
    ];
    const strip = (row: any) => {
      if (!row || typeof row !== "object") return row;
      const copy = { ...row };
      for (const field of PROTECTED_FIELDS) delete copy[field];
      return copy;
    };
    if (Array.isArray(upstream?.data)) {
      upstream.data = upstream.data.map(strip);
    } else if (upstream?.data) {
      upstream.data = strip(upstream.data);
    }
    return upstream;
  }

  if (isPublic) {
    return await forward(`Bearer ${serviceToken}`);
  }

  // --- Anything else requires a signed-in user ---
  const session = await getUserSession(event);
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  return await forward(`Bearer ${serviceToken}`);
});
