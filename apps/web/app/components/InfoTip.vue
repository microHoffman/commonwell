<script setup lang="ts">
/// A small info icon whose tooltip carries secondary detail, so labels stay short.
defineProps<{ text: string }>()
</script>

<template>
  <UTooltip :text="text" :content="{ side: 'top' }" :ui="{ content: 'h-auto max-w-64 py-1.5 select-text', text: 'whitespace-normal' }">
    <button type="button" :aria-label="text" class="inline-flex align-[-0.125em] text-dimmed transition-colors hover:text-muted focus-visible:text-muted">
      <UIcon name="i-lucide-info" class="size-3.5" />
    </button>
  </UTooltip>
</template>
