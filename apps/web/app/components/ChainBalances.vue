<script setup lang="ts">
import { assetUnit, chainLabel, nativeUnit } from '@yield-forward/core'

/// The connected wallet's balances on one chain, with faucet links when it has none of the chain's own currency.
const props = defineProps<{ chainId: number; labelled?: boolean }>()
// The balances are the chain's currency and the asset of its first vault type, like `useBalances`.
const native = computed(() => nativeUnit(props.chainId))
const asset = computed(() => assetUnit(Object.keys(useDeployment(props.chainId).kinds)[0] ?? ''))
const balances = useBalances(() => props.chainId, undefined)
</script>

<template>
  <div class="space-y-2">
    <p v-if="labelled" class="text-xs font-medium text-muted">{{ chainLabel(chainId) }}</p>
    <dl class="grid grid-cols-2 gap-2 text-sm">
      <div>
        <dt class="text-muted">{{ native.symbol }}</dt>
        <dd class="font-medium"><TokenAmount v-if="balances.data.value" :value="balances.data.value.eth" :unit="native" /><template v-else>…</template></dd>
      </div>
      <div>
        <dt class="text-muted">{{ asset.symbol || 'Vault asset' }}</dt>
        <dd class="font-medium"><TokenAmount v-if="balances.data.value" :value="balances.data.value.wsteth" :unit="asset" /><template v-else>…</template></dd>
      </div>
    </dl>
    <FaucetLinks v-if="balances.data.value?.eth === 0n" :chain-id="chainId" />
  </div>
</template>
