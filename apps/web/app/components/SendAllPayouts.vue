<script setup lang="ts">
import { chainLabel, previewPayout, sendAllPayouts, type Community } from '@yield-forward/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'

const props = defineProps<{ communities: Community[] }>()
const { address, isConnected, getWallet } = useWallet()
const { connect } = useWeb3AuthConnect()
const { run, pending } = useTx()
const toast = useToast()

/// Sends every community's pending payouts, one transaction per chain; anyone can, paying the gas.
async function sendAll() {
  if (!isConnected.value || !address.value) return connect()
  try {
    const views = props.communities.flatMap((c) => c.vaults).filter((v) => v.forwarder)
    const targets = views.map((v) => ({ chainId: v.chainId, trigger: triggerFor(v), forwarder: v.forwarder!, vault: v.vault }))
    const previews = await Promise.all(
      targets.map((t) => previewPayout(usePublicClient(t.chainId), address.value!, t.trigger, t.forwarder, t.vault)),
    )
    const ready = targets.filter((_, i) => previews[i]?.status === 'ready')
    if (ready.length === 0) {
      toast.add({ title: 'Nothing to send yet', description: 'No vault has earned anything since its last payout.', icon: 'i-lucide-clock' })
      return
    }
    for (const chainId of new Set(ready.map((t) => t.chainId))) {
      const batch = ready.filter((t) => t.chainId === chainId)
      const label = `Sent ${batch.length} payout${batch.length === 1 ? '' : 's'}${useMultichain() ? ` on ${chainLabel(chainId)}` : ''}`
      await run(label, async () => sendAllPayouts(usePublicClient(chainId), await getWallet(chainId), batch))
    }
  } catch (error) {
    toast.add({ title: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <UButton
    label="Send all pending payouts"
    icon="i-lucide-send"
    color="neutral"
    variant="soft"
    block
    :loading="pending"
    @click="sendAll"
  />
</template>
