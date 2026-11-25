/**
 * Contact form submission.
 *
 * Verifies the Cloudflare Turnstile token server-side before writing, so the
 * widget cannot be bypassed by calling Directus directly.
 */
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const verifyTurnstile = async (token: string, secretKey: string) => {
  const response = await $fetch<any>(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
  }).catch(() => null);
  return Boolean(response?.success);
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  if (!body) {
    throw createError({ statusCode: 400, message: "Invalid request" });
  }

  const { nama_lengkap, email, pesan, turnstileToken } = body;

  if (!nama_lengkap || !email || !pesan) {
    throw createError({ statusCode: 400, message: "Form belum lengkap" });
  }
  if (!turnstileToken) {
    throw createError({ statusCode: 400, message: "Verifikasi keamanan gagal" });
  }

  const runtime = useRuntimeConfig();
  const secretKey = runtime.turnstile?.secretKey as string | undefined;
  if (!secretKey) {
    throw createError({
      statusCode: 503,
      message: "Verifikasi keamanan belum dikonfigurasi",
    });
  }

  const verified = await verifyTurnstile(String(turnstileToken), secretKey);
  if (!verified) {
    throw createError({
      statusCode: 400,
      message: "Verifikasi keamanan gagal, silakan coba lagi",
    });
  }

  const directusUrl = (runtime.directusUrl as string).replace(/\/$/, "");
  const token = runtime.directusAuthToken as string;

  try {
    await $fetch(`${directusUrl}/items/pesan_kontak_kandaga`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        nama_lengkap: String(nama_lengkap).slice(0, 200),
        email: String(email).slice(0, 200),
        pesan: String(pesan).slice(0, 5000),
      },
    });
  } catch (error: any) {
    console.error("[kontak]", error?.message);
    throw createError({
      statusCode: 502,
      message: "Pesan gagal dikirim, silakan coba lagi",
    });
  }

  return { ok: true };
});