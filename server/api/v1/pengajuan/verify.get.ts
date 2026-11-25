/**
 * Public letter verification.
 *
 * Returns a confirmation plus *masked* identity fields so a third party can
 * check authenticity without harvesting full personal data.
 */

const maskName = (value?: string | null) => {
  if (!value) return null;
  return String(value)
    .split(/\s+/)
    .map((part) =>
      part.length <= 2 ? part[0] + "*" : part[0] + "*".repeat(part.length - 1),
    )
    .join(" ");
};

const maskIdentifier = (value?: string | null) => {
  if (!value) return null;
  const str = String(value);
  if (str.length <= 4) return "*".repeat(str.length);
  return str.slice(0, 2) + "*".repeat(str.length - 4) + str.slice(-2);
};

export default defineEventHandler(async (event) => {
  const { id } = getQuery(event) as { id?: string };
  if (!id || typeof id !== "string" || id.length > 64) {
    throw createError({ statusCode: 400, message: "Invalid request" });
  }

  const runtime = useRuntimeConfig();
  const directusUrl = (runtime.directusUrl as string).replace(/\/$/, "");
  const token = runtime.directusAuthToken as string;

  const targets = [
    {
      jenis: "bebas-pustaka",
      collection: "pengajuan_surat_bebas_pustaka",
      identifierField: "npm",
    },
    {
      jenis: "pemeriksaan-turnitin",
      collection: "pengajuan_pemeriksaan_turnitin",
      identifierField: "nomor",
    },
  ];

  for (const target of targets) {
    const record = await $fetch<any>(
      `${directusUrl}/items/${target.collection}/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).catch(() => null);

    const data = record?.data;
    if (!data?.id) continue;

    return {
      jenis: target.jenis,
      data: {
        id: data.id,
        status_pengajuan: data.status_pengajuan ?? null,
        nama_lengkap: maskName(data.nama_lengkap),
        [target.identifierField]: maskIdentifier(data[target.identifierField]),
        nama_fakultas: data.nama_fakultas ?? null,
        nama_prodi: data.nama_prodi ?? null,
        nomor_surat: data.nomor_surat ?? null,
        judul_karya_tulis: data.judul_karya_tulis ?? null,
        similarity_number: data.similarity_number ?? null,
        date_updated: data.date_updated ?? null,
      },
    };
  }

  return null;
});
