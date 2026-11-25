<script setup>
const route = useRoute();
const { getItemById } = useDirectusItems();
const { cariFakultasAbbrevation } = daftarNamaFakultasUnpad();
const { loggedIn } = useUserSession();

// Pustaka origin for opening collection/reader/download links
const pustakaOrigin = usePustakaOrigin();
const readerUrl = (attachment) =>
  attachment?.reader_url ? pustakaOrigin + attachment.reader_url : null;

// ---------------------------------------------------------------
// One route, two catalogs: Pustaka (UUID) and Directus (koleksi_ebook)
// ---------------------------------------------------------------
let pustakaItem = null;
try {
  pustakaItem = await $fetch("/api/v1/digital-collections", {
    query: { id: route.params.id },
  });
} catch {
  // not a Pustaka collection — fall through to the Kandaga catalog
}
if (!pustakaItem?.id) pustakaItem = null;

let kandagaItem = null;
if (!pustakaItem) {
  try {
    kandagaItem = await getItemById({
      collection: "koleksi_ebook",
      id: route.params.id,
    });
  } catch {
    kandagaItem = null;
  }
}

if (!pustakaItem && !kandagaItem?.id) {
  throw createError({
    statusCode: 404,
    statusMessage: "E-book tidak ditemukan",
    fatal: true,
  });
}

const isPustaka = computed(() => Boolean(pustakaItem));
const pageTitle = computed(
  () => pustakaItem?.title || kandagaItem?.judul || "E-Book",
);

// ---------------- Pustaka (external digital collections) ----------------
const metadataRows = computed(() => {
  if (!isPustaka.value) return [];
  const rows = Array.isArray(pustakaItem?.metadata) ? pustakaItem.metadata : [];
  return rows
    .filter((m) => m?.label && m?.value !== null && m?.value !== undefined)
    .map((m) => ({
      label: m.label,
      value: Array.isArray(m.value) ? m.value.join(", ") : String(m.value),
    }));
});

const attachments = computed(() => {
  if (!isPustaka.value) return [];
  const list = pustakaItem?.attachments?.length
    ? pustakaItem.attachments
    : pustakaItem?.primary_attachment
      ? [pustakaItem.primary_attachment]
      : [];
  return list.filter((a) => a?.reader_url || a?.download_url);
});

// ---------------- Kandaga (Directus koleksi_ebook) ----------------
const driveId = computed(() => kandagaItem?.link_url?.split("/").at(5) ?? null);
const drivePreviewUrl = computed(() =>
  driveId.value
    ? `https://drive.google.com/file/d/${driveId.value}/preview`
    : null,
);
const kandagaFakultas = computed(
  () =>
    cariFakultasAbbrevation(kandagaItem?.fakultas) ||
    kandagaItem?.fakultas ||
    null,
);
const kandagaAccessType = computed(() => kandagaItem?.access_type ?? "public");
const needsLogin = computed(
  () => kandagaAccessType.value === "login" && !loggedIn.value,
);
const isClosed = computed(() => kandagaAccessType.value === "closed");

// Reader controls (Kandaga only)
const containerRef = ref(null);
const zoom = ref(1);
const fitToWidth = ref(true);

const zoomIn = () => {
  zoom.value = Math.min(2.5, +(zoom.value + 0.1).toFixed(2));
};
const zoomOut = () => {
  zoom.value = Math.max(0.5, +(zoom.value - 0.1).toFixed(2));
};
const resetZoom = () => {
  zoom.value = 1;
  fitToWidth.value = true;
};
const toggleFit = () => {
  fitToWidth.value = !fitToWidth.value;
  if (fitToWidth.value) zoom.value = 1;
};
const toggleFullscreen = async () => {
  if (!import.meta.client) return;
  const el = containerRef.value;
  if (!el) return;
  try {
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    // ignore
  }
};

// External (signed/CDN) thumbnails can expire or be IP-bound (403). Images
// start transparent and only fade in once they actually load, so a failed
// cover never shows a broken-image glyph — the fallback layer stays visible.
const onCoverLoad = (event) => {
  event.target?.classList?.remove("opacity-0");
};

const onCoverError = (event) => {
  const img = event.target;
  if (!img || img.dataset.failed) return;
  img.dataset.failed = "1";
  img.style.display = "none";
};

// Format attachment file size (bytes -> human readable)
const formatFileSize = (bytes) => {
  const n = Number(bytes);
  if (!n || n < 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = n;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
</script>

<template>
  <section class="max-w-7xl ma py-6">
    <Head>
      <Title>{{ pageTitle }} | Kandaga Universitas Padjadjaran</Title>
    </Head>

    <div class="mb-4">
      <NuxtLink to="/koleksi/ebook" class="btn bg-transparent text-unpad px-2 py-1">← Kembali</NuxtLink>
    </div>

    <!-- ================= VOILE ================= -->
    <template v-if="isPustaka">
      <div class="bg-white rounded-lg shadow p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div class="relative w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200"
            style="aspect-ratio: 210 / 297">
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-4">
              <span class="i-mdi-book-open-variant w-10 h-10" />
              <span class="text-[10px] font-700 uppercase tracking-[0.18em]">E-Book</span>
            </div>
            <img :src="pustakaItem?.thumbnail || '/images/default_cover.png'"
              alt="" referrerpolicy="no-referrer" @error="onCoverError" @load="onCoverLoad"
              class="relative h-full w-full object-cover opacity-0 transition-opacity duration-300" />
          </div>
          <span v-if="pustakaItem?.access_level && pustakaItem.access_level !== 'public'"
            class="inline-block mt-3 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
            Akses Terbatas
          </span>
        </div>

        <div class="md:col-span-2 flex flex-col gap-2">
          <h1 class="text-2xl font-semibold m-0">{{ pustakaItem?.title }}</h1>
          <p v-if="pustakaItem?.creator?.creator_name" class="text-sm text-gray-600 m-0">
            <span class="font-600 text-gray-8">Pencipta:</span>
            {{ pustakaItem.creator.creator_name }}
            <span v-if="pustakaItem.creator?.affiliation"> — {{ pustakaItem.creator.affiliation }}</span>
          </p>
          <p v-if="pustakaItem?.unit?.name" class="text-sm text-gray-600 m-0">
            <span class="font-600 text-gray-8">Fakultas/Unit:</span>
            {{ pustakaItem.unit.name }}
          </p>
          <p v-if="pustakaItem?.collection_code" class="text-sm text-gray-600 m-0">
            <span class="font-600 text-gray-8">Kode Koleksi:</span>
            {{ pustakaItem.collection_code }}
          </p>
          <p v-if="pustakaItem?.type?.label" class="text-sm text-gray-600 m-0">
            <span class="font-600 text-gray-8">Jenis:</span>
            {{ pustakaItem.type.label }}
            <span v-if="pustakaItem.type?.local_name"> ({{ pustakaItem.type.local_name }})</span>
          </p>
          <p v-if="pustakaItem?.description" class="text-sm text-gray-600 m-0 text-justify leading-relaxed">
            {{ pustakaItem.description }}
          </p>
          <div v-if="pustakaItem?.collection_url" class="mt-2">
            <a :href="pustakaOrigin + pustakaItem.collection_url" target="_blank" rel="noopener noreferrer"
              class="text-unpad text-sm font-600 hover:underline">
              Lihat di katalog Pustaka →
            </a>
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div v-if="metadataRows.length" class="bg-white rounded-lg shadow p-5 md:p-6 mt-4">
        <h2 class="text-lg font-semibold mt-0 mb-3">Metadata</h2>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 m-0">
          <div v-for="(row, i) in metadataRows" :key="i" class="flex gap-2 text-sm">
            <dt class="font-600 text-gray-8 min-w-40 shrink-0">{{ row.label }}</dt>
            <dd class="text-gray-6 m-0">{{ row.value }}</dd>
          </div>
        </dl>
      </div>

      <!-- Attachments -->
      <div v-if="attachments.length" class="bg-white rounded-lg shadow p-5 md:p-6 mt-4">
        <h2 class="text-lg font-semibold mt-0 mb-3">
          Berkas Digital ({{ attachments.length }})
        </h2>
        <div class="flex flex-col gap-3">
          <div v-for="file in attachments" :key="file.id"
            class="flex flex-col sm:flex-row sm:items-center gap-3 border border-gray-2 rounded-lg p-3">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="i-mdi-file-pdf-box w-8 h-8 text-red-500 shrink-0" />
              <div class="min-w-0">
                <p class="font-600 text-sm text-gray-8 m-0 truncate">{{ file.file_name }}</p>
                <p class="text-xs text-gray-5 m-0">
                  {{ file.mime_type ?? "-" }} · {{ formatFileSize(file.file_size) }}
                  <span v-if="file.is_primary"
                    class="ml-1 bg-green-500 text-white px-1.5 py-0.5 rounded-full">Utama</span>
                  <span v-if="file.access_level && file.access_level !== 'public'"
                    class="ml-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full">Akses Terbatas</span>
                </p>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <a v-if="file.reader_url" :href="readerUrl(file)" target="_blank" rel="noopener noreferrer"
                class="btn bg-unpad text-white text-sm px-4 py-1.5 no-underline">
                Baca
              </a>
              <a v-if="file.download_url" :href="pustakaOrigin + file.download_url" target="_blank" rel="noopener noreferrer"
                class="btn bg-gray text-white text-sm px-4 py-1.5 no-underline">
                Unduh
              </a>
            </div>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-3 mb-0 flex items-center gap-1.5">
          <span class="i-mdi-lock-outline w-3.5 h-3.5 shrink-0" />
          Membaca memerlukan login ID PAuS pada e-reader digital Pustaka.
        </p>
      </div>
    </template>

    <!-- ================= KANDAGA (Directus) ================= -->
    <template v-else>
      <div class="bg-white rounded-lg shadow p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div class="relative w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200"
            style="aspect-ratio: 210 / 297">
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-4">
              <span class="i-mdi-book-open-variant w-10 h-10" />
              <span class="text-[10px] font-700 uppercase tracking-[0.18em]">E-Book</span>
            </div>
            <img :src="kandagaItem?.thumbnail ? directusImageUrl(kandagaItem.thumbnail) : (driveId ? `https://lh3.googleusercontent.com/d/${driveId}=w600-h600` : '/images/default_cover.png')"
              alt="" referrerpolicy="no-referrer" @error="onCoverError" @load="onCoverLoad"
              class="relative h-full w-full object-cover opacity-0 transition-opacity duration-300" />
          </div>
          <span v-if="kandagaAccessType !== 'public'"
            class="inline-block mt-3 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
            Akses Terbatas
          </span>
        </div>

        <div class="md:col-span-2 flex flex-col gap-2">
          <h1 class="text-2xl font-semibold m-0">{{ kandagaItem?.judul }}</h1>
          <p v-if="kandagaFakultas" class="text-sm text-gray-600 m-0">
            <span class="font-600 text-gray-8">Fakultas:</span>
            {{ kandagaFakultas }}
          </p>
        </div>
      </div>

      <!-- Reader -->
      <div class="mt-4">
        <div v-if="isClosed" class="bg-red-50 border-l-4 border-red-400 rounded-lg p-6 text-center">
          <p class="font-600 text-red-7 m-0">Akses e-book ini ditutup.</p>
        </div>

        <div v-else-if="needsLogin" class="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-6 text-center">
          <p class="m-0 mb-3">E-book ini hanya dapat dibaca setelah masuk.</p>
          <NuxtLink :to="`/login?redir=${encodeURIComponent(route.fullPath)}`"
            class="btn bg-unpad text-white px-4 py-2 no-underline">
            Masuk untuk membaca
          </NuxtLink>
        </div>

        <template v-else-if="drivePreviewUrl">
          <div class="flex items-center justify-end gap-2 mb-2">
            <button class="btn bg-gray text-white" @click="zoomOut" aria-label="Zoom Out">−</button>
            <button class="btn bg-gray text-white" @click="resetZoom" aria-label="Reset Zoom">100%</button>
            <button class="btn bg-gray text-white" @click="zoomIn" aria-label="Zoom In">+</button>
            <button class="btn bg-gray text-white" @click="toggleFit">
              {{ fitToWidth ? "Fit" : "Actual" }}
            </button>
            <button class="btn bg-unpad text-white" @click="toggleFullscreen">Fullscreen</button>
          </div>
          <div ref="containerRef" class="reader-area bg-gray-50 rounded-lg shadow-lg overflow-hidden mx-auto"
            style="max-width: 1200px">
            <div class="iframe-wrapper w-full h-[80vh] bg-black flex items-center justify-center"
              :style="{ transform: fitToWidth ? 'none' : `scale(${zoom})` }">
              <iframe :src="drivePreviewUrl" class="w-full h-full min-h-[60vh]" style="border: 0"
                referrerpolicy="no-referrer" />
            </div>
          </div>
        </template>

        <div v-else class="bg-gray-50 rounded-lg p-6 text-center text-gray-600">
          Berkas e-book belum tersedia.
        </div>

        <!-- External source link -->
        <div v-if="kandagaItem?.url_source"
          class="mt-6 px-4 py-8 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg text-center">
          <p class="my-4">
            Untuk bisa membaca e-book ini secara lengkap, silakan klik tautan
            berikut:
          </p>
          <a :href="kandagaItem.url_source" target="_blank" rel="noopener"
            class="btn bg-blue-600 text-white px-4 py-2 no-underline">
            Baca E-Book
          </a>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.btn {
  --at-apply: rounded px-3 py-1 text-sm;
}

.min-w-40 {
  min-width: 10rem;
}

.reader-area {
  --at-apply: rounded-lg;
}

.iframe-wrapper {
  --at-apply: overflow-hidden bg-black;
  transition: transform 240ms ease-in-out;
  transform-origin: top center;
}

@media (max-width: 640px) {
  .iframe-wrapper {
    height: 70vh;
  }
}
</style>
