<script setup lang="ts">
import type { Profile } from '@yield-forward/core'

defineProps<{ errors: Partial<Record<keyof Profile, string>>; disabled?: boolean }>()
const profile = defineModel<Profile>({ required: true })
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Name" :error="errors.name" required>
      <UInput v-model="profile.name" class="w-full" :disabled="disabled" />
    </UFormField>
    <UFormField label="Description" :error="errors.description" hint="optional">
      <UTextarea v-model="profile.description" :rows="3" class="w-full" :disabled="disabled" />
    </UFormField>
    <UFormField label="Website" :error="errors.website" hint="optional">
      <UInput v-model="profile.website" placeholder="https://" class="w-full" :disabled="disabled" />
    </UFormField>
    <UFormField label="Image URL" :error="errors.imageURI" hint="optional">
      <UInput v-model="profile.imageURI" placeholder="https://" class="w-full" :disabled="disabled" />
    </UFormField>
  </div>
</template>
