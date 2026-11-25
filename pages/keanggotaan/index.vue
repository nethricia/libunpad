<script setup>
import { readUsers } from "@directus/sdk";

const { logout } = useDirectusAuth();
const user = useDirectusUser();
const { getItems } = useDirectusItems();
const { $directus } = useNuxtApp();
const { loggedIn: ssoLoggedIn, user: sessionUser, clear } = useUserSession();

const sessionEmail = sessionUser.value?.email;

// Never query without an owner filter — an empty filter would return every
// applicant's record.
const getBebasPustaka = sessionEmail
  ? await getItems({
      collection: "pengajuan_surat_bebas_pustaka",
      // Same owner filter as before; sorted + limited because the page only
      // renders the latest application (getBebasPustaka[0]).
      params: {
        filter: { email: sessionEmail },
        sort: "-date_created",
        limit: 1,
      },
    }).catch(() => [])
  : [];

// Room bookings are paginated: a user can accumulate many requests.
const ruanganPage = ref(1);
const ruanganPerPage = 9;
const ruanganItems = ref([]);
const ruanganTotalItems = ref(0);
const ruanganTotalPages = ref(1);

const fetchRuanganData = async () => {
  if (!sessionEmail) {
    ruanganItems.value = [];
    ruanganTotalItems.value = 0;
    ruanganTotalPages.value = 1;
    return;
  }

  const response = await getItems({
    collection: "peminjaman_ruangan",
    params: {
      filter: { email: sessionEmail },
      limit: ruanganPerPage,
      offset: (ruanganPage.value - 1) * ruanganPerPage,
      meta: "filter_count",
      sort: "-date_created",
    },
  }).catch(() => null);

  const rows = Array.isArray(response) ? response : response?.data ?? [];
  ruanganItems.value = rows;
  ruanganTotalItems.value =
    response?.meta?.filter_count ??
    (Array.isArray(response) ? response.length : 0);
  ruanganTotalPages.value = Math.max(
    1,
    Math.ceil(ruanganTotalItems.value / ruanganPerPage),
  );

  // Clamp if the current page no longer exists (e.g. after a deletion).
  if (ruanganPage.value > ruanganTotalPages.value) {
    ruanganPage.value = ruanganTotalPages.value;
    await fetchRuanganData();
  }
};

const changeRuanganPage = async (page) => {
  ruanganPage.value = Math.max(1, Math.min(page, ruanganTotalPages.value));
  await fetchRuanganData();
};

await fetchRuanganData();

const activeTab = ref("bebas-pustaka");

// Deep-link support: /keanggotaan?tab=ruangan
const route = useRoute();
const initialTab = String(route.query.tab ?? "");
if (["bebas-pustaka", "ruangan", "turnitin"].includes(initialTab)) {
  activeTab.value = initialTab;
}

const tabs = [
  { id: "bebas-pustaka", name: "Surat Bebas Pustaka", icon: "i-mdi-certificate-outline" },
  { id: "ruangan", name: "Peminjaman Ruangan", icon: "i-mdi-office-building-outline" },
  { id: "turnitin", name: "Pemeriksaan Turnitin", icon: "i-mdi-file-document-edit-outline" },
];

const petugasNameCache = ref({});
const turnitinItems = ref([]);
const turnitinPage = ref(1);
const turnitinPerPage = 6;
const turnitinTotalItems = ref(0);
const turnitinTotalPages = ref(1);

const getPetugasName = (userId) => {
  if (!userId) return "—";
  return petugasNameCache.value[userId] ?? "—";
};

const loadPetugasNames = async (items) => {
  const userIds = [...new Set(items.map((item) => item.user_updated).filter(Boolean))];

  if (!userIds.length) return;

  const usersResponse = await $directus.request(
    readUsers({
      filter: {
        id: {
          _in: userIds,
        },
      },
      fields: ["id", "first_name", "last_name"],
    }),
  );

  const users = Array.isArray(usersResponse) ? usersResponse : usersResponse?.data ?? [];

  users.forEach((userEntry) => {
    petugasNameCache.value[userEntry.id] = userEntry.first_name
      ? `${userEntry.first_name} ${userEntry.last_name || ""}`.trim()
      : "—";
  });
};

const fetchTurnitinData = async () => {
  if (!sessionEmail) {
    turnitinItems.value = [];
    return;
  }
  const response = await getItems({
    collection: "pengajuan_pemeriksaan_turnitin",
    params: {
      filter: {
        email: sessionEmail,
      },
      fields: ["*", "berkas_hasil_pemeriksaan.*"],
      limit: turnitinPerPage,
      offset: (turnitinPage.value - 1) * turnitinPerPage,
      meta: "filter_count",
      sort: "-date_created",
    },
  }).catch(() => []);

  turnitinItems.value = Array.isArray(response) ? response : response?.data ?? [];
  await loadPetugasNames(turnitinItems.value);
  turnitinTotalItems.value =
    response?.meta?.filter_count ??
    (Array.isArray(response) ? response.length : 0);
  turnitinTotalPages.value = Math.max(
    1,
    Math.ceil(turnitinTotalItems.value / turnitinPerPage),
  );

  if (turnitinPage.value > turnitinTotalPages.value) {
    turnitinPage.value = turnitinTotalPages.value;
    await fetchTurnitinData();
  }
};

await fetchTurnitinData();

const changeTurnitinPage = async (page) => {
  turnitinPage.value = Math.max(1, Math.min(page, turnitinTotalPages.value));
  await fetchTurnitinData();
};

const isPegawai = computed(() => {
  let state = null;
  try {
    switch (user?.value?.role) {
      case "BE2D46E4-CB00-4585-8E34-5B571A80A820":
        state = true;
        break;
      case "9BB62337-8EAA-44AB-A47C-F8CACEF9B8A7":
        state = true;
        break;
      default:
        state = false;
        break;
    }
  } catch (error) {
  }

  return state;
});

const bebasPustakaBanner = (value) => {
  switch (value) {
    case "pengajuan":
      return "bg-gray text-white font-semibold";
    case "proses":
      return "bg-yellow-4 text-dark font-semibold";
    case "selesai":
      return "bg-green-6 text-white font-semibold";
    case "ditolak":
      return "bg-red-6 text-white font-semibold";
    default:
      return "bg-orange-3 text-dark font-semibold";
  }
};

const onLogout = async () => {
  logout();
  setTimeout(async () => {
    await navigateTo("/login", {
      redirectCode: 401,
    });
  }, 1000);
};

useHead({
  title: "Keanggotaan Perpustakaan Pusat Unpad",
});

definePageMeta({
  middleware: ["authentication-check"],
});
</script>

<template>
  <main class="min-h-screen bg-gray-50">
    <!-- Profile Hero Banner -->
    <div class="bg-gradient-to-br from-unpad to-kandaga">
      <div class="max-w-5xl ma px-4 py-10">
        <div class="flex flex-col sm:flex-row items-center sm:items-end gap-5">
          <!-- Avatar -->
          <div class="relative shrink-0">
            <img v-if="user" :src="user.avatar
              ? `https://kandaga.unpad.ac.id/backoffice/assets/${user.avatar}.jpg`
              : 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg'
              " :alt="user?.first_name"
              class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl border-4 border-white/60 shadow-lg" />
            <NuxtImg v-else-if="ssoLoggedIn" :src="sessionUser.image"
              class="w-24 h-24 rounded-2xl border-4 border-white/60 shadow-lg object-cover" />
          </div>
          <!-- Identity -->
          <div class="text-center sm:text-left pb-1">
            <p class="text-white/70 text-sm font-medium uppercase tracking-widest mb-0.5">
              Anggota Perpustakaan
            </p>
            <h1 class="text-white text-2xl sm:text-3xl font-800 leading-tight">
              <template v-if="user">{{ user.first_name }} {{ user.last_name }}</template>
              <template v-else-if="ssoLoggedIn">{{
                sessionUser.name
                }}</template>
            </h1>
            <p class="text-white/80 text-sm mt-1">
              <template v-if="user">{{ user.email }}</template>
              <template v-else-if="ssoLoggedIn">{{
                sessionUser.email
                }}</template>
            </p>
            <span v-if="user?.title"
              class="inline-block mt-2 text-xs bg-white/20 text-white px-3 py-0.5 rounded-full font-semibold">
              {{ user.title }}
            </span>
            <!-- PAuS-specific identity chips -->
            <div v-if="ssoLoggedIn && sessionUser?.identifier" class="flex flex-wrap gap-1.5 mt-2">
              <span class="paus-chip">
                <span class="opacity-70">ID:</span> {{ sessionUser.identifier }}
              </span>
              <span v-if="sessionUser.username" class="paus-chip">
                @{{ sessionUser.username }}
              </span>
              <span v-if="sessionUser.type" class="paus-chip capitalize">
                {{ sessionUser.type }}
              </span>
              <span v-if="sessionUser.jenjang" class="paus-chip">
                {{ sessionUser.jenjang }}
              </span>
              <span v-if="sessionUser.faculty || sessionUser.unit" class="paus-chip">
                {{ sessionUser.faculty ?? sessionUser.unit }}
              </span>
              <span v-if="sessionUser.study_program" class="paus-chip">
                {{ sessionUser.study_program }}
              </span>
            </div>
          </div>
          <!-- Action buttons top-right -->
          <div class="sm:ml-auto flex flex-wrap justify-center gap-2 pb-1">
            <NuxtLink v-show="isPegawai" to="/dashboard"
              class="btn bg-white/20 hover:bg-white/30 text-white border border-white/30 text-sm py-1.5 transition-all-200">
              Dashboard
            </NuxtLink>
            <NuxtLink to="/pengajuan"
              class="btn bg-white/20 hover:bg-white/30 text-white border border-white/30 text-sm py-1.5 transition-all-200">
              Pengajuan Lain
            </NuxtLink>
            <button v-show="user" type="button"
              class="btn bg-red-5/80 hover:bg-red-6 text-white text-sm py-1.5 transition-all-200" @click="onLogout">
              Logout
            </button>
            <button v-show="!user && ssoLoggedIn" type="button"
              class="btn bg-red-5/80 hover:bg-red-6 text-white text-sm py-1.5 transition-all-200" @click="clear">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Logged-out fallback -->
    <div v-if="!user && !ssoLoggedIn" class="max-w-md ma mt-20 text-center px-4">
      <div class="bg-white rounded-2xl shadow-md p-10">
        <div class="i-mdi-account-circle-outline text-unpad w-16 h-16 ma mb-4" />
        <h2 class="text-xl font-700 mb-2">Sesi Berakhir</h2>
        <p class="text-gray-5 mb-6">
          Akun sedang keluar. Memindahkan ke halaman login...
        </p>
        <NuxtLink to="/login" class="btn bg-unpad text-white px-6 py-2">Login</NuxtLink>
      </div>
    </div>

    <!-- Main content (authenticated) -->
    <div v-else class="max-w-5xl ma px-4 py-8 flex flex-col gap-6">
      <!-- ═══ CARD: PAuS Identity (SSO users only) ═══ -->
      <div v-if="ssoLoggedIn && sessionUser?.identifier" class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-account-badge-outline section-icon" />
          <h2>Identitas Akun PAuS</h2>
          <span
            class="ml-auto text-xs bg-unpad/10 text-unpad border border-unpad/20 px-2.5 py-0.5 rounded-full font-semibold capitalize">
            {{ sessionUser.type ?? "PAuS SSO" }}
          </span>
        </div>
        <div class="p-5 sm:p-6">
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div class="info-row">
              <dt>Nama Lengkap</dt>
              <dd>{{ sessionUser.name ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Username</dt>
              <dd>{{ sessionUser.username ? "@" + sessionUser.username : "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Email</dt>
              <dd>{{ sessionUser.email ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>NIM / NIP</dt>
              <dd>{{ sessionUser.identifier ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>
                {{ sessionUser.faculty ? "Fakultas" : "Unit / Direktorat" }}
              </dt>
              <dd>{{ sessionUser.faculty ?? sessionUser.unit ?? "—" }}</dd>
            </div>
            <div v-if="sessionUser.faculty && sessionUser.unit" class="info-row">
              <dt>Unit / Direktorat</dt>
              <dd>{{ sessionUser.unit }}</dd>
            </div>
            <div v-if="sessionUser.study_program" class="info-row">
              <dt>Program Studi</dt>
              <dd>{{ sessionUser.study_program }}</dd>
            </div>
            <div v-if="sessionUser.jenjang" class="info-row">
              <dt>Jenjang</dt>
              <dd>{{ sessionUser.jenjang }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- ═══ MOBILE DROPDOWN (Mobile only) ═══ -->
      <div class="md:hidden relative w-full bg-white border border-gray-2 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-unpad/50 focus-within:border-unpad transition-all duration-200">
        <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-unpad">
          <div :class="[tabs.find(t => t.id === activeTab)?.icon, 'w-5 h-5']" />
        </div>
        <select
          v-model="activeTab"
          class="w-full bg-transparent pl-11 pr-10 py-3.5 text-sm font-semibold text-gray-8 appearance-none focus:outline-none cursor-pointer"
        >
          <option
            v-for="tab in tabs"
            :key="tab.id"
            :value="tab.id"
          >
            {{ tab.name }}
          </option>
        </select>
        <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-5">
          <div class="i-mdi-chevron-down w-5 h-5" />
        </div>
      </div>

      <!-- ═══ TABS NAVIGATION (Tablet & Desktop) ═══ -->
      <div class="tabs-container hidden md:flex items-center bg-white border border-gray-2 rounded-2xl p-1.5 shadow-sm gap-1.5 overflow-x-auto flex-nowrap w-full">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all duration-200 flex-1 shrink-0 min-w-max"
          :class="activeTab === tab.id
            ? 'bg-unpad text-white font-semibold shadow-sm'
            : 'text-gray-5 hover:text-gray-8 hover:bg-gray-50 font-medium'"
        >
          <div :class="[tab.icon, 'w-4 h-4 shrink-0']" />
          <span>{{ tab.name }}</span>
        </button>
      </div>

      <!-- ═══ CARD: Bebas Pustaka ═══ -->
      <div v-if="activeTab === 'bebas-pustaka'" class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-certificate-outline section-icon" />
          <h2>Surat Bebas Pustaka</h2>
        </div>

        <div v-if="getBebasPustaka.length > 0" class="p-5 sm:p-6 flex flex-col gap-5">
          <!-- Status badge -->
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm text-gray-5 font-medium">Status:</span>
            <span :class="bebasPustakaBanner(getBebasPustaka[0]?.status_pengajuan)"
              class="px-3 py-0.5 text-sm rounded-full">
              {{
                displayStatusPengajuanSurat(
                  getBebasPustaka[0]?.status_pengajuan,
                )
              }}
            </span>
          </div>

          <!-- Requirements -->
          <div v-if="getBebasPustaka[0]?.persyaratan?.length === 0" class="info-box">
            <div class="i-mdi-clock-outline w-4 h-4 shrink-0 mt-0.5 text-yellow-6" />
            <p class="text-sm">Kelengkapan sedang diperiksa oleh petugas.</p>
          </div>
          <div v-else class="flex flex-col gap-2">
            <p class="text-sm font-semibold text-gray-6">
              Kelengkapan Persyaratan:
            </p>
            <div class="flex flex-col gap-2">
              <div class="req-row" :class="getBebasPustaka[0].persyaratan?.includes('denda')
                ? 'req-ok'
                : 'req-fail'
                ">
                <div :class="getBebasPustaka[0].persyaratan?.includes('denda')
                  ? 'i-mdi-check-circle'
                  : 'i-mdi-close-circle'
                  " class="w-5 h-5 shrink-0" />
                <span>{{
                  getBebasPustaka[0].persyaratan?.includes("denda")
                    ? "Tidak ada denda"
                    : "Sedang diproses atau Masih ada denda yang belum dibayar"
                }}</span>
              </div>
              <div class="req-row" :class="getBebasPustaka[0].persyaratan?.includes('peminjaman')
                ? 'req-ok'
                : 'req-fail'
                ">
                <div :class="getBebasPustaka[0].persyaratan?.includes('peminjaman')
                  ? 'i-mdi-check-circle'
                  : 'i-mdi-close-circle'
                  " class="w-5 h-5 shrink-0" />
                <span>{{
                  getBebasPustaka[0].persyaratan?.includes("peminjaman")
                    ? "Tidak ada buku yang sedang dipinjam"
                    : "Sedang diproses atau Masih ada buku yang belum dikembalikan"
                }}</span>
              </div>
            </div>

            <!-- Download button -->
            <div class="mt-2">
              <NuxtLink v-if="
                getBebasPustaka[0]?.status_pengajuan === 'selesai' &&
                getBebasPustaka[0]?.persyaratan?.length > 0
              " :to="'/pengajuan/bebas-pustaka/surat/' + getBebasPustaka[0].id"
                class="btn bg-unpad text-white py-2 px-6 inline-flex items-center gap-2" target="_blank">
                <div class="i-mdi-download w-4 h-4" />
                Unduh Surat
              </NuxtLink>
              <button v-else class="btn bg-gray-2 text-gray-4 py-2 px-6 cursor-not-allowed" disabled>
                Surat belum dapat diunduh
              </button>
            </div>
          </div>

          <!-- Contact -->
          <div class="info-box mt-1">
            <div class="i-mdi-phone w-4 h-4 shrink-0 text-unpad mt-0.5" />
            <div class="text-sm flex flex-col gap-0.5">
              <p class="font-semibold text-gray-7">Kendala? Hubungi petugas:</p>
              <p>
                Pak Taufik:
                <a href="tel:085721738333" class="text-unpad font-medium">+62 857-2173-8333</a>
              </p>
            </div>
          </div>

          <!-- S2/S3 note -->
          <div class="info-box bg-yellow-50 border-yellow-2">
            <div class="i-mdi-information-outline w-4 h-4 shrink-0 text-yellow-6 mt-0.5" />
            <p class="text-xs text-gray-6 leading-relaxed">
              Mahasiswa S2/S3 yang akunnya tergabung dengan jenjang sebelumnya,
              hubungi
              <a href="mailto:chrisna.adhi@unpad.ac.id" target="_blank"
                class="text-unpad font-medium">chrisna.adhi@unpad.ac.id</a>
              atau
              <a href="https://wa.me/6281573710645" target="_blank" class="text-unpad font-medium">WhatsApp</a>
              dengan melampirkan email Unpad Anda.
            </p>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="i-mdi-file-outline w-10 h-10 text-gray-3 ma mb-3" />
          <p class="text-gray-4 italic">Belum ada pengajuan bebas pustaka.</p>
          <NuxtLink to="/pengajuan/bebas-pustaka" class="btn bg-unpad text-white mt-3 text-sm py-1.5 px-5">
            Ajukan Sekarang
          </NuxtLink>
        </div>
      </div>

      <!-- ═══ CARD: Peminjaman Ruangan ═══ -->
      <div v-if="activeTab === 'ruangan'" class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-office-building-outline section-icon" />
          <h2>Peminjaman Ruangan</h2>
        </div>

        <div v-if="ruanganItems.length > 0" class="p-5 sm:p-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div v-for="ruang in ruanganItems" :key="ruang.id"
              class="bg-gray-50 border border-gray-2 rounded-xl p-4 flex flex-col gap-2">
              <p class="font-semibold text-sm text-gray-8 leading-tight">
                {{ definePeminjamanRuangan(ruang.nama_ruangan) }}
              </p>
              <div class="flex items-center gap-1.5 text-xs text-gray-5">
                <div class="i-mdi-clock-outline w-3.5 h-3.5" />
                {{ ruang.jam_mulai_peminjaman }} —
                {{ ruang.jam_selesai_peminjaman }}
              </div>
              <span class="self-start text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize"
                :class="displayStatusPeminjamanRuangan(ruang.status_peminjaman)">
                {{ ruang.status_peminjaman }}
              </span>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="ruanganTotalPages > 1"
            class="flex flex-wrap items-center justify-center gap-2 mt-5 pt-4 border-t border-gray-2">
            <button type="button" class="btn bg-white border border-gray-2 text-gray-6 text-xs py-1.5 px-3"
              :disabled="ruanganPage <= 1" @click="changeRuanganPage(ruanganPage - 1)">
              Sebelumnya
            </button>
            <button v-for="page in ruanganTotalPages" :key="page" type="button" class="btn text-xs py-1.5 px-3"
              :class="page === ruanganPage
                ? 'bg-unpad text-white font-semibold'
                : 'bg-white border border-gray-2 text-gray-6'"
              @click="changeRuanganPage(page)">
              {{ page }}
            </button>
            <button type="button" class="btn bg-white border border-gray-2 text-gray-6 text-xs py-1.5 px-3"
              :disabled="ruanganPage >= ruanganTotalPages" @click="changeRuanganPage(ruanganPage + 1)">
              Selanjutnya
            </button>
            <p class="w-full text-center text-xs text-gray-4 mt-1 mb-0">
              Menampilkan {{ (ruanganPage - 1) * ruanganPerPage + 1 }}–{{
                Math.min(ruanganPage * ruanganPerPage, ruanganTotalItems)
              }}
              dari {{ ruanganTotalItems }} pengajuan
            </p>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="i-mdi-door-open w-10 h-10 text-gray-3 ma mb-3" />
          <p class="text-gray-4 italic">
            Belum ada pengajuan peminjaman ruangan.
          </p>
        </div>
      </div>

      <!-- ═══ CARD: Turnitin ═══ -->
      <div v-if="activeTab === 'turnitin'" class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-file-document-edit-outline section-icon" />
          <h2>Pemeriksaan Turnitin</h2>
          <NuxtLink href="/pengajuan/pemeriksaan-turnitin"
            class="ml-auto btn bg-unpad text-white text-xs py-1.5 px-4 shrink-0">
            + Ajukan Baru
          </NuxtLink>
        </div>

        <!-- Info strip -->
        <div class="px-5 sm:px-6 pt-5 flex flex-col gap-3">
          <div class="info-box bg-blue-50 border-blue-2">
            <div class="i-mdi-book-open-variant w-4 h-4 shrink-0 text-blue-5 mt-0.5" />
            <p class="text-xs text-gray-6">
              Panduan cara pengutipan tersedia di
              <a href="https://penerbitdeepublish.com/wp-content/uploads/2017/01/Pedoman-Menulis-Buku-Tanpa-Plagiarisme-oleh-Penerbit-Deepublish.pdf"
                target="_blank" class="text-blue-6 font-medium">E-Book Pedoman Menulis Tanpa Plagiarisme</a>. Pastikan
              similarity &lt; 20%.
            </p>
          </div>
          <div class="info-box bg-gray-50 border-gray-2 flex-col items-start gap-2">
            <div class="flex items-center gap-2">
              <div class="i-mdi-information-outline w-4 h-4 shrink-0 text-gray-5" />
              <p class="text-xs font-semibold text-gray-6">
                Panduan Pemeriksaan Turnitin:
              </p>
            </div>
            <ol class="text-left text-xs text-gray-6 list-decimal pl-4 flex flex-col gap-1">
              <li>Wajib melampirkan Cover dari karya tersebut</li>
              <li>
                Kata-kata atau kalimat yang diwarnai bersumber pada website yang
                ada pada daftar yang ada pada bagian akhir report (sesuai dengan
                warna dan nomornya)
              </li>
              <li>
                Kalimat-kalimat yang diwarnai sebaiknya diganti dengan kalimat
                lain atau parafrase tetapi memiliki arti yang sama.
              </li>
              <li>
                Pengutipan langsung sebaiknya menggunakan tanda "...." (penulis,
                tahun).
              </li>
              <li>
                Sebaiknya persentase selalu mengikuti arahan dari Program Studi
                atau secara umum perlu kurang dari 20%, bila lebih silahkan
                untuk memperbaikinya dan diperiksakan kembali.
              </li>
              <li>
                Untuk memperkecil similarity pada tugas akhir, surat pernyataan,
                kata pengantar, dan daftar isi sebaiknya tidak disertakan
              </li>
            </ol>
          </div>
        </div>

        <!-- Submission list -->
        <div v-if="turnitinItems.length > 0" class="p-5 sm:p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="file in turnitinItems" :key="file.id"
              class="bg-white border border-gray-2 rounded-xl p-5 flex flex-col gap-3 shadow-sm">
              <!-- Title -->
              <p class="font-semibold text-gray-8 text-sm leading-snug">
                {{ file.judul_karya_tulis ?? "—" }}
              </p>

              <!-- Status -->
              <div class="flex items-center gap-2 flex-wrap">
                <span :class="bebasPustakaBanner(file.status_pengajuan)" class="text-xs px-2.5 py-0.5 rounded-full">
                  {{ displayStatusPengajuanSurat(file.status_pengajuan) }}
                </span>
                <span v-if="file.similarity_number"
                  class="text-xs bg-blue-1 text-blue-7 border border-blue-2 px-2.5 py-0.5 rounded-full font-semibold">
                  Similarity: {{ file.similarity_number }}
                </span>
              </div>

              <!-- Meta info -->
              <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-3 text-gray-5">
                <div class="flex items-center gap-1">
                  <div class="i-mdi-calendar-outline w-3.5 h-3.5 shrink-0" />
                  <span>
                    Diajukan: <br />
                    <span class="italic font-semibold">
                      {{ convertTimeZone(file.date_created) ?? "—" }}
                    </span>
                  </span>
                </div>
                <div v-if="file.date_updated" class="flex items-center gap-1">
                  <div class="i-mdi-check-circle-outline w-3.5 h-3.5 shrink-0" />
                  <span>
                    Diperbarui: <br />
                    <span class="italic font-semibold">
                      {{ convertTimeZone(file.date_updated) ?? "—" }}
                    </span>
                  </span>
                </div>
                <div v-if="file.user_updated" class="flex items-center gap-1">
                  <div class="i-mdi-file-document-outline w-3.5 h-3.5 shrink-0" />
                  <span>Petugas:
                    <span class="italic font-semibold">
                      {{ getPetugasName(file.user_updated) ?? "-" }}
                    </span>
                  </span>
                </div>
              </div>

              <!-- Keterangan -->
              <p v-if="file.keterangan"
                class="text-xs text-gray-6 bg-gray-50 rounded-lg px-3 py-2 border border-gray-2">
                {{ file.keterangan }}
              </p>

              <!-- Download or re-submit -->
              <div class="mt-auto pt-1">
                <template v-if="
                  file.berkas_hasil_pemeriksaan?.length > 0 &&
                  file.status_pengajuan === 'selesai'
                ">
                  <NuxtLink v-for="(item, index) in file.berkas_hasil_pemeriksaan" :key="item.directus_files_id"
                    :href="`https://kandaga.unpad.ac.id/backoffice/assets/${item.directus_files_id}?download`"
                    class="btn bg-unpad text-white text-xs py-1.5 px-4 w-full text-center block mb-1.5 inline-flex items-center justify-center gap-1.5"
                    target="_blank">
                    <div class="i-mdi-download w-3.5 h-3.5" />
                    Unduh Hasil {{ index + 1 }}
                  </NuxtLink>
                  <NuxtLink :to="'/pengajuan/pemeriksaan-turnitin/' + file.id"
                    class="btn bg-white border border-unpad text-unpad text-xs py-1.5 px-4 w-full text-center block mb-1.5 inline-flex items-center justify-center gap-1.5"
                    target="_blank">
                    <div class="i-mdi-file-document-outline w-3.5 h-3.5" />
                    Surat Keterangan Pemeriksaan
                  </NuxtLink>
                </template>
                <template v-else-if="file.status_pengajuan === 'ditolak'">
                  <p class="text-xs text-gray-5 mb-2">
                    Silahkan cek keterangan penolakan di atas.
                  </p>
                  <NuxtLink href="/pengajuan/pemeriksaan-turnitin"
                    class="btn bg-unpad text-white text-xs py-1.5 px-4 inline-flex items-center gap-1.5">
                    <div class="i-mdi-refresh w-3.5 h-3.5" />
                    Ajukan Ulang
                  </NuxtLink>
                </template>
                <p v-else class="text-xs text-gray-4 italic">
                  Dokumen sedang diproses...
                </p>
              </div>
            </div>
          </div>

          <div v-if="turnitinTotalPages > 1"
            class="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-2 pt-4">
            <p class="text-xs text-gray-5">
              Menampilkan {{ turnitinItems.length }} dari
              {{ turnitinTotalItems }} pengajuan
            </p>
            <div class="flex items-center gap-2 flex-wrap justify-center">
              <button type="button"
                class="btn border border-gray-2 bg-white text-gray-6 text-xs py-1.5 px-3 disabled:opacity-50"
                :disabled="turnitinPage === 1" @click="changeTurnitinPage(turnitinPage - 1)">
                Sebelumnya
              </button>
              <button v-for="page in turnitinTotalPages" :key="page" type="button" class="btn text-xs py-1.5 px-3"
                :class="turnitinPage === page
                  ? 'bg-unpad text-white'
                  : 'bg-white border border-gray-2 text-gray-6'
                  " @click="changeTurnitinPage(page)">
                {{ page }}
              </button>
              <button type="button"
                class="btn border border-gray-2 bg-white text-gray-6 text-xs py-1.5 px-3 disabled:opacity-50"
                :disabled="turnitinPage === turnitinTotalPages" @click="changeTurnitinPage(turnitinPage + 1)">
                Berikutnya
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="i-mdi-file-plus-outline w-10 h-10 text-gray-3 ma mb-3" />
          <p class="text-gray-4 italic">
            Belum ada pengajuan pemeriksaan Turnitin.
          </p>
          <NuxtLink href="/pengajuan/pemeriksaan-turnitin" class="btn bg-unpad text-white mt-3 text-sm py-1.5 px-5">
            Ajukan Sekarang
          </NuxtLink>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.section-card {
  --at-apply: bg-white rounded-2xl shadow-sm border border-gray-2 overflow-hidden;
}

.section-card-header {
  --at-apply: flex items-center gap-3 px-5 sm: px-6 py-4 border-b border-gray-1 bg-gray-50;
}

.section-card-header h2 {
  --at-apply: text-base font-700 text-gray-8 m-0;
}

.section-icon {
  --at-apply: w-5 h-5 text-unpad shrink-0;
}

.empty-state {
  --at-apply: flex flex-col items-center py-10 px-6 text-center;
}

.info-box {
  --at-apply: flex items-start gap-2.5 bg-gray-50 border border-gray-2 rounded-xl px-4 py-3;
}

.req-row {
  --at-apply: flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-medium;
}

.req-ok {
  --at-apply: bg-green-50 text-green-7 border border-green-2;
}

.req-fail {
  --at-apply: bg-red-50 text-red-7 border border-red-2;
}

.paus-chip {
  --at-apply: text-xs bg-white/15 text-white border border-white/25 px-2.5 py-0.5 rounded-full font-medium;
}

.info-row {
  --at-apply: flex flex-col gap-0.5;
}

.info-row dt {
  --at-apply: text-xs font-600 text-gray-4 uppercase tracking-wide;
}

.info-row dd {
  --at-apply: text-sm font-500 text-gray-8 m-0;
}

.tabs-container {
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}
</style>
