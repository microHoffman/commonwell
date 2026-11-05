<script setup lang="ts">
import { chainLabel, sharedValueUnit, type Community } from '@yield-forward/core'

const props = defineProps<{ community: Community }>()
const totals = useVaultTotals(() => props.community.vaults)
// Yield already paid out plus what's waiting, like the community page's circle.
const generated = computed(() => (totals.data.value?.donated ?? 0n) + (totals.data.value?.status === 'ready' ? totals.data.value.ready : 0n))
const { isCurator } = useRoles(() => props.community)
const reviewOpen = ref(false)
const multichain = useMultichain()

// Totals add up every vault, so they need one shared unit; vaults valued in different units show a dash.
const unit = computed(() => sharedValueUnit(props.community.vaults.map((v) => v.link.kind)))
const staked = computed(() => props.community.vaults.reduce((sum, v) => sum + (v.state?.depositorValue ?? 0n), 0n))
const networks = computed(() => [...new Set(props.community.vaults.map((v) => chainLabel(v.chainId)))].join(' · '))
</script>

<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-default bg-default transition-[border-color,box-shadow] duration-200 hover:border-accented hover:shadow-[0_14px_32px_-22px_rgb(31_77_58/0.55)]"
  >
    <div class="relative h-20">
      <CommunityBand :seed="community.id + community.profile.name" />
      <!-- The card itself is the link; this round button in the band is the visible cue that it opens. -->
      <span
        class="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-forest-800 shadow-[0_4px_12px_-6px_rgb(0_0_0/0.45)] transition-colors duration-200 group-hover:bg-forest-800 group-hover:text-white"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-arrow-up-right" class="size-4.5 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
      </span>
    </div>
    <div class="flex flex-1 flex-col px-6 pb-5">
      <div class="flex items-end gap-3">
        <CommunityAvatar :profile="community.profile" class="relative -mt-7 size-14 shrink-0 text-lg ring-4 ring-(--ui-bg)" />
        <UBadge v-if="!community.reviewed" label="Unreviewed" color="warning" variant="subtle" size="sm" class="mb-0.5 rounded-full" />
      </div>
      <h3 class="mt-3 min-w-0 truncate text-xl font-semibold tracking-tight text-highlighted">
        <!-- The whole card is the link; the stretched pseudo-element keeps the review button below clickable. -->
        <NuxtLink :to="communityPath(community)" class="after:absolute after:inset-0 focus-visible:outline-none group-has-[a:focus-visible]:underline">
          {{ community.profile.name }}
        </NuxtLink>
      </h3>
      <p class="mt-1.5 mb-5 line-clamp-2 text-[0.9375rem] text-muted">{{ community.profile.description }}</p>
      <!-- Two figures: what's kept here and everything it has generated for the community (paid out plus waiting). -->
      <dl class="mt-auto grid grid-cols-2 gap-3 border-t border-default pt-4 text-[0.9375rem]">
        <div>
          <dt class="text-xs text-muted">Deposited</dt>
          <dd class="font-semibold text-highlighted"><TokenAmount v-if="unit" :value="staked" :unit="unit" approx /><template v-else>—</template></dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Generated</dt>
          <dd class="font-semibold text-highlighted">
            <TokenAmount v-if="unit" :value="generated" :unit="unit" approx /><template v-else>—</template>
          </dd>
        </div>
      </dl>
      <p v-if="multichain" class="mt-3 flex items-center gap-1.5 text-sm text-muted">
        <UIcon name="i-lucide-network" class="size-3.5 shrink-0" /> {{ networks }}
      </p>
      <div v-if="isCurator && !community.reviewed" class="relative mt-3">
        <UButton label="Review" size="sm" color="neutral" variant="soft" class="rounded-full" @click="reviewOpen = true" />
        <ReviewDialog v-model:open="reviewOpen" :community="community" />
      </div>
    </div>
  </article>
</template>
