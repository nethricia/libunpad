
/**
 * Official letter lookup (bebas pustaka / turnitin).
 *
 * Requires a signed-in user and only returns the record to its owner.
 * Letters are identified by a Directus record id.
 */

const ALLOWED = {
  "bebas-pustaka": {
    collection: "pengajuan_surat_bebas_pustaka",
    ownerFields: ["npm", "email"],
  },
  "pemeriksaan-turnitin": {
    collection: "pengajuan_pemeriksaan_turnitin",
    ownerFields: ["nomor", "email"],
  },
} as const;

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  const { jenis, id } = getQuery(event) as { jenis?: string; id?: string };
  const config = ALLOWED[jenis as keyof typeof ALLOWED];
  if (!config || !id) {
    throw createError({ statusCode: 400, message: "Invalid request" });
  }

  const runtime = useRuntimeConfig();
  const directusUrl = (runtime.directusUrl as string).replace(/\/$/, "");
  const token = runtime.directusAuthToken as string;

  const record = await $fetch<any>(
    `${directusUrl}/items/${config.collection}/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).catch(() => null);

  if (!record?.data?.id) {
    throw createError({ statusCode: 404, message: "Letter not found" });
  }

  // Ownership check: the signed-in user must match one of the owner fields.
  const user = session.user as any;
  const identifiers = [user.identifier, user.username, user.email]
    .filter(Boolean)
    .map((v: string) => String(v).toLowerCase());

  const owners = config.ownerFields
    .map((field) => record.data[field])
    .filter(Boolean)
    .map((v: string) => String(v).toLowerCase());

  if (!owners.some((owner) => identifiers.includes(owner))) {
    throw createError({ statusCode: 403, message: "Not allowed" });
  }

  return record.data;
});
