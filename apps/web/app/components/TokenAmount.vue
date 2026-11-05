<script setup lang="ts">
import { formatAmount, formatApprox, type Unit } from '@yield-forward/core'
import { formatUnits } from 'viem'

/// A rounded amount that shows the exact value on hover, so no rounded figure is ever the only one shown.
const props = defineProps<{
  value: bigint
  /// The symbol and decimals together, so an amount is never formatted with another token's decimals.
  unit: Unit
  /// Headline style: 4 significant digits and "< 0.0001" for dust.
  approx?: boolean
}>()

const exact = computed(() => formatUnits(props.value, props.unit.decimals))
const short = computed(() =>
  props.approx ? formatApprox(props.value, props.unit.decimals) : formatAmount(props.value, props.unit.decimals),
)
const rounded = computed(() => short.value !== exact.value)
</script>

<template>
  <span class="whitespace-nowrap">
    <UTooltip :disabled="!rounded" :ui="{ content: 'select-text' }">
      <span :class="rounded && 'trigger'">{{ short }}</span>
      <template #content>
        <!-- One click selects just the number, ready to copy. -->
        <span class="select-all tabular-nums">{{ exact }}</span>
        <span v-if="unit.symbol">{{ unit.symbol }}</span>
      </template>
    </UTooltip>
    <template v-if="unit.symbol">&nbsp;{{ unit.symbol }}</template>
  </span>
</template>

<style scoped>
/* A faint dotted hint at rest that softens into a light highlight on hover. */
.trigger {
  cursor: default;
  border-radius: 0.25rem;
  text-decoration: underline dotted;
  text-decoration-color: color-mix(in oklab, currentColor 35%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.3em;
  transition:
    background-color 150ms,
    box-shadow 150ms,
    text-decoration-color 150ms;
}
.trigger:hover,
.trigger[data-state$='open'] {
  background-color: var(--ui-bg-elevated);
  /* Pads the highlight without shifting the text around it. */
  box-shadow: 0 0 0 0.2em var(--ui-bg-elevated);
  text-decoration-color: transparent;
}
</style>
