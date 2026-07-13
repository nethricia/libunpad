<script setup>
import { ref } from "vue";

const { getItemById } = useDirectusItems();
const fakultas = daftarNamaFakultasUnpad();
const { cariFakultasAbbrevation } = fakultas;
const route = useRoute();
const suratSection = ref(null);

const getDataSurat = await getItemById({
    collection: "pengajuan_pemeriksaan_turnitin",
    id: route.params.nomor,
});

const date = new Date();

const downloadSurat = () => {
    window.print();
};

definePageMeta({
    layout: "surat",
});

useHead({
    title: `Surat Keterangan Hasil Pemeriksaan Turnitin ${getDataSurat.nama_lengkap}`,
});
</script>

<template>
    <section>
        <div
            class="flex flex-col items-center my-2 noPrint"
            v-show="
                getDataSurat?.berkas_hasil_pemeriksaan?.length > 0 &&
                getDataSurat?.status_pengajuan === 'selesai'
            "
        >
            <button
                type="button"
                class="btn bg-blue text-white"
                @click="downloadSurat"
            >
                Print / Simpan
            </button>
            <p class="italic text-center mt-4 text-sm">
                Surat ini bisa disimpan atau diprint langsung melalui perangkat
                Komputer / Laptop
            </p>
        </div>
        <article
            ref="suratSection"
            v-if="
                getDataSurat?.berkas_hasil_pemeriksaan?.length > 0 &&
                getDataSurat?.status_pengajuan === 'selesai'
            "
        >
            <div class="flex items-center justify-evenly">
                <NuxtImg
                    src="images/lambang-unpad.png"
                    class="w-24 h-24"
                ></NuxtImg>
                <div class="text-center text-dark">
                    <h6>KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI</h6>
                    <h6>UNIVERSITAS PADJADJARAN</h6>
                    <h6>KANTOR PENGELOLAAN PERPUSTAKAAN</h6>
                    <p>Jl. Raya Bandung - Sumedang Km. 21 Jatinangor 45363</p>
                    <p>
                        Telp : 022-8428806 , E-mail : perpustakaan@unpad.ac.id
                    </p>
                </div>
            </div>
            <hr class="border border-dark my-2" />
            <div class="text-center my-2">
                <h6 class="font-bold underline">
                    SURAT KETERANGAN HASIL PEMERIKSAAN TURNITIN
                </h6>
            </div>
            <div>
                <p>
                    Perpustakaan Pusat Universitas Padjadjaran, dengan ini
                    menerangkan bahwa :
                </p>
                <div class="flex flex-col pl-6">
                    <div class="grid grid-cols-4">
                        <p>Nama</p>
                        <p class="col-span-3">
                            : {{ getDataSurat.nama_lengkap }}
                        </p>
                    </div>
                    <div class="grid grid-cols-4">
                        <p>NPM / NIP</p>
                        <p class="col-span-3">: {{ getDataSurat.nomor }}</p>
                    </div>
                    <div class="grid grid-cols-4">
                        <p>Fakultas</p>
                        <p class="col-span-3">
                            :
                            {{
                                cariFakultasAbbrevation(
                                    getDataSurat.nama_fakultas,
                                    true,
                                )
                            }}
                        </p>
                    </div>
                    <div class="grid grid-cols-4">
                        <p>Jurusan / Prog. Studi</p>
                        <p class="col-span-3">
                            : {{ getDataSurat.nama_prodi }}
                        </p>
                    </div>
                    <div class="grid grid-cols-4">
                        <p>Judul Karya Tulis</p>
                        <p class="col-span-3">
                            : {{ getDataSurat.judul_karya_tulis }}
                        </p>
                    </div>
                    <div class="grid grid-cols-4">
                        <p>Pemeriksa</p>
                        <p class="col-span-3">: Chrisna Adhi Pranoto</p>
                    </div>
                    <div class="grid grid-cols-4">
                        <p>Tanggal Diperiksa</p>
                        <p class="col-span-3">
                            : {{ bebasPustakaDate(getDataSurat.date_updated) }}
                        </p>
                    </div>
                </div>
                <div class="my-2">
                    <p>
                        Telah dilakukan pemeriksaan karya tulis tersebut di atas
                        menggunakan aplikasi Turnitin, dengan hasil persentase
                        kemiripan (similarity)
                        <span
                            v-if="getDataSurat.similarity_number"
                            class="font-bold"
                            >sebesar {{ getDataSurat.similarity_number }}</span
                        >
                        <span v-else
                            >sebagaimana terlampir pada hasil pemeriksaan</span
                        >.
                    </p>
                    <p class="mt-5">
                        Demikian surat keterangan ini dibuat untuk digunakan
                        sebagaimana mestinya.
                    </p>
                </div>
                <div class="flex flex-col items-end my-3">
                    <div>
                        <p>
                            Jatinangor,
                            {{ bebasPustakaDate(getDataSurat.date_updated) }}
                        </p>
                        <p>a.n. Kepala Kantor Perpustakaan Unpad</p>
                        <NuxtImg
                            src="images/ttd/cap_chrisna.png"
                            class="w-25 my-1"
                        />
                        <p>Chrisna Adhi Pranoto</p>
                        <p>NIP 199901022022023001</p>
                    </div>
                </div>

                <div class="text-3 text-gray italic">
                    <p>Surat Generated ID : {{ getDataSurat.id }}</p>
                    <p>by Kandaga System</p>
                    <p class="mt-2 not-italic">
                        Untuk memverifikasi keaslian surat ini, silakan periksa
                        pada
                        <NuxtLink
                            to="https://kandaga.unpad.ac.id/pengajuan/verify"
                            class="underline font-semibold"
                            >https://kandaga.unpad.ac.id/pengajuan/verify</NuxtLink
                        >
                        dengan menyertakan Surat Generated ID di atas.
                    </p>
                </div>
            </div>
        </article>
        <article class="text-center" v-else>
            <h3 class="text-red">Data Belum Sesuai!</h3>
            <p>Silahkan hubungi Petugas Pemeriksaan Turnitin:</p>
            <p>
                No. HP / Whatsapp:
                <a href="https://wa.me/6282315798979">082315798979</a>
            </p>
            <p>
                E-mail:
                <a href="mailto:perpustakaan@unpad.ac.id"
                    >perpustakaan@unpad.ac.id</a
                >
            </p>
        </article>
    </section>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Open+Sans&display=swap");

* {
    font-family: "Open Sans";
}

section {
    --at-apply: max-w-7xl ma;
}

article {
    --at-apply: max-w-3xl ma border-none p-5 my-5;
}

h6 {
    --at-apply: font-bold;
}
</style>
