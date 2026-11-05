<script setup lang="ts">
import { chainLabel, getKind, kindCopy, safeHttpUrl, shortAddress, vaultFlags, type VaultView } from '@yield-forward/core'

const props = defineProps<{ idOrSlug: string }>()
const { directory, community } = useCommunity(() => props.idOrSlug)
const { isOwner, isCurator } = useRoles(community)
const reviewOpen = ref(false)
const editOpen = ref(false)

const website = computed(() => (community.value ? safeHttpUrl(community.value.profile.website) : undefined))

// A community can have several vaults, on one chain or several. Tabs show only then; `?vault=` preselects one.
const route = useRoute()
const router = useRouter()
const vaults = computed(() => community.value?.vaults ?? [])
const selectedKey = computed({
  get: () => {
    const wanted = String(route.query.vault ?? '')
    return vaults.value.find((v) => vaultKey(v) === wanted) ? wanted : vaults.value[0] && vaultKey(vaults.value[0])
  },
  set: (key) => router.replace({ query: { ...route.query, vault: key } }),
})
const vault = computed(() => vaults.value.find((v) => vaultKey(v) === selectedKey.value))

const protocolOf = (v: VaultView) => getKind(v.link.kind)?.protocol ?? v.link.kind
const chains = computed(() => [...new Set(vaults.value.map((v) => v.chainId))])
const protocols = computed(() => [...new Set(vaults.value.map(protocolOf))])
// A tab names only what tells the vaults apart: the network, the protocol, then the address of same-network, same-protocol twins.
const vaultTabs = computed(() =>
  vaults.value.map((v) => {
    const twin = vaults.value.some((o) => o !== v && o.chainId === v.chainId && protocolOf(o) === protocolOf(v))
    const parts = [chains.value.length > 1 && chainLabel(v.chainId), protocols.value.length > 1 && protocolOf(v), twin && shortAddress(v.vault)]
    return { label: parts.filter((p): p is string => typeof p === 'string').join(' · '), value: vaultKey(v) }
  }),
)
// The details line covers every vault: "Staked with Lido on Hoodi testnet" for one type, which words it itself;
// several types are just listed ("Lido, Rocket Pool, and Sky on 2 networks"), since not all of them stake.
const how = computed(() => {
  const only = protocols.value.length === 1 ? vaults.value[0] : undefined
  return only ? kindCopy(only.link.kind).earning : new Intl.ListFormat('en', { type: 'conjunction' }).format(protocols.value)
})
const where = computed(() => (chains.value.length > 1 ? `${chains.value.length} networks` : chains.value[0] && chainLabel(chains.value[0])))
const unlisted = computed(() => community.value !== undefined && vault.value === undefined)
const pendingChange = computed(() => (vault.value?.state ? vaultFlags(vault.value.state).pendingChange : undefined))

useHead({ title: () => (community.value ? `${community.value.profile.name} · Yield Forward` : 'Yield Forward') })
</script>

<template>
  <div v-if="directory.isLoading.value" class="space-y-4">
    <USkeleton class="h-20" />
    <USkeleton class="h-64" />
  </div>
  <UEmpty
    v-else-if="!community"
    icon="i-lucide-search-x"
    title="Community not found"
    description="The link may be mistyped, or the community was never registered."
    :actions="[{ label: 'All communities', to: '/' }]"
  />
  <div v-else class="space-y-6">
    <header class="space-y-4">
      <div class="flex items-center gap-4">
        <CommunityAvatar :profile="community.profile" size="hero" />
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 class="text-2xl font-semibold">{{ community.profile.name }}</h1>
            <!-- Curators open the review dialog from the badge itself. -->
            <UBadge
              :as="isCurator ? 'button' : 'span'"
              :label="community.reviewed ? 'Reviewed' : 'Unreviewed'"
              :icon="community.reviewed ? 'i-lucide-badge-check' : 'i-lucide-circle-alert'"
              :color="community.reviewed ? 'primary' : 'warning'"
              variant="subtle"
              :title="isCurator ? 'Review this community' : undefined"
              :class="isCurator ? 'cursor-pointer hover:opacity-80' : undefined"
              @click="isCurator && (reviewOpen = true)"
            />
          </div>
          <!-- One muted line of facts, dot-separated. Kept quiet so the deposit button stays the loud green.
               Stacked on phones, where a wrapped line would start with a stray dot. -->
          <p
            class="flex flex-col gap-0.5 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:[&>*+*]:before:mr-2 sm:[&>*+*]:before:text-dimmed sm:[&>*+*]:before:content-['·']"
          >
            <span v-if="!community.reviewed" class="text-warning">Check who runs it before depositing</span>
            <span v-if="vault">
              {{ how }} on <span class="text-default">{{ where }}</span>
            </span>
            <span v-if="website" class="inline-flex items-center">
              <ULink :to="website" target="_blank" class="inline-flex items-center gap-1 text-muted hover:text-default">
                {{ website.replace(/^https?:\/\//, '').replace(/\/$/, '') }} <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
              </ULink>
            </span>
          </p>
        </div>
        <UButton
          v-if="isOwner"
          icon="i-lucide-pencil"
          label="Edit"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0 self-start"
          @click="editOpen = true"
        />
      </div>
      <p v-if="community.profile.description" class="max-w-prose whitespace-pre-line text-muted">
        {{ community.profile.description }}
      </p>
    </header>

    <UAlert
      v-if="unlisted"
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Not taking deposits"
      description="This community has no active vault. Existing deposits can be withdrawn under My deposits."
    />

    <!-- Everything below shows the selected vault. Same quiet segmented style as the deposit card's tabs;
         past four vaults, tabs get too wide and a select takes over. -->
    <template v-if="vaults.length > 1">
      <UTabs
        v-if="vaults.length <= 4"
        v-model="selectedKey"
        :items="vaultTabs"
        :content="false"
        color="neutral"
        class="w-full sm:w-fit"
        :ui="{
          list: 'overflow-x-auto rounded-[calc(var(--ui-radius)*2)] bg-elevated/70',
          indicator: 'rounded-[calc(var(--ui-radius)*1.5)] bg-default shadow-sm ring ring-default dark:bg-accented',
          trigger: 'shrink-0 px-4 data-[state=active]:text-highlighted',
        }"
      />
      <USelect v-else v-model="selectedKey" :items="vaultTabs" icon="i-lucide-layers" aria-label="Vault" class="w-full sm:w-72" />
    </template>

    <UAlert
      v-if="pendingChange"
      color="warning"
      variant="subtle"
      icon="i-lucide-clock"
      title="Payout address change pending"
      :description="`Payouts can move to ${shortAddress(pendingChange.to)} after ${formatDate(pendingChange.eligibleAt)}, once anyone finalizes the change. Check with ${community.profile.name} that it's expected.`"
    />

    <!-- The deposit card comes first on phones; on wide screens it's a narrower sticky column on the right. -->
    <div v-if="vault" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-10">
      <div class="space-y-6 self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
        <SupportCard :key="vaultKey(vault)" :view="vault" :community-name="community.profile.name" />
        <HowItWorks :view="vault" :community-name="community.profile.name" />
      </div>
      <div class="space-y-6 lg:col-start-1 lg:row-start-1">
        <PayoutsCard :view="vault" :community-name="community.profile.name" />
        <FaqSection :community="community" :view="vault" />
        <ContractDetails :community="community" :view="vault" />
      </div>
    </div>

    <template v-else>
      <ContractDetails :community="community" :view="community.vaultViews.at(-1)" />
      <FaqSection :community="community" />
    </template>

    <EditProfileDialog v-if="isOwner" v-model:open="editOpen" :community="community" />
    <ReviewDialog v-if="isCurator" v-model:open="reviewOpen" :community="community" />
  </div>
</template>
