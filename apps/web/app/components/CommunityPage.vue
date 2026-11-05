<script setup lang="ts">
import { chainLabel, getKind, kindCopy, safeHttpUrl, shortAddress, vaultFlags, type VaultView } from '@commonwell/core'

const props = defineProps<{ idOrSlug: string }>()
const { directory, community } = useCommunity(() => props.idOrSlug)
const { isOwner, isCurator } = useRoles(community)
const reviewOpen = ref(false)
// The amount being typed into the deposit form, drawn live in the money diagram.
provideDepositDraft()
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

// A few other communities, so the page reads as one packet in a shared library.
const others = computed(() => listed(directory.data.value?.communities).filter((c) => c.id !== community.value?.id).slice(0, 6))

useHead({ title: () => (community.value ? `${community.value.profile.name} · Commonwell` : 'Commonwell') })
</script>

<template>
  <div v-if="directory.isLoading.value" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-8">
    <div class="space-y-4">
      <USkeleton class="h-56 rounded-[1.5rem]" />
      <USkeleton class="h-80 rounded-[1.5rem]" />
    </div>
    <USkeleton class="h-96 rounded-[1.5rem]" />
  </div>
  <UEmpty
    v-else-if="!community"
    icon="i-lucide-search-x"
    title="Community not found"
    description="The link may be mistyped, or the community was never registered."
    :actions="[{ label: 'All communities', to: '/' }]"
  />
  <!-- Phones read top to bottom: who it is, where the money goes, then the deposit card, so the slice for the
       amount being typed is the last thing seen before the field. On wide screens the deposit column sits on
       the right and stays in view. -->
  <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8">
    <div class="space-y-4 lg:col-start-1 lg:row-start-1">
      <header class="overflow-hidden rounded-[1.5rem] border border-default bg-default">
        <div class="h-20 sm:h-24">
          <CommunityBand :seed="community.id + community.profile.name" />
        </div>
        <div class="flex gap-4 px-5 pb-5 sm:gap-5 sm:px-7 sm:pb-6">
          <CommunityAvatar :profile="community.profile" size="hero" class="-mt-8 shrink-0 ring-4 ring-(--ui-bg) sm:-mt-9" />
          <div class="min-w-0 flex-1 space-y-1 pt-3">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 class="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{{ community.profile.name }}</h1>
              <!-- Curators open the review dialog from the badge itself. -->
              <UBadge
                :as="isCurator ? 'button' : 'span'"
                :label="community.reviewed ? 'Reviewed' : 'Unreviewed'"
                :icon="community.reviewed ? 'i-lucide-badge-check' : 'i-lucide-circle-alert'"
                :color="community.reviewed ? 'primary' : 'warning'"
                variant="subtle"
                class="rounded-full"
                :title="isCurator ? 'Review this community' : undefined"
                :class="isCurator ? 'cursor-pointer hover:opacity-80' : undefined"
                @click="isCurator && (reviewOpen = true)"
              />
            </div>
            <!-- One muted line of facts, dot-separated; stacked on phones, where a wrapped line would start with a stray dot. -->
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
            <p v-if="community.profile.description" class="max-w-prose whitespace-pre-line pt-1 text-muted">
              {{ community.profile.description }}
            </p>
          </div>
          <UButton
            v-if="isOwner"
            icon="i-lucide-pencil"
            label="Edit"
            color="neutral"
            variant="ghost"
            size="sm"
            class="mt-3 shrink-0 self-start"
            @click="editOpen = true"
          />
        </div>
      </header>

      <UAlert
        v-if="unlisted"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Not taking deposits"
        description="This community has no active vault. Existing deposits can be withdrawn under My deposits."
      />

      <!-- Everything below shows the selected vault. Past four vaults, tabs get too wide and a select takes over. -->
      <template v-if="vaults.length > 1">
        <UTabs
          v-if="vaults.length <= 4"
          v-model="selectedKey"
          :items="vaultTabs"
          :content="false"
          color="neutral"
          class="w-full sm:w-fit"
          :ui="{
            list: 'overflow-x-auto rounded-full bg-default ring ring-default',
            indicator: 'rounded-full bg-elevated',
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
    </div>

    <template v-if="vault">
      <MoneyFlow :view="vault" :community-name="community.profile.name" class="lg:col-start-1 lg:row-start-2" />
      <aside
        class="flex flex-col gap-4 self-start lg:sticky lg:top-[calc(var(--yf-header)+1rem)] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-h-[calc(100dvh-var(--yf-header)-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]"
      >
        <SupportCard :key="vaultKey(vault)" :view="vault" :community-name="community.profile.name" />
        <!-- On phones it comes first, so what withdrawals pay out is read before the deposit button. -->
        <HowItWorks :view="vault" :community-name="community.profile.name" class="max-lg:order-first" />
        <PayoutsCard :view="vault" :community-name="community.profile.name" />
      </aside>
    </template>

    <div class="space-y-6 lg:col-start-1" :class="vault ? 'lg:row-start-3' : 'lg:row-start-2'">
      <FaqSection :community="community" :view="vault" />
      <ContractDetails :community="community" :view="vault ?? community.vaultViews.at(-1)" />
      <section v-if="others.length" class="space-y-3 pt-4">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold tracking-tight">More communities</h2>
          <ULink to="/" class="text-sm text-muted hover:text-default">See all</ULink>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CommunityMini v-for="other in others" :key="other.id" :community="other" />
        </div>
      </section>
    </div>

    <EditProfileDialog v-if="isOwner" v-model:open="editOpen" :community="community" />
    <ReviewDialog v-if="isCurator" v-model:open="reviewOpen" :community="community" />
  </div>
</template>
