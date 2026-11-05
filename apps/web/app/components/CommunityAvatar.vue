<script setup lang="ts">
import { safeHttpUrl, type Profile } from '@yield-forward/core'

const props = withDefaults(defineProps<{ profile: Profile; size?: 'md' | 'lg' | 'hero' }>(), { size: 'lg' })
const image = computed(() => safeHttpUrl(props.profile.imageURI))

// A rounded square reads as an organisation's logo rather than a person.
const sizes = {
  md: { size: 'md', root: 'rounded-[calc(var(--ui-radius)*0.75)]' },
  lg: { size: 'lg', root: 'rounded-[calc(var(--ui-radius)*0.75)]' },
  hero: { size: '3xl', root: 'size-14 rounded-[calc(var(--ui-radius)*1.25)] text-xl' },
} as const

// Without an image, the initials get a tint picked from the name, so communities don't all look alike.
// Golden-angle steps keep names that differ by one letter ("Community A", "Community B") far apart.
const hue = computed(() => Math.round(([...props.profile.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 0) * 137.5) % 360))
const tint =
  'bg-[oklch(0.94_0.04_var(--hue))] dark:bg-[oklch(0.32_0.05_var(--hue))] text-[oklch(0.45_0.09_var(--hue))] dark:text-[oklch(0.86_0.07_var(--hue))]'
</script>

<template>
  <UAvatar
    :src="image"
    :alt="profile.name"
    :size="sizes[size].size"
    :style="image ? undefined : { '--hue': hue }"
    :ui="{ root: image ? sizes[size].root : `${sizes[size].root} ${tint}`, fallback: 'text-inherit font-semibold' }"
  />
</template>
