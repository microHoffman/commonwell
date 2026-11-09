<script setup lang="ts">
import { chainFor, valueUnit, type VaultView } from '@commonwell/core'

/// A vault's token with a small badge for its network, so vaults on different networks tell apart at a glance.
const props = defineProps<{ view: VaultView }>()

const symbol = computed(() => valueUnit(props.view.link.kind).symbol)
const chain = computed(() => chainFor(props.view.chainId))
// Ξ for ETH and its staked forms, $ for dollars, else the symbol's first letter.
const glyph = computed(() => (/ETH$/i.test(symbol.value) ? 'Ξ' : /^(USD|DAI)/i.test(symbol.value) ? '$' : symbol.value.charAt(0)))
</script>

<template>
  <span
    class="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accented text-sm font-semibold text-highlighted"
    aria-hidden="true"
  >
    {{ glyph }}
    <span
      class="absolute -right-0.5 -bottom-0.5 inline-flex size-3.5 items-center justify-center rounded-[0.25rem] text-[0.5rem] font-bold ring-2 ring-(--ui-bg)"
      :class="chain.testnet ? 'bg-ochre-300 text-ochre-950' : 'bg-forest-300 text-forest-950'"
    >
      {{ chain.name.charAt(0) }}
    </span>
  </span>
</template>
