import { and, eq } from "drizzle-orm";
import { db } from "~/server/lib/db/drizzle";
import { searchBiblio } from "~/server/lib/migrations/schema";

/**
 * Biblio lookup by id.
 *
 * - GET only (previously any verb was accepted)
 * - id must be a positive integer
 * - records hidden from the OPAC are not returned
 */
export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id");

  if (!rawId || !/^\d{1,10}$/.test(rawId)) {
    throw createError({ statusCode: 400, message: "Invalid id" });
  }

  const id = Number(rawId);

  let biblioItem: any[];
  try {
    biblioItem = await db
      .select()
      .from(searchBiblio)
      .where(and(eq(searchBiblio.biblioId, id), eq(searchBiblio.opacHide, 0)))
      .limit(1);
  } catch (error: any) {
    // Do not leak driver/connection details to the client.
    console.error("[biblio]", error?.message);
    throw createError({
      statusCode: 503,
      message: "Layanan katalog sedang tidak tersedia",
    });
  }

  if (!biblioItem?.length) {
    throw createError({ statusCode: 404, message: "Biblio not found" });
  }

  return {
    result: biblioItem,
  };
});
