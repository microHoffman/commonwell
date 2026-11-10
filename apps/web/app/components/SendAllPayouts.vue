<script setup lang="ts">
import { chainLabel, previewPayout, sendAllPayouts, type Community } from '@commonwell/core'
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
    const targets = props.communities.flatMap((c) =>
      c.vaults
        .filter((v) => v.forwarder)
        .map((v) => ({ name: c.profile.name, chainId: v.chainId, trigger: triggerFor(v), forwarder: v.forwarder!, vault: v.vault })),
    )
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
      const on = useMultichain() ? ` on ${chainLabel(chainId)}` : ''
      // The batch succeeds even when single payouts fail, so the toast counts what actually went through.
      await run(
        ({ sent, missed }) =>
          missed.length === 0
            ? `Sent ${sent.length} payout${sent.length === 1 ? '' : 's'}${on}`
            : {
                title: `Sent ${sent.length} of ${batch.length} payouts${on}`,
                description: `${[...new Set(missed.map((t) => t.name))].join(', ')} didn't go through. Try again later.`,
                color: 'warning',
                icon: 'i-lucide-triangle-alert',
              },
        async () => sendAllPayouts(usePublicClient(chainId), await getWallet(chainId), batch),
      )
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
