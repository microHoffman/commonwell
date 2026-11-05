<script setup lang="ts">
import {
  chainLabel,
  endorse,
  isCurator,
  isValidSlug,
  removeEndorsement,
  safeHttpUrl,
  shortAddress,
  slugify,
  type Community,
} from '@yield-forward/core'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ community: Community }>()
const { address, getWallet } = useWallet()
const { data } = useDirectory()
const { run, pending } = useTx()
const multichain = useMultichain()

const slug = ref('')
const note = ref('')
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    slug.value = props.community.slug ?? slugify(props.community.profile.name)
    note.value = ''
  },
  { immediate: true },
)

const sameAddress = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
// A review is one record per chain. This curator can add one on every chain where they curate and
// the community has no review yet, and remove the ones they gave.
const toReview = computed(() =>
  props.community.records.filter((r) => !r.endorsement && isCurator(useDeployment(r.chainId), address.value)),
)
const mine = computed(() => props.community.records.filter((r) => sameAddress(r.endorsement?.curator, address.value)))
const others = computed(() =>
  props.community.records.filter((r) => r.endorsement && !sameAddress(r.endorsement.curator, address.value)),
)

const name = computed(() => props.community.profile.name)
const website = computed(() => safeHttpUrl(props.community.profile.website))
const owners = computed(() => [...new Set(props.community.records.map((r) => r.owner))])
const treasuries = computed(() => [...new Set(props.community.vaults.flatMap((v) => (v.treasury ? [v.treasury] : [])))])
const slugError = computed(() => {
  if (!isValidSlug(slug.value)) return '3–32 lowercase letters, digits or hyphens'
  const holder = data.value?.communities.find((c) => c.records.some((r) => r.endorsement?.slug === slug.value))
  if (holder && holder.id !== props.community.id) return 'Another community already has this name'
  return undefined
})
// The review is only about who runs the community; the contracts are checked automatically.
const problems = computed(() => (props.community.vaults.length > 0 ? [] : props.community.vaultViews.flatMap((v) => v.problems)))
const on = (chainId: number) => (multichain ? ` on ${chainLabel(chainId)}` : '')

async function markReviewed() {
  for (const record of toReview.value) {
    const done = await run(`${name.value} is reviewed${on(record.chainId)}`, async () =>
      endorse(
        usePublicClient(record.chainId),
        await getWallet(record.chainId),
        useDeployment(record.chainId),
        record.id,
        slug.value,
        note.value.trim(),
      ),
    )
    if (!done) return
  }
  open.value = false
}

async function removeReview() {
  for (const record of mine.value) {
    const done = await run(`Review removed${on(record.chainId)}`, async () =>
      removeEndorsement(usePublicClient(record.chainId), await getWallet(record.chainId), useDeployment(record.chainId), record.endorsement!.uid),
    )
    if (!done) return
  }
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="toReview.length > 0 ? `Review ${name}` : `Review of ${name}`"
    description="A review is a public record that you vouch for who runs this community. It doesn't change the vault or where money goes."
  >
    <template #body>
      <div class="space-y-4">
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-muted">Website</dt>
          <dd>
            <ULink v-if="website" :to="website" target="_blank" class="break-all text-primary">{{ website }}</ULink>
            <span v-else class="text-muted">none</span>
          </dd>
          <dt class="text-muted">{{ owners.length > 1 ? 'Owners' : 'Owner' }}</dt>
          <dd class="font-mono">{{ owners.map(shortAddress).join(', ') }}</dd>
          <dt class="text-muted">{{ treasuries.length > 1 ? 'Treasuries' : 'Treasury' }}</dt>
          <dd class="font-mono">{{ treasuries.map(shortAddress).join(', ') || '—' }}</dd>
        </dl>
        <UAlert
          :color="problems.length > 0 ? 'error' : 'success'"
          variant="subtle"
          :icon="problems.length > 0 ? 'i-lucide-circle-x' : 'i-lucide-shield-check'"
          :title="problems.length > 0 ? 'The automatic contract check failed' : 'Its contracts pass the automatic check'"
          :description="problems.join('; ') || undefined"
        />
        <template v-if="toReview.length > 0">
          <UFormField label="Short name" :error="slugError" :hint="`/${slug}`" required>
            <UInput v-model="slug" class="w-full" />
          </UFormField>
          <UFormField label="Note" hint="optional, public">
            <UTextarea v-model="note" :rows="2" class="w-full" />
          </UFormField>
          <p v-if="multichain" class="text-sm text-muted">
            Adds a review on {{ toReview.map((r) => chainLabel(r.chainId)).join(' and ') }}, one transaction each.
          </p>
        </template>
        <p v-for="record in others" :key="record.id" class="text-sm text-muted">
          Reviewed{{ on(record.chainId) }} by {{ shortAddress(record.endorsement!.curator) }}. Only that curator can remove
          the review.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          v-if="mine.length > 0"
          label="Remove review"
          color="error"
          variant="soft"
          :loading="pending"
          @click="removeReview"
        />
        <UButton
          v-if="toReview.length > 0"
          label="Mark reviewed"
          icon="i-lucide-badge-check"
          :loading="pending"
          :disabled="!!slugError || problems.length > 0"
          @click="markReviewed"
        />
      </div>
    </template>
  </UModal>
</template>
