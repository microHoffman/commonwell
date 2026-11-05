<script setup lang="ts">
import { timeAgo, valueUnit, type VaultView } from '@yield-forward/core'

/// The payout history beside the deposit card. The figures themselves live in the money diagram.
const props = defineProps<{ view: VaultView; communityName: string }>()
const payouts = usePayouts(() => props.view)
const unit = computed(() => valueUnit(props.view.link.kind))
</script>

<template>
  <section class="rounded-[1.5rem] border border-default bg-default px-5 py-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold">Recent payouts</h2>
      <PayOutAction :view="view" :community-name="communityName" />
    </div>
    <USkeleton v-if="payouts.isLoading.value" class="mt-3 h-12" />
    <ul v-else-if="payouts.data.value?.length" class="mt-2 divide-y divide-default text-sm">
      <li v-for="payout in payouts.data.value.slice(0, 5)" :key="payout.txHash" class="flex justify-between gap-2 py-2">
        <span class="font-medium text-highlighted"><TokenAmount :value="payout.amount" :unit="unit" approx /></span>
        <ULink :to="explorerUrl(view.chainId, `tx/${payout.txHash}`)" target="_blank" class="text-muted hover:text-primary">
          {{ payout.timestamp ? timeAgo(payout.timestamp) : `block ${payout.blockNumber}` }}
        </ULink>
      </li>
    </ul>
    <p v-else class="mt-1 text-sm text-muted">None yet.</p>
  </section>
</template>
