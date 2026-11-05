<script setup lang="ts">
import { assetUnit, formatAmount, kindCopy, redeemAll, valueUnit, withdraw, type VaultView } from '@yield-forward/core'

const props = defineProps<{ view: VaultView }>()
const { getWallet } = useWallet()
const positions = usePositions(() => [props.view])
const position = computed(() => positions.data.value?.[0])
const { run, pending } = useTx()
const copy = computed(() => kindCopy(props.view.link.kind))
const asset = computed(() => assetUnit(props.view.link.kind))
const unit = computed(() => valueUnit(props.view.link.kind))

// The amount is entered as value in the type's unit, like the deposit; withdrawals pay the matching amount of
// the vault's asset (for Lido: entered in ETH, paid in wstETH).
const amountText = ref('')
const amount = computed(() => parseAmount(amountText.value, unit.value.decimals))
// Withdrawing everything redeems every share, so no dust is left behind.
const everything = computed(() => position.value !== undefined && amount.value === position.value.value)
const assets = computed(() => {
  const p = position.value
  if (!p || !amount.value || p.value === 0n) return undefined
  if (everything.value) return p.withdrawable
  const paid = (amount.value * p.withdrawable) / p.value
  return paid < p.withdrawable ? paid : p.withdrawable
})
const inputError = computed(() => {
  if (!amountText.value) return undefined
  if (amount.value === undefined) return amountError(amountText.value, unit.value.decimals)
  if (position.value && amount.value > position.value.value) return 'More than your deposit'
  if (assets.value === 0n) return 'Too small to withdraw'
  return undefined
})
// Shares are the stETH value deposited; the position is worth less only after a Lido rate dip.
const belowDeposit = computed(() => position.value !== undefined && position.value.value + 2n < position.value.shares)

async function submit() {
  const p = position.value
  const out = assets.value
  if (!p || !out || inputError.value) return
  const done = await run(`Withdrew ${formatAmount(out, asset.value.decimals)} ${asset.value.symbol}`.trim(), async () => {
    const client = usePublicClient(props.view.chainId)
    const wallet = await getWallet(props.view.chainId)
    return everything.value ? redeemAll(client, wallet, props.view.vault, p.shares) : withdraw(client, wallet, props.view.vault, out)
  })
  if (done) amountText.value = ''
}
</script>

<template>
  <div v-if="position" class="space-y-4">
    <AmountField
      v-model="amountText"
      label="Amount"
      :unit="unit"
      :balance="position.value"
      :max="position.value"
      :error="inputError"
      :disabled="pending"
    />
    <p v-if="belowDeposit" class="text-sm text-warning">Worth less than you deposited until {{ copy.recovery }}.</p>
    <p class="text-sm text-muted">
      <template v-if="assets">Paid out as <TokenAmount :value="assets" :unit="asset" />, {{ copy.assetDescription }}.</template>
      <template v-else>Paid out as {{ asset.symbol || 'the vault asset' }}, {{ copy.assetDescription }}.</template>
    </p>
    <UButton
      block
      size="xl"
      :label="everything ? 'Withdraw everything' : 'Withdraw'"
      :loading="pending"
      :disabled="!amount || !!inputError"
      @click="submit"
    />
  </div>
</template>
