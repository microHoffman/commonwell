<script setup lang="ts">
import { chainFor, chainLabel } from '@commonwell/core'

/// A token with its network under it, "ETH" over "on Ethereum", for the end of an amount field. A testnet's line
/// is ochre, so it stands out without a separate warning.
const props = defineProps<{ symbol: string; chainId: number }>()
const testnet = computed(() => chainFor(props.chainId).testnet)
</script>

<template>
  <span class="flex min-w-0 items-center gap-2 text-left">
    <span class="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accented text-xs font-semibold text-highlighted" aria-hidden="true">
      {{ tokenGlyph(symbol) }}
    </span>
    <span class="min-w-0 leading-tight">
      <span class="block text-sm font-medium text-highlighted">{{ symbol }}</span>
      <span class="block truncate text-[0.7rem]" :class="testnet ? 'text-ochre-700 dark:text-ochre-300' : 'text-muted'">on {{ chainLabel(chainId) }}</span>
    </span>
  </span>
</template>
