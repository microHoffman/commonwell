<script setup lang="ts">
import type { Unit } from '@yield-forward/core'
import { formatUnits } from 'viem'

const model = defineModel<string>({ required: true })
const props = defineProps<{
  label: string
  unit: Unit
  balance?: bigint
  max?: bigint
  error?: string
  disabled?: boolean
  /// Show the full balance instead of the rounded one.
  exact?: boolean
}>()


/// Fills the exact maximum, so the field always shows what will be sent.
function fillMax() {
  if (props.max !== undefined) model.value = formatUnits(props.max, props.unit.decimals)
}
</script>

<template>
  <UFormField :label="label" :error="error">
    <template v-if="balance !== undefined" #hint>
      <span class="inline-flex items-center gap-1">
        Balance
        <span v-if="exact">{{ formatUnits(balance, unit.decimals) }} {{ unit.symbol }}</span>
        <TokenAmount v-else :value="balance" :unit="unit" />
        <UButton v-if="max !== undefined" label="Max" size="xs" variant="link" class="px-1" :disabled="disabled" @click="fillMax" />
      </span>
    </template>
    <UInput
      v-model="model"
      inputmode="decimal"
      autocomplete="off"
      placeholder="0.0"
      size="xl"
      class="w-full"
      :disabled="disabled"
    >
      <template #trailing>
        <span class="text-sm text-muted">{{ unit.symbol }}</span>
      </template>
    </UInput>
  </UFormField>
</template>
