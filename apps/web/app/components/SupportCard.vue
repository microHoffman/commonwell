<script setup lang="ts">
import { valueUnit, type VaultView } from '@yield-forward/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'

const props = defineProps<{ view: VaultView; communityName: string }>()
const { isConnected } = useWallet()
const { connect } = useWeb3AuthConnect()
const positions = usePositions(() => [props.view])
const position = computed(() => (isConnected.value ? positions.data.value?.[0] : undefined))

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

    <DepositForm v-if="tab === 'deposit'" :view="view" :community-name="communityName" />
    <WithdrawForm v-else-if="position" :view="view" />
    <div v-else class="space-y-4 py-6 text-center">
      <p class="text-muted">
        {{ isConnected ? `You have no deposit with ${communityName} yet.` : 'Sign in to see and withdraw your deposit.' }}
      </p>
      <UButton v-if="!isConnected" label="Sign in" color="neutral" variant="outline" @click="connect()" />
      <UButton v-else label="Make a deposit" color="neutral" variant="outline" @click="tab = 'deposit'" />
    </div>

    <template v-if="position" #footer>
      <p class="flex items-center justify-between gap-2 text-sm text-muted">
        Your deposit <span class="font-semibold text-default">≈ <TokenAmount :value="position.value" :unit="valueUnit(view.link.kind)" /></span>
      </p>
    </template>
  </UCard>
</template>
