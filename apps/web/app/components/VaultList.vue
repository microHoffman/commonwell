<script setup lang="ts">
import { chainLabel, valueUnit, type VaultView } from '@commonwell/core'

/// The deposit card's vaults as rows: token and network on the left, the `side` slot on the right (rate and
/// protocol, or what you have there). Picking a row picks that vault for the whole page. Without `radio`
/// the rows are plain links to each vault.
const props = withDefaults(defineProps<{ vaults: VaultView[]; view?: VaultView; label: string; radio?: boolean }>(), { radio: true })
const emit = defineEmits<{ select: [key: string] }>()
</script>

<template>
  <div
    :role="radio ? 'radiogroup' : 'list'"
    :aria-label="label"
    class="divide-y divide-default overflow-hidden rounded-xl ring ring-inset ring-default"
  >
    <button
      v-for="v in props.vaults"
      :key="vaultKey(v)"
      type="button"
      :role="radio ? 'radio' : 'listitem'"
      :aria-checked="radio ? v === view : undefined"
      class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
      :class="radio && v === view ? 'bg-primary/10' : 'hover:bg-elevated'"
      @click="emit('select', vaultKey(v))"
    >
      <span
        v-if="radio"
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-full ring ring-inset"
        :class="v === view ? 'ring-primary' : 'ring-accented'"
      >
        <span v-if="v === view" class="size-2 rounded-full bg-primary" />
      </span>
      <VaultMark :view="v" />
      <span class="min-w-0 flex-1 leading-tight">
        <span class="block truncate text-sm font-medium text-highlighted">{{ valueUnit(v.link.kind).symbol }}</span>
        <span class="block truncate text-xs text-muted">
          {{ chainLabel(v.chainId) }}<template v-if="twinAddress(v, vaults)"> · {{ twinAddress(v, vaults) }}</template>
        </span>
      </span>
      <span class="shrink-0 text-right leading-tight"><slot name="side" :view="v" /></span>
    </button>
  </div>
</template>
