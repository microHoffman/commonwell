<script setup lang="ts">
import { sharedValueUnit, type Community } from '@yield-forward/core'

/// A small packet for another community: its band, name, and what's deposited there.
const props = defineProps<{ community: Community }>()
const unit = computed(() => sharedValueUnit(props.community.vaults.map((v) => v.link.kind)))
const staked = computed(() => props.community.vaults.reduce((sum, v) => sum + (v.state?.depositorValue ?? 0n), 0n))
</script>

<template>
  <NuxtLink
    :to="communityPath(community)"
    class="group block overflow-hidden rounded-[1.125rem] border border-default bg-default transition-[border-color,box-shadow] duration-200 hover:border-accented hover:shadow-[0_10px_24px_-18px_rgb(31_77_58/0.6)]"
  >
    <div class="h-8">
      <CommunityBand :seed="community.id + community.profile.name" />
    </div>
    <p class="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
      <span class="min-w-0 truncate font-semibold text-highlighted">{{ community.profile.name }}</span>
      <span class="shrink-0 text-muted"><TokenAmount v-if="unit" :value="staked" :unit="unit" approx /></span>
    </p>
  </NuxtLink>
</template>
