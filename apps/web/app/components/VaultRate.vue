<script setup lang="ts">
import { formatPercent, type VaultView } from '@commonwell/core'

/// A vault's yearly rate, "2.74%", or a dash until it loads (or when its source has none).
const props = defineProps<{ view: VaultView }>()
const apr = useApr(() => props.view)
</script>

<template>
  <span class="tabular-nums">{{ apr.data.value ? formatPercent(apr.data.value) : '–' }}</span>
</template>
