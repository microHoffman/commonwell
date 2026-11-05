<script setup lang="ts">
import { formatPercent, getKind, kindCopy, timeAgo, valueUnit, type VaultView } from '@yield-forward/core'

const props = defineProps<{ view: VaultView; communityName: string }>()
const payouts = usePayouts(() => props.view)
const apr = useApr(() => props.view)
const aprSource = computed(() => getKind(props.view.link.kind)?.aprSource)
const copy = computed(() => kindCopy(props.view.link.kind))
const unit = computed(() => valueUnit(props.view.link.kind))
const { preview, value: next } = usePayoutPreview(() => props.view)

const staked = computed(() => props.view.state?.depositorValue ?? 0n)

const nextLabel = computed(() => {
  switch (preview.value?.status) {
    case 'nothing':
      return `0 ${unit.value.symbol}`.trim()
    case 'paused-loss':
      return 'Paused'
    case 'no-deposits':
    case 'error':
      return '—'
    default:
      return '…'
  }
})
const nextHint = computed(() => {
  switch (preview.value?.status) {
    case 'ready':
      return `Earned since the last payout and waiting to be sent to ${props.communityName}.`
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
const aprLabel = computed(() => (apr.data.value ? formatPercent(apr.data.value) : apr.isLoading.value ? '…' : '—'))
</script>

<template>
  <UCard>
    <dl class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-2">
      <div>
        <dt class="text-sm text-muted">Total deposited</dt>
        <dd class="text-xl font-semibold"><TokenAmount :value="staked" :unit="unit" approx /></dd>
      </div>
      <div>
        <dt class="text-sm text-muted">Donated so far</dt>
        <dd class="text-xl font-semibold"><TokenAmount :value="totalDonated(payouts.data.value)" :unit="unit" approx /></dd>
      </div>
      <div>
        <dt class="flex items-center gap-1 text-sm text-muted">
          {{ copy.rateLabel }} <InfoTip v-if="aprSource" :text="aprSource" />
        </dt>
        <dd class="text-xl font-semibold">{{ aprLabel }}</dd>
      </div>
      <div>
        <dt class="flex items-center gap-1 text-sm text-muted">
          Ready to pay out <InfoTip v-if="nextHint" :text="nextHint" />
        </dt>
        <dd class="text-xl font-semibold">
          <TokenAmount v-if="preview?.status === 'ready'" :value="next ?? 0n" :unit="unit" approx />
          <template v-else>{{ nextLabel }}</template>
        </dd>
      </div>
    </dl>

    <div class="mt-5 space-y-2 border-t border-default pt-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-medium">Payouts</h3>
        <PayOutAction :view="view" :community-name="communityName" />
      </div>
      <ul v-if="payouts.data.value?.length" class="space-y-1.5 text-sm">
        <li v-for="payout in payouts.data.value.slice(0, 5)" :key="payout.txHash" class="flex justify-between gap-2">
          <TokenAmount :value="payout.amount" :unit="unit" approx />
          <ULink :to="explorerUrl(view.chainId, `tx/${payout.txHash}`)" target="_blank" class="text-muted hover:text-primary">
            {{ payout.timestamp ? timeAgo(payout.timestamp) : `block ${payout.blockNumber}` }}
          </ULink>
        </li>
      </ul>
      <p v-else-if="!payouts.isLoading.value" class="text-sm text-muted">None yet.</p>
    </div>
  </UCard>
</template>
