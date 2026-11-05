<script setup lang="ts">
import { sendPayout, type VaultView } from '@yield-forward/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'

/// Payouts are permissionless but rarely what a visitor came for, so this is a quiet link beside the payout history.
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
  <UButton
    v-if="preview?.status === 'ready'"
    label="Pay out now"
    icon="i-lucide-send"
    size="xs"
    color="neutral"
    variant="link"
    class="-my-1 px-0 text-muted hover:text-default"
    :title="`Send the yield earned so far to ${communityName}. Anyone can do this.`"
    :loading="pending"
    @click="send"
  />
</template>
