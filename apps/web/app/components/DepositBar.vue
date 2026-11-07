<script setup lang="ts">
import { vaultFlags, type VaultView } from '@commonwell/core'

/// Phones only: the deposit card sits more than a screen down, so a bar at the bottom jumps to it.
/// It hides while the card is on screen, so only one green button shows at a time.
const props = defineProps<{ view: VaultView; target: string }>()

const flags = computed(() => (props.view.state ? vaultFlags(props.view.state) : undefined))
const closed = computed(() => flags.value !== undefined && !flags.value.depositsOpen && !flags.value.needsReopen)

const cardInView = ref(true)
let observer: IntersectionObserver | undefined
onMounted(() => {
  const card = document.getElementById(props.target)
  if (!card) return
  observer = new IntersectionObserver(([entry]) => (cardInView.value = entry!.isIntersecting))
  observer.observe(card)
})
onBeforeUnmount(() => observer?.disconnect())

function jump() {
  const card = document.getElementById(props.target)
  card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  card?.querySelector('input')?.focus({ preventScroll: true })
}
</script>

<template>
  <div
    v-if="!closed"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-(--yf-page) px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 lg:hidden"
    :class="cardInView ? 'pointer-events-none translate-y-full' : 'translate-y-0'"
    :aria-hidden="cardInView"
  >
    <UButton block size="xl" label="Deposit" :tabindex="cardInView ? -1 : undefined" @click="jump" />
  </div>
</template>
