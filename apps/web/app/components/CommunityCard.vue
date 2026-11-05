<script setup lang="ts">
import { chainLabel, sharedValueUnit, type Community } from '@yield-forward/core'

const props = defineProps<{ community: Community }>()
const totals = useVaultTotals(() => props.community.vaults)
const { isCurator } = useRoles(() => props.community)
const reviewOpen = ref(false)
const multichain = useMultichain()

// Totals add up every vault, so they need one shared unit; vaults valued in different units show a dash.
const unit = computed(() => sharedValueUnit(props.community.vaults.map((v) => v.link.kind)))
const staked = computed(() => props.community.vaults.reduce((sum, v) => sum + (v.state?.depositorValue ?? 0n), 0n))
const networks = computed(() => [...new Set(props.community.vaults.map((v) => chainLabel(v.chainId)))].join(' · '))
const nextLabel = computed(() => {
  if (totals.data.value?.status === 'paused-loss') return 'Paused'
  if (totals.data.value?.status === 'nothing' && unit.value) return `0 ${unit.value.symbol}`
  return '—'
})
</script>

<template>
  <UCard class="transition hover:ring-primary/50" :ui="{ root: 'flex flex-col', body: 'flex-1' }">
    <NuxtLink :to="communityPath(community)" class="block space-y-3">
      <div class="flex items-center gap-3">
        <CommunityAvatar :profile="community.profile" />
        <h3 class="min-w-0 truncate font-semibold">{{ community.profile.name }}</h3>
        <UBadge v-if="!community.reviewed" label="Unreviewed" color="warning" variant="subtle" size="sm" />
        <UIcon name="i-lucide-chevron-right" class="ml-auto size-5 shrink-0 text-muted" />
      </div>
      <p class="line-clamp-2 text-sm text-muted">{{ community.profile.description }}</p>
      <dl class="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt class="text-xs text-muted">Deposited</dt>
          <dd class="font-medium"><TokenAmount v-if="unit" :value="staked" :unit="unit" approx /><template v-else>—</template></dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Donated</dt>
          <dd class="font-medium">
            <TokenAmount v-if="unit" :value="totals.data.value?.donated ?? 0n" :unit="unit" approx /><template v-else>—</template>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">Ready to pay out</dt>
          <dd class="font-medium">
            <TokenAmount v-if="unit && totals.data.value?.status === 'ready'" :value="totals.data.value.ready" :unit="unit" approx />
            <template v-else>{{ nextLabel }}</template>
          </dd>
        </div>
      </dl>
      <p v-if="multichain" class="flex items-center gap-1.5 text-xs text-muted">
        <UIcon name="i-lucide-network" class="size-3.5" /> {{ networks }}
      </p>
    </NuxtLink>
    <template v-if="isCurator && !community.reviewed" #footer>
      <UButton label="Review" size="sm" color="neutral" variant="soft" @click="reviewOpen = true" />
      <ReviewDialog v-model:open="reviewOpen" :community="community" />
    </template>
  </UCard>
</template>
