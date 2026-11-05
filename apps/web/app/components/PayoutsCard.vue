<script setup lang="ts">
import { kindCopy, timeAgo, valueUnit, type VaultView } from '@yield-forward/core'

/// Everything about payouts in one place: what's ready to send now, with the action beside it, then the
/// payouts already sent, newest first.
const props = defineProps<{ view: VaultView; communityName: string }>()
const payouts = usePayouts(() => props.view)
const unit = computed(() => valueUnit(props.view.link.kind))
const copy = computed(() => kindCopy(props.view.link.kind))
const { preview, value: ready, isLoading } = usePayoutPreview(() => props.view)

// The amount ready to pay out, when there is one to show (zero counts); otherwise a word or a dash.
const readyValue = computed(() => (preview.value?.status === 'ready' ? (ready.value ?? 0n) : preview.value?.status === 'nothing' ? 0n : undefined))
const readyLabel = computed(() => {
  switch (preview.value?.status) {
    case 'paused-loss':
      return 'Paused'
    case 'no-deposits':
    case 'error':
      return '—'
    default:
      return '…'
  }
})
const readyHint = computed(() => {
  switch (preview.value?.status) {
    case 'ready':
      return `Generated since the last payout and waiting to be sent to ${props.communityName}. Anyone can send it; whoever does pays the network fee.`
    case 'nothing':
      return `Nothing yet. ${copy.value.yieldCadence}`
    case 'paused-loss':
      return `Payouts resume when ${copy.value.recovery}.`
    case 'no-deposits':
      return 'Payouts start after the first deposit.'
    case 'error':
      return "Couldn't check right now."
    default:
      return undefined
  }
})
</script>

<template>
  <section class="rounded-[1.5rem] border border-default bg-default px-5 py-4">
    <h2 class="text-sm font-semibold">Payouts</h2>
    <!-- One list: what's waiting comes first as an ordinary row with its action, then the payouts already sent. -->
    <ul class="mt-2 divide-y divide-default text-sm">
      <li class="flex min-h-11 items-center justify-between gap-3 py-2">
        <span class="flex min-w-0 items-center gap-2">
          <USkeleton v-if="isLoading" class="h-4 w-20" />
          <span v-else class="font-medium text-highlighted">
            <TokenAmount v-if="readyValue !== undefined" :value="readyValue" :unit="unit" approx />
            <template v-else>{{ readyLabel }}</template>
          </span>
          <span class="flex items-center gap-1 text-muted">waiting <InfoTip v-if="readyHint" :text="readyHint" /></span>
        </span>
        <PayOutAction :view="view" :community-name="communityName" />
      </li>
      <li v-if="payouts.isLoading.value" class="py-2"><USkeleton class="h-10" /></li>
      <template v-else-if="payouts.data.value?.length">
        <li v-for="payout in payouts.data.value.slice(0, 5)" :key="payout.txHash" class="flex justify-between gap-2 py-2">
          <span class="font-medium text-highlighted"><TokenAmount :value="payout.amount" :unit="unit" approx /></span>
          <ULink :to="explorerUrl(view.chainId, `tx/${payout.txHash}`)" target="_blank" class="text-muted hover:text-primary">
            {{ payout.timestamp ? timeAgo(payout.timestamp) : `block ${payout.blockNumber}` }}
          </ULink>
        </li>
      </template>
      <li v-else class="py-2 text-muted">No payouts sent yet.</li>
    </ul>
  </section>
</template>
