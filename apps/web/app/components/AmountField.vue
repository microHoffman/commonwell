<script setup lang="ts">
import type { Unit } from '@commonwell/core'
import { formatUnits } from 'viem'

const model = defineModel<string>({ required: true })
const props = defineProps<{
  label: string
  unit: Unit
  balance?: bigint
  /// Where the balance is, after it on the label row: "in Lido".
  where?: string
  max?: bigint
  error?: string
  disabled?: boolean
}>()
// A `trailing` slot replaces the unit label, e.g. with the token and its network, and needs more room at the field's end.
const slots = useSlots()

/// Fills the exact maximum, so the field always shows what will be sent.
function fillMax() {
  if (props.max !== undefined) model.value = formatUnits(props.max, props.unit.decimals)
}
</script>

<template>
  <UFormField :label="label" :error="error" :ui="{ labelWrapper: 'flex-wrap gap-x-3' }">
    <template v-if="balance !== undefined || where" #hint>
      <span class="inline-flex flex-wrap items-center justify-end gap-x-1">
        <TokenAmount v-if="balance !== undefined" :value="balance" :unit="unit" class="text-default" />
        <span v-if="where">{{ where }}</span>
        <template v-if="max !== undefined">
          <span class="text-dimmed" aria-hidden="true">·</span>
          <UButton label="Max" size="xs" variant="link" class="px-0.5" :disabled="disabled" @click="fillMax" />
        </template>
      </span>
    </template>
    <UInput
      v-model="model"
      inputmode="decimal"
      autocomplete="off"
      placeholder="0.0"
      size="xl"
      class="w-full"
      :ui="{
        base: ['h-14 text-2xl font-semibold tracking-tight placeholder:font-normal focus-visible:ring-2 focus-visible:ring-ochre-500', slots.trailing && 'pe-48'],
      }"
      :disabled="disabled"
    >
      <template #trailing>
        <slot name="trailing">
          <span class="text-sm text-muted">{{ unit.symbol }}</span>
        </slot>
      </template>
    </UInput>
  </UFormField>
</template>
