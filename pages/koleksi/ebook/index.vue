<script setup>
import { onMounted, ref, watch } from "vue";
const { t } = useI18n();
const { getItems } = useDirectusItems();
const { cariFakultasAbbrevation } = daftarNamaFakultasUnpad();

// Pustaka (external digital collections) origin
const pustakaOrigin = usePustakaOrigin();

// UI state
const perPage = 12; // rows per source per page (pustaka API max 100)
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);
const ebooks = ref([]);
const loading = ref(false);
const errorMsg = ref("");

// Filters
const sourceFilter = ref("all"); // all | kandaga | pustaka
const fakultasFilter = ref("");
const searchKeyword = ref("");
const fakultasList = ref([]);

// Thumbnail for Directus-hosted e-books (Drive link or uploaded asset)
const directusThumbnail = (item) => {
  if (item?.thumbnail) return directusImageUrl(item.thumbnail);
  const driveId = item?.link_url?.split("/").at(5);
  return driveId
    ? `https://lh3.googleusercontent.com/d/${driveId}=w600-h600`
    : "/images/default_cover.png";
};

// --- Source 1: Directus "koleksi_ebook" (Kandaga-hosted e-books) ---
const fetchKandagaEbooks = async () => {
  const filter = { status: "published" };
  const selectedUnit = fakultasList.value.find(
    (u) => String(u.id) === String(fakultasFilter.value),
  );
  if (selectedUnit) {
    // Kandaga e-books store the faculty as a lowercase code (e.g. "fib");
    // accept the full name too for legacy rows.
    const codes = [selectedUnit.abbr, selectedUnit.name]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());
    filter.fakultas = { _in: codes };
  }

  const res = await getItems({
    collection: "koleksi_ebook",
    params: {
      limit: perPage,
      offset: (currentPage.value - 1) * perPage,
      sort: "-date_created",
      filter,
      ...(searchKeyword.value ? { search: searchKeyword.value } : {}),
      meta: "filter_count",
    },
  });

  const rows = Array.isArray(res) ? res : res?.data ?? [];
  const total = res?.meta?.filter_count ?? rows.length;

  return {
    total,
    items: rows.map((item) => ({
      key: `kandaga:${item.id}`,
      source: "kandaga",
      sourceLabel: "Kandaga",
      id: item.id,
      title: item.judul ?? "Tanpa judul",
      creator: null,
      unit: cariFakultasAbbrevation(item.fakultas) || item.fakultas || null,
      typeLabel: null,
      thumbnail: directusThumbnail(item),
      accessLevel: item.access_type === "login" ? "limited" : "public",
      files: item.link_url ? 1 : 0,
      collectionUrl: null, // opened on the internal reader page
      detailPath: `/koleksi/ebook/${item.id}`,
    })),
  };
};

// --- Source 2: Pustaka digital collections (external e-books) ---
const fetchPustakaEbooks = async () => {
  const res = await $fetch("/api/v1/digital-collections", {
    query: {
      search: searchKeyword.value || undefined,
      unit_id: fakultasFilter.value || undefined,
      file_type: "document",
      page: currentPage.value,
      limit: perPage,
    },
  });

  const rows = res?.data ?? [];
  return {
    total: res?.pagination?.total_count ?? 0,
    pages: res?.pagination?.total_pages ?? 1,
    items: rows.map((item) => ({
      key: `pustaka:${item.id}`,
      source: "pustaka",
      sourceLabel: "Pustaka",
      id: item.id,
      title: item.title ?? "Tanpa judul",
      creator: item.creator?.creator_name ?? null,
      unit: item.unit?.name ?? null,
      typeLabel: item.type?.label ?? null,
      thumbnail: item.thumbnail || "/images/default_cover.png",
      accessLevel: item.access_level,
      files: item.attachments_count ?? 0,
      // The collection page, never a raw file URL.
      collectionUrl: item.collection_url
        ? pustakaOrigin + item.collection_url
        : null,
      detailPath: `/koleksi/ebook/${item.id}`,
    })),
  };
};

const fetchEbooks = async () => {
  loading.value = true;
  errorMsg.value = "";
  try {
    const wantKandaga = sourceFilter.value !== "pustaka";
    const wantPustaka = sourceFilter.value !== "kandaga";

    const [kandaga, pustaka] = await Promise.allSettled([
      wantKandaga ? fetchKandagaEbooks() : Promise.resolve(null),
      wantPustaka ? fetchPustakaEbooks() : Promise.resolve(null),
    ]);

    const kandagaData = kandaga.status === "fulfilled" ? kandaga.value : null;
    const pustakaData = pustaka.status === "fulfilled" ? pustaka.value : null;

    if (kandaga.status === "rejected" && pustaka.status === "rejected") {
      throw new Error("both sources failed");
    }

    const merged = [...(kandagaData?.items ?? []), ...(pustakaData?.items ?? [])];
    // Stable order across sources so pagination doesn't jump between fetches
    merged.sort((a, b) => String(a.title).localeCompare(String(b.title), "id"));

    ebooks.value = merged;
    totalCount.value = (kandagaData?.total ?? 0) + (pustakaData?.total ?? 0);

    const kandagaPages = Math.ceil((kandagaData?.total ?? 0) / perPage) || 1;
    const pustakaPages = pustakaData?.pages ?? 1;
    totalPages.value = Math.max(kandagaPages, pustakaPages, 1);
  } catch (error) {
    ebooks.value = [];
    totalCount.value = 0;
    totalPages.value = 1;
    errorMsg.value = "Gagal memuat koleksi e-book. Silakan coba lagi.";
  } finally {
    loading.value = false;
  }
};

// Fakultas dropdown options come from GET /api/v1/units (display node.name)
const fetchFakultasList = async () => {
  try {
    const res = await $fetch("/api/v1/units");
    const nodes = Array.isArray(res) ? res : res?.data ?? [];
    const flatten = (list) =>
      (list ?? []).flatMap((n) => [n, ...flatten(n?.children)]);
    fakultasList.value = flatten(nodes);
  } catch (error) {
    fakultasList.value = [];
  }
};

// Debounced search: reset to page 1 when the keyword settles
let searchDebounce;
watch(searchKeyword, () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentPage.value = 1;
    fetchEbooks();
  }, 500);
});

const applyFilter = async () => {
  currentPage.value = 1;
  await fetchEbooks();
};

const resetFilter = async () => {
  sourceFilter.value = "all";
  fakultasFilter.value = "";
  searchKeyword.value = "";
  currentPage.value = 1;
  await fetchEbooks();
};

const goPage = async (target) => {
  if (target < 1 || target > totalPages.value || target === currentPage.value)
    return;
  currentPage.value = target;
  await fetchEbooks();
  scrollToTop();
};

const scrollToTop = () => {
  try {
    document.querySelector("section")?.scrollIntoView({ behavior: "smooth" });
  } catch (e) { }
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

onMounted(async () => {
  await fetchFakultasList();
  await fetchEbooks();
});
</script>

<template>
  <section class="max-w-7xl ma py-6 px-2 pb-28 md:pb-8">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold">{{ t("ebookPageListTitle") }}</h1>
      <p class="text-sm text-gray-500">
        {{ t("ebookPageListDescription") }}
      </p>
      <p class="text-xs text-gray-500 mt-3 mb-0 flex items-center gap-1.5">
        <span class="i-mdi-information-outline w-4 h-4 shrink-0" />
        E-book Pustaka dibaca melalui e-reader digital Pustaka (login ID PAuS
        diperlukan); e-book Kandaga dibuka langsung di halaman baca.
      </p>
    </div>

    <!-- Filter/Search area -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="md:col-span-2 flex gap-3">
        <div class="relative flex-1">
          <span
            class="i-mdi-magnify absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-4 pointer-events-none" />
          <input v-model="searchKeyword" type="search"
            placeholder="Cari judul, penulis, atau kata kunci..."
            class="input-area w-full pl-9" />
        </div>
        <button class="btn bg-gray-100 text-gray-7 hover:bg-gray-200 transition-colors" @click="resetFilter">
          Reset
        </button>
      </div>

      <div>
        <label class="text-sm">Sumber</label>
        <select v-model="sourceFilter" class="input-area w-full" @change="applyFilter">
          <option value="all">Semua Sumber</option>
          <option value="kandaga">E-Book Kandaga</option>
          <option value="pustaka">E-Book Pustaka</option>
        </select>
      </div>

      <div>
        <label class="text-sm">Fakultas</label>
        <select v-model="fakultasFilter" class="input-area w-full" @change="applyFilter">
          <option value="">Semua Fakultas</option>
          <option v-for="f in fakultasList" :key="f.id" :value="f.id">
            {{ f.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
      <div v-for="n in 8" :key="n"
        class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div class="w-full animate-pulse bg-gray-100" style="aspect-ratio: 210 / 297" />
        <div class="space-y-2 p-4">
          <div class="h-3.5 w-4/5 animate-pulse rounded bg-gray-100" />
          <div class="h-3 w-3/5 animate-pulse rounded bg-gray-100" />
          <div class="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </div>

    <div v-else-if="errorMsg" class="py-16 text-center">
      <span class="i-mdi-cloud-alert-outline mx-auto mb-3 block w-12 h-12 text-red-4" />
      <p class="text-red-500">{{ errorMsg }}</p>
      <button class="btn mt-4 bg-unpad text-gray-950" @click="fetchEbooks">
        Coba lagi
      </button>
    </div>

    <div v-else-if="ebooks.length === 0" class="py-16 text-center">
      <span class="i-mdi-book-search-outline mx-auto mb-3 block w-14 h-14 text-gray-3" />
      <p class="text-gray-500 mb-0">E-book tidak ditemukan.</p>
      <p class="text-xs text-gray-4 mt-1">
        Coba ubah kata kunci atau filter fakultas.
      </p>
    </div>

    <!-- Cards -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
      <article v-for="item in ebooks" :key="item.key"
        class="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-unpad/40 hover:shadow-xl">

        <!-- Cover (A4 aspect ratio 210:297) -->
        <NuxtLink :to="item.detailPath" class="relative block overflow-hidden bg-gray-100">
          <div class="relative w-full overflow-hidden bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200"
            style="aspect-ratio: 210 / 297">
            <!-- Fallback layer: visible whenever the cover is missing or fails to load -->
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-4">
              <span class="i-mdi-book-open-variant w-10 h-10" />
              <span class="text-[10px] font-700 uppercase tracking-[0.18em]">E-Book</span>
            </div>
            <img :src="item.thumbnail" alt="" loading="lazy" decoding="async"
              referrerpolicy="no-referrer" @error="onCoverError" @load="onCoverLoad"
              class="relative h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-500 group-hover:scale-105" />
          </div>

          <!-- legibility gradient -->
          <div
            class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/5" />

          <!-- source chip -->
          <span
            class="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-700 uppercase tracking-wide shadow-sm backdrop-blur-sm"
            :class="item.source === 'pustaka'
              ? 'bg-unpad/95 text-gray-950'
              : 'bg-gray-900/85 text-white'">
            <span
              :class="item.source === 'pustaka' ? 'i-mdi-library-shelves' : 'i-mdi-bookshelf'"
              class="w-3 h-3" />
            {{ item.sourceLabel }}
          </span>

          <!-- access chip -->
          <span v-if="item.accessLevel && item.accessLevel !== 'public'"
            class="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-red-600/95 px-2 py-0.5 text-[10px] font-700 uppercase tracking-wide text-white shadow-sm">
            <span class="i-mdi-lock w-3 h-3" />
            Terbatas
          </span>

          <!-- footer on cover -->
          <div class="absolute inset-x-0 bottom-0 flex items-center justify-between px-2.5 pb-2">
            <span class="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-600 text-white backdrop-blur-sm">
              <span class="i-mdi-file-pdf-box w-3 h-3" />
              PDF
            </span>
            <span v-if="item.files > 0"
              class="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-600 text-white backdrop-blur-sm">
              <span class="i-mdi-paperclip w-3 h-3" />
              {{ item.files }}
            </span>
          </div>
        </NuxtLink>

        <!-- Body -->
        <div class="flex flex-1 flex-col gap-2.5 p-3.5">
          <NuxtLink :to="item.detailPath" class="no-underline">
            <h3 class="line-clamp-2 text-[15px] font-700 leading-snug text-gray-8 transition-colors group-hover:text-unpad"
              :title="item.title">
              {{ item.title }}
            </h3>
          </NuxtLink>

          <dl class="mt-auto space-y-1.5 text-[12px] leading-tight">
            <div v-if="item.creator" class="flex items-start gap-1.5">
              <span class="i-mdi-account-edit-outline mt-0.5 w-3.5 h-3.5 shrink-0 text-gray-4" />
              <dt class="shrink-0 text-gray-4">Pencipta</dt>
              <dd class="m-0 min-w-0 flex-1 truncate text-gray-7" :title="item.creator">
                {{ item.creator }}
              </dd>
            </div>

            <div v-if="item.unit" class="flex items-start gap-1.5">
              <span class="i-mdi-office-building-outline mt-0.5 w-3.5 h-3.5 shrink-0 text-gray-4" />
              <dt class="shrink-0 text-gray-4">Unit</dt>
              <dd class="m-0 min-w-0 flex-1 truncate text-gray-7" :title="item.unit">
                {{ item.unit }}
              </dd>
            </div>

            <div v-if="item.typeLabel" class="flex items-start gap-1.5">
              <span class="i-mdi-tag-outline mt-0.5 w-3.5 h-3.5 shrink-0 text-gray-4" />
              <dt class="shrink-0 text-gray-4">Jenis</dt>
              <dd class="m-0 min-w-0 flex-1 truncate text-gray-7" :title="item.typeLabel">
                {{ item.typeLabel }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Action -->
        <div class="px-3.5 pb-3.5">
          <!-- Pustaka: opens the collection page in a new tab -->
          <a v-if="item.source === 'pustaka' && item.collectionUrl" :href="item.collectionUrl" target="_blank"
            rel="noopener noreferrer"
            class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-unpad px-3 py-2 text-sm font-700 text-gray-950 no-underline shadow-sm transition-all hover:brightness-95 hover:shadow-md">
            <span class="i-mdi-book-open-page-variant-outline w-4 h-4" />
            Baca
            <span class="i-mdi-open-in-new w-3.5 h-3.5 opacity-70" />
          </a>

          <!-- Kandaga: opens the internal reader page -->
          <NuxtLink v-else-if="item.source === 'kandaga'" :to="item.detailPath"
            class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-unpad px-3 py-2 text-sm font-700 text-gray-950 no-underline shadow-sm transition-all hover:brightness-95 hover:shadow-md">
            <span class="i-mdi-book-open-page-variant-outline w-4 h-4" />
            Baca
            <span class="i-mdi-arrow-right w-3.5 h-3.5 opacity-70" />
          </NuxtLink>

          <!-- Pustaka record without a collection page -->
          <NuxtLink v-else :to="item.detailPath"
            class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-600 text-gray-7 no-underline transition-colors hover:bg-gray-50">
            <span class="i-mdi-information-outline w-4 h-4" />
            Detail
          </NuxtLink>
        </div>
      </article>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && ebooks.length > 0"
      class="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <button
        class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-600 text-gray-7 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">
        <span class="i-mdi-chevron-left w-4 h-4" />
        Sebelumnya
      </button>

      <p class="m-0 text-sm text-gray-6">
        Halaman <span class="font-700 text-gray-8">{{ currentPage }}</span>
        dari {{ totalPages || 1 }}
      </p>

      <button
        class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-600 text-gray-7 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">
        Selanjutnya
        <span class="i-mdi-chevron-right w-4 h-4" />
      </button>
    </div>

    <p v-if="totalCount && !loading" class="mt-3 text-center text-sm text-gray-500">
      {{ totalCount }} e-book ditemukan
    </p>
  </section>
</template>

<style scoped>
.input-area {
  --at-apply: input-area px-3 py-2 rounded-xl border border-gray-200 text-sm;
}

.btn {
  --at-apply: rounded-xl px-4 py-2 text-sm;
}

.navigation-area {
  --at-apply: flex items-center justify-center gap-3 w-full mt-8;
}
</style>
