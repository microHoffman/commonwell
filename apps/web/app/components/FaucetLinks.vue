<script setup lang="ts">
import { nativeUnit } from '@commonwell/core'

const props = defineProps<{ chainId: number }>()
const deployment = computed(() => useDeployment(props.chainId))
</script>

<template>
  <p v-if="deployment.faucets.length > 0" class="text-sm text-muted">
    Need test {{ nativeUnit(chainId).symbol }}? Get it free:
    <template v-for="(faucet, i) in deployment.faucets" :key="faucet.url">
      <ULink :to="faucet.url" target="_blank" class="text-primary">{{ faucet.name }}</ULink><template v-if="i < deployment.faucets.length - 1">, </template>
    </template>
  </p>
</template>
