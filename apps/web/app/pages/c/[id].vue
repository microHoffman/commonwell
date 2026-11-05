<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))
const { community } = useCommunity(id)

// Reviewed communities live at their short name.
watchEffect(() => {
  const slug = community.value?.slug
  if (slug) navigateTo({ path: `/${slug}`, query: route.query }, { replace: true })
})
</script>

<template>
  <CommunityPage :id-or-slug="id" />
</template>
