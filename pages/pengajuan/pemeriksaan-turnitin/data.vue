<script setup>
const { getItems } = useDirectusItems();

definePageMeta({
  middleware: ["directus-auth"],
});

const data = await getItems({
  collection: "pemeriksaan_turnitin",
});
</script>

<template>
  <section>
    <p>{{ data }}</p>
  </section>
</template>

<style scoped>
p {
  --at-apply: italic;
}
</style>
