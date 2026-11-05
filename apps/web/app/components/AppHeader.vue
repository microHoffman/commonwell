<script setup lang="ts">
const links = [
  { label: 'Communities', to: '/' },
  { label: 'My deposits', to: '/me' },
]

const route = useRoute()
// A hairline under the header once the page scrolls beneath it.
const scrolled = ref(false)
const onScroll = () => (scrolled.value = window.scrollY > 4)
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="sticky top-0 z-40 bg-(--yf-page) transition-shadow duration-200" :class="scrolled && 'shadow-[0_1px_0_var(--ui-border),0_8px_20px_-16px_rgb(31_77_58/0.35)]'">
    <div class="mx-auto flex max-w-[76rem] items-center gap-3 px-4 py-3.5 sm:gap-6 sm:px-6 sm:py-4">
      <NuxtLink to="/" class="flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-tight">
        <img src="/icon.svg" alt="" class="size-8">
        <span class="hidden sm:inline">Commonwell</span>
      </NuxtLink>
      <nav class="ml-auto hidden items-center gap-2 sm:flex">
        <UButton
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :label="link.label"
          color="neutral"
          :class="route.path === link.to ? 'text-highlighted' : 'text-muted hover:text-default'"
          variant="ghost"
          size="lg"
          :aria-current="route.path === link.to ? 'page' : undefined"
        />
      </nav>
      <AccountMenu class="ml-auto sm:ml-0" />
    </div>
  </header>
  <!-- On phones the links get their own row, which scrolls away so only the top row stays pinned. -->
  <nav class="flex gap-2 px-3 pb-3 sm:hidden">
    <UButton
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :label="link.label"
      color="neutral"
      :class="route.path === link.to ? 'rounded-full bg-default text-highlighted' : 'rounded-full text-muted hover:text-default'"
      variant="ghost"
      size="sm"
      :aria-current="route.path === link.to ? 'page' : undefined"
    />
  </nav>
</template>
