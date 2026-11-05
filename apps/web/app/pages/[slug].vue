<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <CommunityPage :id-or-slug="String(route.params.slug)" />
</template>
