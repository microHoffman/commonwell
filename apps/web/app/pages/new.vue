<script setup lang="ts">
import { chainLabel, createCommunity, MULTICALL3, newSalt, type Profile, type Progress, type Step } from '@yield-forward/core'
import { useQueryClient } from '@tanstack/vue-query'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'
import { getAddress, isAddress } from 'viem'

useHead({ title: 'Create a community · Yield Forward' })

const deployments = useDeployments()
const multichain = useMultichain()
// The chain the vault and the community's records go on.
const chainId = ref(deployments[0]!.chainId)
const chainOptions = deployments.map((d) => ({ label: chainLabel(d.chainId), value: d.chainId }))
const deployment = computed(() => useDeployment(chainId.value))
const queryClient = useQueryClient()
const toast = useToast()
const { address, isConnected, getWallet } = useWallet()
const { connect } = useWeb3AuthConnect()

const profile = ref<Profile>(emptyProfile())
const treasury = ref('')

const publicContracts = computed(() =>
  [MULTICALL3, ...Object.values(deployment.value.kinds).map((k) => k.payoutTrigger)].map((a) => a.toLowerCase()),
)
const errors = computed(() => profileErrors(profile.value))
const treasuryError = computed(() => {
  if (!isAddress(treasury.value)) return 'Enter an address'
  if (publicContracts.value.includes(treasury.value.toLowerCase())) return "Can't be a public contract"
  return undefined
})
const invalid = computed(() => hasErrors(errors.value) || treasuryError.value !== undefined)
// Empty required fields are flagged only after a first attempt; format errors show right away.
const attempted = ref(false)
const shownErrors = computed(() =>
  Object.fromEntries(
    Object.entries(errors.value).map(([field, error]) => [
      field,
      attempted.value || profile.value[field as keyof Profile] ? error : undefined,
    ]),
  ),
)
const shownTreasuryError = computed(() => (attempted.value || treasury.value ? treasuryError.value : undefined))

const stepList: { step: Step; label: string }[] = [
  { step: 'forwarder', label: 'Deploy the payout forwarder' },
  { step: 'vault', label: 'Deploy the vault' },
  { step: 'register', label: 'Publish the profile' },
  { step: 'link', label: 'Link the vault to the profile' },
]
const current = ref<Step>()
const running = computed(() => current.value !== undefined)
const reached = (step: Step) => stepList.findIndex((s) => s.step === step)

// Progress is saved after every step, per chain and account, so a reload resumes.
type Saved = { profile: Profile; treasury: string; progress: Progress }
const storageKey = computed(() => (address.value ? `cy:create:${chainId.value}:${address.value}` : undefined))
const saved = ref<Saved>()

function readSaved(): Saved | undefined {
  try {
    const raw = storageKey.value ? localStorage.getItem(storageKey.value) : null
    return raw ? (JSON.parse(raw) as Saved) : undefined
  } catch {
    return undefined
  }
}

function writeSaved(value: Saved | undefined) {
  saved.value = value
  try {
    if (!storageKey.value) return
    if (value) localStorage.setItem(storageKey.value, JSON.stringify(value))
    else localStorage.removeItem(storageKey.value)
  } catch {
    // Storage unavailable: creating still works, it just can't resume after a reload.
  }
}

watch(storageKey, () => (saved.value = readSaved()), { immediate: true })

async function create(resume?: Saved) {
  if (!isConnected.value || !address.value) return connect()
  attempted.value = true
  if (!resume && invalid.value) return
  const input = resume ?? { profile: trimProfile(profile.value), treasury: treasury.value, progress: { salt: newSalt(address.value), hashes: {} } }
  writeSaved(input)
  try {
    const wallet = await getWallet(chainId.value)
    const progress = await createCommunity(
      usePublicClient(chainId.value),
      wallet,
      deployment.value,
      { profile: input.profile, treasury: getAddress(input.treasury) },
      input.progress,
      {
        onStep: (step) => (current.value = step),
        onProgress: (next) => writeSaved({ ...input, progress: next }),
      },
    )
    writeSaved(undefined)
    await queryClient.invalidateQueries({ queryKey: ['directory'] })
    toast.add({
      title: `${input.profile.name} is live`,
      description: 'It shows as Unreviewed until a curator reviews it.',
      color: 'success',
      icon: 'i-lucide-party-popper',
    })
    await navigateTo(`/c/${progress.communityId}`)
  } catch (error) {
    toast.add({ title: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    current.value = undefined
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold">Create a community</h1>
      <p class="text-muted">Deploys your community's vault and publishes its profile. You become its owner.</p>
    </div>

    <UAlert
      v-if="saved && !running"
      color="info"
      variant="subtle"
      icon="i-lucide-history"
      :title="`You started creating ${saved.profile.name}`"
      :actions="[
        { label: 'Continue', onClick: () => create(saved) },
        { label: 'Discard', color: 'neutral', variant: 'ghost', onClick: () => writeSaved(undefined) },
      ]"
    />

    <UCard>
      <div class="space-y-4">
        <UFormField
          v-if="multichain"
          label="Network"
          help="Already on another network? Use the same name and wallet, and it shows as one community with a vault on each."
        >
          <USelect v-model="chainId" :items="chainOptions" class="w-full" :disabled="running" />
        </UFormField>
        <ProfileFields v-model="profile" :errors="shownErrors" :disabled="running" />
        <UFormField label="Treasury" :error="shownTreasuryError" required help="The address that receives the payouts. Changing it later takes at least 14 days.">
          <UInput v-model="treasury" placeholder="0x…" class="w-full font-mono" :disabled="running" />
        </UFormField>
      </div>
      <template #footer>
        <ol v-if="running" class="mb-4 space-y-2 text-sm">
          <li v-for="(item, i) in stepList" :key="item.step" class="flex items-center gap-2">
            <UIcon
              :name="i < reached(current!) ? 'i-lucide-circle-check' : i === reached(current!) ? 'i-lucide-loader-circle' : 'i-lucide-circle'"
              :class="['size-4', i === reached(current!) ? 'animate-spin text-primary' : i < reached(current!) ? 'text-primary' : 'text-muted']"
            />
            {{ item.label }}
          </li>
        </ol>
        <UButton
          block
          size="lg"
          :label="isConnected ? 'Create community' : 'Sign in to create'"
          :loading="running"
          @click="create()"
        />
      </template>
    </UCard>
  </div>
</template>
