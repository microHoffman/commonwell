<script setup lang="ts">
const links = [
  { label: 'Communities', to: '/' },
  { label: 'My deposits', to: '/me' },
]

const route = useRoute()
</script>

<template>
  <header class="border-b border-default">
    <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5 sm:gap-6 sm:px-6 sm:py-4.5">
      <NuxtLink to="/" class="flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-tight">
        <!-- The icon's tile is the dark page background, so outline it in dark mode. -->
        <img src="/icon.svg" alt="" class="size-8 rounded-[25%] dark:ring-1 dark:ring-default">
        <span class="hidden sm:inline">Yield Forward</span>
      </NuxtLink>
      <nav class="ml-auto hidden items-center gap-2 sm:flex">
        <UButton
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :label="link.label"
          :color="route.path === link.to ? 'primary' : 'neutral'"
          :class="route.path === link.to ? undefined : 'text-muted hover:text-default'"
          variant="ghost"
          size="lg"
        />
      </nav>
      <AccountMenu class="ml-auto sm:ml-0" />
    </div>
    <nav class="flex gap-2 px-3 pb-3 sm:hidden">
      <UButton
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :label="link.label"
        :color="route.path === link.to ? 'primary' : 'neutral'"
        :class="route.path === link.to ? undefined : 'text-muted hover:text-default'"
        variant="ghost"
        size="sm"
      />
    </nav>
  </header>
</template>
