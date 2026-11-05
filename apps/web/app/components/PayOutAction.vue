<script setup lang="ts">
import { sendPayout, type VaultView } from '@yield-forward/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'

/// Payouts are permissionless but rarely what a visitor came for, so this is a small, quiet button beside the
/// amount that's ready, never the page's loud action.
const props = defineProps<{ view: VaultView; communityName: string }>()
const { isConnected, getWallet } = useWallet()
const { connect } = useWeb3AuthConnect()
const { run, pending } = useTx()
const { preview } = usePayoutPreview(() => props.view)

async function send() {
  if (!isConnected.value) return connect()
  await run(`Payout sent to ${props.communityName}`, async () =>
    sendPayout(usePublicClient(props.view.chainId), await getWallet(props.view.chainId), triggerFor(props.view), props.view.forwarder!, props.view.vault),
  )
}
</script>

<template>
  <UTooltip v-if="preview?.status === 'ready'" :text="`Sends the yield to ${communityName} now. Anyone can do this; you pay the network fee.`">
    <UButton label="Pay out" size="xs" color="neutral" variant="outline" class="shrink-0 rounded-full px-3" :loading="pending" @click="send" />
  </UTooltip>
</template>
