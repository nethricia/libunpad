<script setup>
const { getItemById } = useDirectusItems();
const fakultas = daftarNamaFakultasUnpad();
const { cariFakultasAbbrevation } = fakultas;

useHead({
  title: "Verifikasi Surat - Kandaga Unpad",
});

definePageMeta({
  // halaman ini publik, tanpa middleware autentikasi
});

const suratId = ref("");
const verifyStatus = ref("idle"); // idle | checking | found | notfound
const result = ref(null); // { jenis, data }

const verifySurat = async () => {
  const id = suratId.value.trim();
  if (!id || verifyStatus.value === "checking") return;

  verifyStatus.value = "checking";
  result.value = null;

  const collections = [
    {
      collection: "pengajuan_surat_bebas_pustaka",
      jenis: "bebas-pustaka",
    },
    {
      collection: "pengajuan_pemeriksaan_turnitin",
      jenis: "pemeriksaan-turnitin",
    },
  ];

  for (const target of collections) {
    try {
      const data = await getItemById({
        collection: target.collection,
        id,
      });
      if (data?.id) {
        result.value = { jenis: target.jenis, data };
        verifyStatus.value = "found";
        return;
      }
    } catch (e) {
      // id tidak ada di koleksi ini, lanjut ke koleksi berikutnya
    }
  }

  verifyStatus.value = "notfound";
};

const jenisLabel = (jenis) => {
  switch (jenis) {
    case "bebas-pustaka":
      return "Surat Bebas Pustaka";
    case "pemeriksaan-turnitin":
      return "Surat Keterangan Hasil Pemeriksaan Turnitin";
    default:
      return "Surat";
  }
};

const isSah = computed(() => {
  if (!result.value) return false;
  return result.value.data?.status_pengajuan === "selesai";
});

const resetVerify = () => {
  suratId.value = "";
  result.value = null;
  verifyStatus.value = "idle";
};
</script>

<template>
  <main class="min-h-screen bg-gray-50">
    <!-- Header Banner -->
    <div class="bg-gradient-to-br from-unpad to-kandaga">
      <div class="max-w-3xl ma px-4 py-8">
        <div class="flex items-center gap-3 mb-1">
          <div
            class="i-mdi-shield-check-outline w-7 h-7 text-white/80 shrink-0"
          />
          <h1 class="text-white text-xl sm:text-2xl font-700 m-0">
            Verifikasi Surat
          </h1>
        </div>
        <p class="text-white/70 text-sm mt-2">
          Periksa keaslian Surat Bebas Pustaka atau Surat Keterangan Hasil
          Pemeriksaan Turnitin yang diterbitkan oleh Perpustakaan Pusat
          Universitas Padjadjaran.
        </p>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-3xl ma px-4 py-6 flex flex-col gap-4">
      <!-- Info -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-information-outline w-5 h-5 text-unpad shrink-0" />
          <h2>Cara Verifikasi</h2>
        </div>
        <div class="p-5 sm:p-6 flex flex-col gap-3">
          <div class="info-box bg-gray-50 border-gray-2">
            <div
              class="i-mdi-fingerprint w-4 h-4 shrink-0 text-gray-5 mt-0.5"
            />
            <p class="text-sm text-gray-6">
              Salin
              <span class="font-semibold">Surat Generated ID</span> yang
              tercantum pada bagian bawah surat, lalu tempel pada kolom di bawah
              ini.
            </p>
          </div>
        </div>
      </div>

      <!-- Verify form -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-magnify w-5 h-5 text-unpad shrink-0" />
          <h2>Masukkan ID Surat</h2>
        </div>
        <form @submit.prevent="verifySurat" class="p-5 sm:p-6">
          <div class="flex flex-col gap-1">
            <label for="suratId" class="text-sm font-600 text-gray-7"
              >Surat Generated ID <span class="text-red-6">*</span></label
            >
            <input
              type="text"
              id="suratId"
              v-model="suratId"
              placeholder="Contoh: 00000000-0000-0000-0000-000000000000"
              class="w-full bg-white border border-gray-2 rounded-xl p-2.5 text-sm text-gray-8 transition-colors-200"
            />
            <p class="text-xs text-gray-4 italic mt-1">
              ID dapat ditemukan pada bagian paling bawah surat.
            </p>
          </div>

          <div class="flex flex-wrap gap-2 mt-4">
            <button
              type="submit"
              class="btn bg-unpad text-white py-2 px-6 inline-flex items-center gap-2 transition-all-200 disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="!suratId.trim() || verifyStatus === 'checking'"
            >
              <div class="i-mdi-shield-check-outline w-4 h-4" />
              <span v-if="verifyStatus === 'checking'">Memeriksa...</span>
              <span v-else>Verifikasi Surat</span>
            </button>
            <button
              v-if="verifyStatus !== 'idle'"
              type="button"
              class="btn bg-white border border-gray-2 text-gray-6 py-2 px-5 inline-flex items-center gap-2 transition-all-200"
              @click="resetVerify"
            >
              <div class="i-mdi-close w-4 h-4" />
              Reset
            </button>
          </div>
        </form>
      </div>

      <!-- Result -->
      <div v-if="verifyStatus === 'found' && result" class="section-card">
        <div
          class="section-card-header"
          :class="isSah ? '!bg-green-50 !border-green-2' : '!bg-yellow-50 !border-yellow-2'"
        >
          <div
            class="w-5 h-5 shrink-0"
            :class="isSah ? 'i-mdi-check-decagram text-green-6' : 'i-mdi-alert-decagram text-yellow-6'"
          />
          <h2 :class="isSah ? 'text-green-8' : 'text-yellow-8'">
            {{ isSah ? "Surat Terverifikasi (Sah)" : "Surat Ditemukan (Belum Selesai)" }}
          </h2>
        </div>
        <div class="p-5 sm:p-6 flex flex-col gap-4">
          <!-- Summary chip -->
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="text-xs bg-unpad/10 text-unpad border border-unpad/20 px-2.5 py-0.5 rounded-full font-semibold"
            >
              {{ jenisLabel(result.jenis) }}
            </span>
            <span
              class="text-xs px-2.5 py-0.5 rounded-full font-semibold"
              :class="isSah ? 'bg-green-6 text-white' : 'bg-yellow-4 text-dark'"
            >
              Status: {{ result.data.status_pengajuan }}
            </span>
          </div>

          <!-- Bebas Pustaka details -->
          <dl
            v-if="result.jenis === 'bebas-pustaka'"
            class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3"
          >
            <div class="info-row">
              <dt>Nama Lengkap</dt>
              <dd>{{ result.data.nama_lengkap ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>NPM</dt>
              <dd>{{ result.data.npm ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Fakultas</dt>
              <dd>
                {{ cariFakultasAbbrevation(result.data.nama_fakultas, true) ?? "—" }}
              </dd>
            </div>
            <div class="info-row">
              <dt>Program Studi</dt>
              <dd>{{ result.data.nama_prodi ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Nomor Surat</dt>
              <dd>{{ result.data.nomor_surat ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Tanggal Diterbitkan</dt>
              <dd>{{ bebasPustakaDate(result.data.date_updated) ?? "—" }}</dd>
            </div>
          </dl>

          <!-- Pemeriksaan Turnitin details -->
          <dl
            v-else-if="result.jenis === 'pemeriksaan-turnitin'"
            class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3"
          >
            <div class="info-row">
              <dt>Nama Lengkap</dt>
              <dd>{{ result.data.nama_lengkap ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>NPM / NIP</dt>
              <dd>{{ result.data.nomor ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Fakultas</dt>
              <dd>
                {{ cariFakultasAbbrevation(result.data.nama_fakultas, true) ?? "—" }}
              </dd>
            </div>
            <div class="info-row">
              <dt>Program Studi</dt>
              <dd>{{ result.data.nama_prodi ?? "—" }}</dd>
            </div>
            <div class="info-row sm:col-span-2">
              <dt>Judul Karya Tulis</dt>
              <dd>{{ result.data.judul_karya_tulis ?? "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Persentase Similarity</dt>
              <dd>{{ result.data.similarity_number ? normalizePercentage(result.data.similarity_number) + "%" : "—" }}</dd>
            </div>
            <div class="info-row">
              <dt>Tanggal Diperbarui</dt>
              <dd>{{ bebasPustakaDate(result.data.date_updated) ?? "—" }}</dd>
            </div>
          </dl>

          <div class="info-box bg-gray-50 border-gray-2 mt-1">
            <div class="i-mdi-fingerprint w-4 h-4 shrink-0 text-gray-5 mt-0.5" />
            <p class="text-xs text-gray-6">
              Surat Generated ID: <span class="font-mono">{{ result.data.id }}</span>
            </p>
          </div>

          <div v-if="!isSah" class="info-box bg-yellow-50 border-yellow-2">
            <div class="i-mdi-alert-outline w-4 h-4 shrink-0 text-yellow-6 mt-0.5" />
            <p class="text-xs text-gray-6">
              Catatan: Data surat ditemukan dalam sistem, namun status surat
              belum <span class="font-semibold">"Selesai"</span>. Mohon
              hubungi petugas Perpustakaan untuk konfirmasi lebih lanjut.
            </p>
          </div>
        </div>
      </div>

      <!-- Not found -->
      <div
        v-else-if="verifyStatus === 'notfound'"
        class="section-card"
      >
        <div class="section-card-header !bg-red-50 !border-red-2">
          <div class="i-mdi-close-octagon text-red-6 w-5 h-5 shrink-0" />
          <h2 class="text-red-8">Surat Tidak Ditemukan</h2>
        </div>
        <div class="p-5 sm:p-6">
          <div class="info-box bg-red-50 border-red-2">
            <div class="i-mdi-alert-outline w-4 h-4 shrink-0 text-red-5 mt-0.5" />
            <div class="text-sm text-gray-7 flex flex-col gap-1">
              <p class="font-semibold">
                ID yang dimasukkan tidak terdaftar di sistem Kandaga.
              </p>
              <p class="text-xs text-gray-5">
                Pastikan ID yang dimasukkan sesuai dengan Surat Generated ID
                pada surat. Jika ragu, silakan hubungi petugas Perpustakaan.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact -->
      <div class="section-card">
        <div class="section-card-header">
          <div class="i-mdi-phone-outline w-5 h-5 text-unpad shrink-0" />
          <h2>Butuh Bantuan?</h2>
        </div>
        <div class="p-5 sm:p-6">
          <div class="info-box bg-gray-50 border-gray-2">
            <div class="i-mdi-email-outline w-4 h-4 shrink-0 text-unpad mt-0.5" />
            <div class="text-sm text-gray-6 flex flex-col gap-0.5">
              <p>E-mail:
                <a href="mailto:perpustakaan@unpad.ac.id" class="text-unpad font-medium">perpustakaan@unpad.ac.id</a>
              </p>
            </div>
          </div>
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

.info-box {
  --at-apply: flex items-start gap-2.5 bg-gray-50 border border-gray-2 rounded-xl px-4 py-3;
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

input:focus {
  --at-apply: border-unpad outline-none;
}
</style>
