<script setup lang="ts">
import { chainLabel, valueUnit, type VaultView } from '@commonwell/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'

/// The deposit card for a community's `view`, with its other `vaults` listed when there is a choice. Picking
/// one emits `select`, which switches the whole page; the card keeps its tab, and the forms remount per vault.
const props = defineProps<{ vaults: VaultView[]; view: VaultView; communityName: string }>()
const emit = defineEmits<{ select: [key: string] }>()
const { isConnected } = useWallet()
const { connect } = useWeb3AuthConnect()
const positions = usePositions(() => props.vaults)
const positionOf = (v: VaultView) =>
  isConnected.value ? positions.data.value?.find((p) => p.chainId === v.chainId && p.vault.toLowerCase() === v.vault.toLowerCase()) : undefined
const position = computed(() => positionOf(props.view))
// Withdraw lists only the vaults holding your money.
const mine = computed(() => props.vaults.filter((v) => positionOf(v)))
// Seen here, so My deposits can still list them if the directory can't be read later.
const remembered = useRememberedVaults()
watch(mine, (list) =>
  remembered.remember(list.map((v) => ({ chainId: v.chainId, vault: v.vault, kind: v.link.kind, name: props.communityName }))),
)

const tab = ref<'deposit' | 'withdraw'>('deposit')
const tabs = [
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdraw', value: 'withdraw' },
]
</script>

<template>
  <UCard :ui="{ header: 'border-b-0 p-3 sm:p-3', body: 'pt-2 sm:pt-3', footer: 'bg-muted py-3.5 sm:py-3.5' }">
    <template #header>
      <!-- A quiet pill control, so the green deposit button stays the only loud element. -->
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        color="neutral"
        size="lg"
        class="w-full"
        :ui="{
          list: 'rounded-full bg-elevated',
          indicator: 'rounded-full bg-default shadow-sm dark:bg-accented',
          trigger: 'data-[state=active]:text-highlighted',
        }"
      />
    </template>

    <div v-if="tab === 'deposit'" class="space-y-4">
      <!-- With one vault there is nothing to choose: the network sits beside the balance and the protocol in the summary. -->
      <VaultList v-if="vaults.length > 1" :vaults="vaults" :view="view" label="Vault" @select="emit('select', $event)">
        <template #side="{ view: v }">
          <VaultRate :view="v" class="block text-sm text-default" />
          <span class="block text-xs text-muted">{{ protocolOf(v) }}</span>
        </template>
      </VaultList>
      <DepositForm :key="vaultKey(view)" :view="view" :community-name="communityName" />
    </div>

    <div v-else-if="!isConnected" class="space-y-4 py-6 text-center">
      <p class="text-muted">Sign in to see what you've deposited with {{ communityName }}.</p>
      <UButton label="Sign in" color="neutral" variant="outline" @click="connect()" />
    </div>
    <USkeleton v-else-if="positions.isLoading.value" class="h-40 rounded-[1rem]" />
    <!-- A failed read isn't "no deposit": say so and offer to try again. -->
    <div v-else-if="positions.isError.value" class="space-y-4 py-6 text-center">
      <p class="text-muted">Couldn't read your deposits with {{ communityName }}. They're safe; the network didn't answer.</p>
      <UButton label="Try again" color="neutral" variant="outline" :loading="positions.isFetching.value" @click="positions.refetch()" />
    </div>
    <div v-else-if="mine.length === 0" class="space-y-4 py-6 text-center">
      <p class="text-muted">You have no deposit with {{ communityName }} yet.</p>
      <UButton label="Make a deposit" color="neutral" variant="outline" @click="tab = 'deposit'" />
    </div>
    <!-- The page's vault holds none of your money: say so, and point to where it is. -->
    <div v-else-if="!position" class="space-y-3">
      <p class="text-sm text-muted">Nothing to withdraw from {{ protocolOf(view) }} on {{ chainLabel(view.chainId) }}. Your deposits are here:</p>
      <VaultList :vaults="mine" label="Your deposits" :radio="false" @select="emit('select', $event)">
        <template #side="{ view: v }">
          <TokenAmount :value="positionOf(v)!.value" :unit="valueUnit(v.link.kind)" class="block text-sm text-default" />
          <span class="block text-xs text-muted">{{ protocolOf(v) }}</span>
        </template>
      </VaultList>
    </div>
    <div v-else class="space-y-4">
      <div v-if="mine.length > 1">
        <p class="mb-1.5 flex justify-between px-3 text-xs text-muted"><span>Your deposits</span><span>You have</span></p>
        <VaultList :vaults="mine" :view="view" label="Your deposits" @select="emit('select', $event)">
          <template #side="{ view: v }">
            <TokenAmount :value="positionOf(v)!.value" :unit="valueUnit(v.link.kind)" class="block text-sm text-default" />
            <span class="block text-xs text-muted">{{ protocolOf(v) }}</span>
          </template>
        </VaultList>
      </div>
      <WithdrawForm :key="vaultKey(view)" :view="view" />
    </div>

    <template v-if="position" #footer>
      <p class="flex items-center justify-between gap-2 text-sm text-muted">
        Your deposit <span class="font-semibold text-default">≈ <TokenAmount :value="position.value" :unit="valueUnit(view.link.kind)" /></span>
      </p>
    </template>
  </UCard>
</template>
