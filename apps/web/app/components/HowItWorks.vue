<script setup lang="ts">
import { kindCopy, type VaultView } from '@commonwell/core'

const props = defineProps<{ view: VaultView; communityName: string }>()
const steps = computed(() => kindCopy(props.view.link.kind).howItWorks(props.communityName))
</script>

<template>
  <section class="space-y-3 px-1">
    <h3 class="text-sm font-medium">How it works</h3>
    <ol class="space-y-2 text-sm text-muted">
      <li v-for="(step, i) in steps" :key="i" class="flex gap-2"><span class="font-medium text-default">{{ i + 1 }}.</span> {{ step }}</li>
    </ol>
  </section>
</template>
