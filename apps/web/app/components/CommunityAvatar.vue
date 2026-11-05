<script setup lang="ts">
import { safeHttpUrl, type Profile } from '@yield-forward/core'

const props = withDefaults(defineProps<{ profile: Profile; size?: 'md' | 'lg' | 'hero' }>(), { size: 'lg' })
const image = computed(() => safeHttpUrl(props.profile.imageURI))

// A rounded square reads as an organisation's logo rather than a person.
const sizes = {
  md: { size: 'md', root: 'rounded-[calc(var(--ui-radius)*0.75)]' },
  lg: { size: 'lg', root: 'rounded-[calc(var(--ui-radius)*0.75)]' },
  hero: { size: '3xl', root: 'size-16 rounded-[calc(var(--ui-radius)*1.4)] text-xl sm:size-18' },
} as const

// Without an image, the initials sit on the palette's mint; the community's band tells communities apart.
const tint = 'bg-forest-50 text-forest-800 dark:bg-forest-900 dark:text-forest-100'
</script>

<template>
  <UAvatar
    :src="image"
    :alt="profile.name"
    :size="sizes[size].size"
    :ui="{ root: image ? sizes[size].root : `${sizes[size].root} ${tint}`, fallback: 'text-inherit font-semibold' }"
  />
</template>
