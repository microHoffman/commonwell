<script setup lang="ts">
import { chainLabel, updateProfile, type Community, type Profile } from '@commonwell/core'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ community: Community }>()
const { address, getWallet } = useWallet()
const { run, pending } = useTx()
const multichain = useMultichain()

// The profile lives on every chain the community has a record on; the edit goes to each one this
// wallet owns.
const owned = computed(() => props.community.records.filter((r) => r.owner.toLowerCase() === address.value?.toLowerCase()))

const profile = ref<Profile>(emptyProfile())
watch(open, (isOpen) => {
  if (isOpen) profile.value = { ...props.community.profile }
})
const errors = computed(() => profileErrors(profile.value))

async function save() {
  for (const record of owned.value) {
    const done = await run(`Profile updated${multichain ? ` on ${chainLabel(record.chainId)}` : ''}`, async () =>
      updateProfile(
        usePublicClient(record.chainId),
        await getWallet(record.chainId),
        useDeployment(record.chainId),
        record.id,
        trimProfile(profile.value),
      ),
    )
    if (!done) return
  }
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" title="Edit profile" description="Saved as a new public record. Payouts and the vault don't change.">
    <template #body>
      <div class="space-y-4">
        <ProfileFields v-model="profile" :errors="errors" :disabled="pending" />
        <p v-if="multichain && owned.length > 1" class="text-sm text-muted">
          Saves on {{ owned.map((r) => chainLabel(r.chainId)).join(' and ') }}, one transaction each.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton label="Save" :loading="pending" :disabled="hasErrors(errors)" @click="save" />
      </div>
    </template>
  </UModal>
</template>
