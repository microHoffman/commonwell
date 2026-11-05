<script setup lang="ts">
import { Web3AuthProvider } from '@web3auth/modal/vue'
import { WagmiProvider } from '@web3auth/modal/vue/wagmi'

let web3AuthConfig: ReturnType<typeof useWeb3AuthConfig> | undefined
let setupError: string | undefined
try {
  web3AuthConfig = useWeb3AuthConfig()
} catch (error) {
  setupError = error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <UApp>
    <div v-if="setupError" class="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 class="text-xl font-semibold">This site isn't set up yet</h1>
      <p class="mt-2 text-muted">{{ setupError }}</p>
    </div>
    <Web3AuthProvider v-else :config="web3AuthConfig!">
      <WagmiProvider>
        <div class="min-h-screen">
          <AppHeader />
          <main class="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">
            <NuxtPage />
          </main>
        </div>
      </WagmiProvider>
    </Web3AuthProvider>
  </UApp>
</template>
