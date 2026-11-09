<script setup lang="ts">
import { chainFor, kindCopy, type VaultView } from '@commonwell/core'

/// The page's vault switcher, under the header card: "Ways to give" over two-line tabs ("ETH on Ethereum" over
/// "Lido"). On phones, where about two tabs fit, and past four vaults, one button names the chosen vault and
/// opens the list.
const props = defineProps<{ vaults: VaultView[]; view: VaultView }>()
const emit = defineEmits<{ select: [key: string] }>()

const tabs = computed(() => props.vaults.length <= 4)
const index = computed(() => props.vaults.indexOf(props.view))
// Under the tab's name: where it earns, "testnet" on one, and the address of same-network, same-protocol twins.
const detail = (v: VaultView) =>
  [protocolOf(v), chainFor(v.chainId).testnet && 'testnet', twinAddress(v, props.vaults)].filter(Boolean).join(' · ')
// Under the picker's name: how it earns ("Staked with Lido"), and the twin's address.
const earning = (v: VaultView) => [kindCopy(v.link.kind).earning, twinAddress(v, props.vaults)].filter(Boolean).join(' · ')

const open = ref(false)
function pick(v: VaultView) {
  open.value = false
  emit('select', vaultKey(v))
}

// The tab row scrolls when it doesn't fit, and its right edge fades while there is more to see.
const row = ref<HTMLElement>()
const more = ref(false)
function measure() {
  const el = row.value
  more.value = !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
watch(row, (el, _, onCleanup) => {
  if (!el) return
  const observer = new ResizeObserver(measure)
  observer.observe(el)
  onCleanup(() => observer.disconnect())
})
</script>

<template>
  <section aria-labelledby="ways-to-give">
    <h2 id="ways-to-give" class="mb-2 flex items-baseline gap-2 px-1 text-sm font-medium text-muted">
      Ways to give <span class="text-dimmed">{{ vaults.length }}</span>
    </h2>

    <div v-if="tabs" class="hidden overflow-hidden rounded-2xl bg-default p-1 ring ring-default sm:block">
      <div
        ref="row"
        role="tablist"
        aria-labelledby="ways-to-give"
        class="flex gap-1 overflow-x-auto [scrollbar-width:none]"
        :style="more ? { maskImage: 'linear-gradient(to right, #000 calc(100% - 3rem), transparent)' } : undefined"
        @scroll.passive="measure"
      >
        <button
          v-for="v in vaults"
          :key="vaultKey(v)"
          type="button"
          role="tab"
          :aria-selected="v === view"
          class="flex shrink-0 items-center gap-2.5 rounded-xl py-1.5 pr-4 pl-2 text-left transition-colors"
          :class="v === view ? 'bg-elevated text-highlighted' : 'text-muted hover:text-highlighted'"
          @click="pick(v)"
        >
          <VaultMark :view="v" />
          <span class="leading-tight">
            <span class="block text-sm font-medium">{{ vaultTitle(v, true) }}</span>
            <span class="block text-xs" :class="v === view ? 'text-muted' : 'text-dimmed'">{{ detail(v) }}</span>
          </span>
        </button>
      </div>
    </div>

    <div :class="tabs && 'sm:hidden'">
      <UPopover v-model:open="open" :content="{ align: 'start' }" :ui="{ content: 'w-(--reka-popover-trigger-width) min-w-72' }">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl bg-default py-2 pr-3 pl-2.5 text-left ring ring-default sm:max-w-sm"
          :aria-label="`Vault: ${vaultTitle(view)}, ${index + 1} of ${vaults.length}`"
        >
          <VaultMark :view="view" />
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate text-sm font-medium text-highlighted">{{ vaultTitle(view) }}</span>
            <span class="block truncate text-xs text-muted">{{ earning(view) }}</span>
          </span>
          <span class="shrink-0 text-xs text-dimmed">{{ index + 1 }} of {{ vaults.length }}</span>
          <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-muted" />
        </button>
        <template #content>
          <div role="listbox" aria-labelledby="ways-to-give" class="max-h-80 overflow-y-auto py-1">
            <button
              v-for="v in vaults"
              :key="vaultKey(v)"
              type="button"
              role="option"
              :aria-selected="v === view"
              class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-elevated"
              @click="pick(v)"
            >
              <UIcon name="i-lucide-check" class="size-4 shrink-0 text-primary" :class="v !== view && 'invisible'" />
              <VaultMark :view="v" />
              <span class="min-w-0 flex-1 leading-tight">
                <span class="block truncate text-sm font-medium text-highlighted">{{ vaultTitle(v) }}</span>
                <span class="block truncate text-xs text-muted">{{ earning(v) }}</span>
              </span>
              <VaultRate :view="v" class="shrink-0 text-sm" />
            </button>
          </div>
        </template>
      </UPopover>
    </div>
  </section>
</template>
