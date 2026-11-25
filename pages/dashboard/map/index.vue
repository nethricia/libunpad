<script setup>
definePageMeta({
  layout: "dashboard",
  middleware: ["directus-auth"],
});
</script>

<template>
  <section>
    <h1>Mapping Pekerjaan Pegawai Kandaga</h1>
    <DashboardMapDivision />
  </section>
</template>

<style scoped>
h1 {
  --at-apply: text-4xl mb-5 text-center;
}
</style>
