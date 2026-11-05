<script setup lang="ts">
import { chainLabel, isCurator, shortAddress } from '@yield-forward/core'
import { useWeb3AuthConnect, useWeb3AuthDisconnect } from '@web3auth/modal/vue'

const { connect, loading } = useWeb3AuthConnect()
const { disconnect } = useWeb3AuthDisconnect()
const { address, isConnected, wrongNetwork, getWallet } = useWallet()
const deployments = useDeployments()
const multichain = useMultichain()
const directory = useDirectory()
// Payouts are public housekeeping; the menu offers the send-everything action to curators only.
const curator = computed(() => deployments.some((d) => isCurator(d, address.value)))
const communities = computed(() => listed(directory.data.value?.communities))
const toast = useToast()

async function copyAddress() {
  if (!address.value) return
  await navigator.clipboard.writeText(address.value)
  toast.add({ title: 'Address copied', icon: 'i-lucide-copy' })
}

async function switchNetwork() {
  try {
    await getWallet(deployments[0]!.chainId)
  } catch (error) {
    toast.add({ title: errorMessage(error), color: 'error' })
  }
}
</script>

<template>
  <UButton v-if="!isConnected || !address" label="Sign in" icon="i-lucide-log-in" size="lg" class="rounded-full px-5" :loading="loading" @click="connect()" />
  <UPopover v-else>
    <UButton
      :label="shortAddress(address)"
      :icon="wrongNetwork ? 'i-lucide-triangle-alert' : 'i-lucide-wallet'"
      :color="wrongNetwork ? 'warning' : 'neutral'"
      variant="outline"
      size="lg"
      class="rounded-full bg-default px-4"
    />
    <template #content>
      <div class="w-76 space-y-4 p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-sm">{{ shortAddress(address) }}</span>
          <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" aria-label="Copy address" @click="copyAddress" />
        </div>
        <UButton
          v-if="wrongNetwork"
          :label="`Switch to ${chainLabel(deployments[0]!.chainId)}`"
          color="warning"
          block
          @click="switchNetwork"
        />
        <ChainBalances v-for="d in deployments" :key="d.chainId" :chain-id="d.chainId" :labelled="multichain" />
        <SendAllPayouts v-if="curator && communities.length > 0" :communities="communities" />
        <UButton label="Sign out" icon="i-lucide-log-out" color="neutral" variant="soft" block @click="disconnect()" />
      </div>
    </template>
  </UPopover>
</template>
