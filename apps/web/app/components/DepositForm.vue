<script setup lang="ts">
import {
  approve,
  chainLabel,
  depositEthViaRouter,
  depositWstEthBatched,
  depositWstEthViaRouter,
  depositWstEthWithPermit,
  formatAmount,
  formatApprox,
  assetUnit,
  formatPercent,
  getKind,
  kindCopy,
  nativeUnit,
  readTokenState,
  signWstEthPermit,
  supportsAtomicBatch,
  valueUnit,
  vaultFlags,
  yearlyYield,
  type Unit,
  type VaultView,
  type Wallet,
} from '@commonwell/core'
import { useQueryClient } from '@tanstack/vue-query'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'
import { parseEther, parseUnits } from 'viem'

const props = defineProps<{ view: VaultView; communityName: string }>()

// The page remounts this form when another vault is picked, so its chain is fixed here.
const chainId = props.view.chainId
const deployment = useDeployment(chainId)
const client = usePublicClient(chainId)
const queryClient = useQueryClient()
const toast = useToast()
const { address, isConnected, chainId: walletChain, getWallet } = useWallet()
const wrongNetwork = computed(() => isConnected.value && walletChain.value !== chainId)
const { connect } = useWeb3AuthConnect()

const kind = deployment.kinds[props.view.link.kind]!
const copy = kindCopy(props.view.link.kind)
// Deposits and the yield they earn read in the type's value unit; withdrawals pay out its asset.
const unit = valueUnit(props.view.link.kind)
const asset = assetUnit(props.view.link.kind)
const native = nativeUnit(chainId)
const router = kind.depositRouter
const balances = useBalances(chainId, router)
const apr = useApr(() => props.view)
const vault = computed(() => props.view.vault)
const flags = computed(() => (props.view.state ? vaultFlags(props.view.state) : undefined))
const closed = computed(() => flags.value !== undefined && !flags.value.depositsOpen && !flags.value.needsReopen)

// Below this a deposit can round to unrecoverable dust.
const minDeposit = getKind(props.view.link.kind)?.minDeposit ?? '0.0001'

type Route = 'eth' | 'wsteth'
const route = ref<Route>('eth')
const routeModel = computed({
  get: () => route.value,
  set: (value: string | undefined) => (route.value = value === 'wsteth' ? 'wsteth' : 'eth'),
})
const amountText = ref('')
const amount = computed(() => parseAmount(amountText.value, token.value.decimals))

// Gas is paid in the chain's currency, in wei. Depositing all ETH keeps enough for one router transaction's gas, including a reopen.
const gasReserve = ref(parseEther('0.002'))
onMounted(async () => {
  try {
    const { maxFeePerGas } = await client.estimateFeesPerGas()
    const estimate = maxFeePerGas * 600_000n
    gasReserve.value = estimate > parseEther('0.001') ? estimate : parseEther('0.001')
  } catch {
    // Keep the default reserve.
  }
})

const balance = computed(() => (route.value === 'eth' ? balances.data.value?.eth : balances.data.value?.wsteth))
// The wstETH option only matters to people who already hold some.
const holdsWsteth = computed(() => isConnected.value && (balances.data.value?.wsteth ?? 0n) > 0n)
watch(holdsWsteth, (holds) => {
  if (!holds) route.value = 'eth'
})
// The routes' wording comes from the vault type; this form's deposit logic is still Lido's own.
const option = (r: Route) => copy.depositOptions[r] ?? { symbol: r, description: '' }
// What each route takes: the chain's own currency, or the vault's asset.
const routeUnit = (r: Route): Unit => ({ symbol: option(r).symbol, decimals: r === 'eth' ? native.decimals : asset.decimals })
const token = computed(() => routeUnit(route.value))
const routes = (['eth', 'wsteth'] as const).map((r) => ({ label: option(r).symbol, value: r, description: option(r).description }))
const max = computed(() => {
  const b = balance.value
  if (b === undefined) return undefined
  if (route.value === 'wsteth') return b
  return b > gasReserve.value ? b - gasReserve.value : 0n
})

const inputError = computed(() => {
  if (!amountText.value) return undefined
  if (amount.value === undefined) return amountError(amountText.value, token.value.decimals)
  if (amount.value < parseUnits(minDeposit, token.value.decimals)) return `The minimum is ${minDeposit}`
  if (max.value !== undefined && amount.value > max.value) {
    return route.value === 'eth' ? `More than your ${token.value.symbol}, keeping enough for gas` : `More than your ${token.value.symbol}`
  }
  return undefined
})

// Staked value the deposit gives: ETH stakes 1:1 into stETH; wstETH is valued at Lido's current rate.
const value = computed(() => {
  if (!amount.value) return undefined
  if (route.value === 'eth') return amount.value
  return (amount.value * (props.view.state?.exchangeRate ?? 0n)) / 10n ** 18n
})
const perYear = computed(() => (value.value && apr.data.value ? yearlyYield(value.value, apr.data.value) : undefined))
// Dust already reads "< 0.0001", so it doesn't also get "≈".
const perYearIsDust = computed(() => perYear.value !== undefined && formatApprox(perYear.value, unit.decimals).startsWith('<'))
// The money diagram draws the amount being typed as a slice of the basin.
const draft = useDepositDraft()
watch([value, inputError], ([v, error]) => (draft.value = error ? undefined : v), { immediate: true })
onBeforeUnmount(() => (draft.value = undefined))

// Whether the connected wallet batches calls atomically (EIP-5792): wstETH then needs one confirmation.
const canBatch = ref(false)
watch(
  [address, wrongNetwork],
  async () => {
    canBatch.value = false
    if (!address.value || wrongNetwork.value) return
    try {
      canBatch.value = await supportsAtomicBatch(await getWallet(chainId))
    } catch {
      // Treat as unsupported.
    }
  },
  { immediate: true },
)

// The wallet confirmations a deposit takes. ETH and batched or pre-approved wstETH are one
// transaction; otherwise wstETH needs a permit signature first, or an approval if the wallet
// can't sign one.
type Step = 'sign' | 'approve' | 'deposit'
const stepLabels: Record<Step, string> = {
  sign: 'Sign approval',
  approve: `Approve ${option('wsteth').symbol}`,
  deposit: 'Deposit',
}
const approveFallback = ref(false)
const steps = computed<Step[]>(() => {
  if (route.value === 'eth' || canBatch.value) return ['deposit']
  if (amount.value && (balances.data.value?.allowance ?? 0n) >= amount.value) return ['deposit']
  return [approveFallback.value ? 'approve' : 'sign', 'deposit']
})
const current = ref<Step>()

async function depositWstEth(wallet: Wallet, assets: bigint) {
  const owner = wallet.account.address
  const { allowance } = await readTokenState(client, kind.asset, owner, router)
  if (allowance >= assets) {
    current.value = 'deposit'
    return depositWstEthViaRouter(client, wallet, router, vault.value, assets)
  }
  if (await supportsAtomicBatch(wallet)) {
    current.value = 'deposit'
    return depositWstEthBatched(wallet, kind.asset, router, vault.value, assets)
  }
  current.value = 'sign'
  try {
    const permit = await signWstEthPermit(client, wallet, kind.asset, router, assets)
    current.value = 'deposit'
    return await depositWstEthWithPermit(client, wallet, router, vault.value, assets, permit)
  } catch (error) {
    // A wallet that can't sign typed data still works, with an approval transaction instead.
    if (current.value !== 'sign' || isUserRejection(error)) throw error
  }
  approveFallback.value = true
  current.value = 'approve'
  await approve(client, wallet, kind.asset, router, assets)
  current.value = 'deposit'
  return depositWstEthViaRouter(client, wallet, router, vault.value, assets)
}

async function submit() {
  if (!isConnected.value) return connect()
  if (!amount.value || inputError.value) return
  try {
    const wallet = await getWallet(chainId)
    if (route.value === 'eth') {
      current.value = 'deposit'
      await depositEthViaRouter(client, wallet, router, vault.value, amount.value)
    } else {
      await depositWstEth(wallet, amount.value)
    }
    amountText.value = ''
    toast.add({
      title: `Deposited. ${props.communityName} now receives its ${copy.yieldNoun}.`,
      color: 'success',
      icon: 'i-lucide-heart-handshake',
    })
  } catch (error) {
    toast.add({ title: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    current.value = undefined
    approveFallback.value = false
    await queryClient.invalidateQueries()
  }
}

const buttonLabel = computed(() => {
  if (current.value) return `${stepLabels[current.value]}…`
  if (!isConnected.value) return 'Sign in to deposit'
  if (!amount.value) return 'Enter an amount'
  const label = `Deposit ${formatAmount(amount.value, token.value.decimals)} ${token.value.symbol}`
  return wrongNetwork.value ? `Switch to ${chainLabel(chainId)} and ${label.toLowerCase()}` : label
})
</script>

<template>
  <UAlert
    v-if="closed"
    color="neutral"
    variant="subtle"
    icon="i-lucide-lock"
    :title="flags?.shutdown ? 'Deposits are closed' : 'Deposits are paused'"
    :description="flags?.shutdown ? 'Withdrawals still work.' : `They reopen when ${copy.recovery}. Withdrawals still work.`"
  />

  <div v-else class="space-y-4">
    <UFormField v-if="holdsWsteth" label="Deposit with">
      <URadioGroup
        v-model="routeModel"
        :items="routes"
        variant="card"
        orientation="horizontal"
        :disabled="current !== undefined"
        :ui="{ fieldset: 'grid grid-cols-2 gap-3', item: 'w-full' }"
      />
    </UFormField>

    <AmountField
      v-model="amountText"
      label="Amount"
      :unit="token"
      :balance="isConnected ? balance : undefined"
      :max="isConnected ? max : undefined"
      :error="inputError"
      :disabled="current !== undefined"
    />

    <!-- What the deposit does, in two rows keyed to the money diagram: the dashed ochre slice is what you
         keep, the sage yield is what the community receives. What withdrawals pay out is in How it works. -->
    <dl v-if="value" class="divide-y divide-default rounded-[1rem] bg-muted px-4 text-sm">
      <div class="flex items-baseline justify-between gap-3 py-2.5">
        <dt class="flex items-center gap-2 text-muted">
          <svg viewBox="0 0 12 12" class="size-2.5 shrink-0 rounded-[3px]" aria-hidden="true"><rect width="12" height="12" fill="#4f7a36" /><path d="M-3 3 L3 -3 M-3 9 L9 -3 M-3 15 L15 -3 M3 15 L15 3 M9 15 L15 9" stroke="#e0ab5f" stroke-width="1.6" /></svg>You keep
        </dt>
        <dd class="font-semibold text-highlighted">≈ <TokenAmount :value="value" :unit="unit" /></dd>
      </div>
      <div class="flex items-baseline justify-between gap-3 py-2.5">
        <dt class="flex min-w-0 items-center gap-2 text-muted">
          <span class="size-2.5 shrink-0 rounded-[3px] bg-sage" /><span class="truncate">To {{ communityName }}</span>
        </dt>
        <dd class="shrink-0 text-right">
          <template v-if="perYear">
            <span class="font-semibold text-highlighted"><template v-if="!perYearIsDust">≈ </template><TokenAmount :value="perYear" :unit="unit" approx /></span> a year
            <span class="block text-xs text-muted">at {{ formatPercent(apr.data.value!) }} {{ copy.rateLabel }}</span>
          </template>
          <span v-else class="text-muted">Its {{ copy.yieldNoun }}</span>
        </dd>
      </div>
    </dl>

    <ol v-if="steps.length > 1" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <li v-for="(step, i) in steps" :key="step" class="flex items-center gap-2">
        <span :class="current === step ? 'font-semibold text-primary' : ''">{{ i + 1 }}. {{ stepLabels[step] }}</span>
        <UIcon v-if="i < steps.length - 1" name="i-lucide-chevron-right" class="size-3" />
      </li>
    </ol>

    <UButton
      block
      size="xl"
      :label="buttonLabel"
      :loading="current !== undefined"
      :disabled="isConnected && (!amount || !!inputError)"
      @click="submit"
    />
    <FaucetLinks v-if="isConnected && balances.data.value?.eth === 0n" :chain-id="chainId" />
  </div>
</template>
