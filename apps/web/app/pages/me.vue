<script setup lang="ts">
import { chainLabel, sharedValueUnit, shortAddress, valueUnit, type Community, type Profile, type VaultView } from '@commonwell/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'
import type { WithdrawTarget } from '~/utils/vaults'

useHead({ title: 'My deposits · Commonwell' })

const directory = useDirectory()
const { isConnected } = useWallet()
const { connect } = useWeb3AuthConnect()
const multichain = useMultichain()
const remembered = useRememberedVaults()

// Every vault ever linked, whatever its status: a deposit must stay withdrawable even after a vault
// is retired, loses its review or stops passing the automatic check.
const entries = computed(() => {
  const seen = new Set<string>()
  const list: { community: Community; view: VaultView }[] = []
  for (const community of directory.data.value?.communities ?? []) {
    for (const view of community.vaultViews) {
      const key = vaultKey(view)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ community, view })
    }
  }
  return list
})
// Vaults this browser remembers that the directory doesn't list right now (it failed, or a chain didn't
// answer): still read and withdrawn straight from the chain.
const chains = useDeployments().map((d) => d.chainId)
const extra = computed(() => {
  const listed = new Set(entries.value.map((e) => vaultKey(e.view)))
  return remembered.vaults.value.filter((v) => chains.includes(v.chainId) && !listed.has(vaultKey(v)))
})

type Row = { key: string; target: WithdrawTarget; profile: Profile; community?: Community; view?: VaultView; value: bigint }

const targets = computed<WithdrawTarget[]>(() => [
  ...entries.value.map((e) => e.view),
  ...extra.value.map((v) => ({ chainId: v.chainId, vault: v.vault, link: { kind: v.kind } })),
])
const positions = usePositions(targets)
const rows = computed<Row[]>(() =>
  (positions.data.value ?? []).flatMap((position): Row[] => {
    const key = vaultKey(position)
    const entry = entries.value.find((e) => vaultKey(e.view) === key)
    if (entry) return [{ key, target: entry.view, profile: entry.community.profile, community: entry.community, view: entry.view, value: position.value }]
    const saved = extra.value.find((v) => vaultKey(v) === key)
    if (!saved) return []
    const profile = { name: saved.name ?? shortAddress(saved.vault), description: '', website: '', imageURI: '' }
    return [{ key, target: { chainId: saved.chainId, vault: saved.vault, link: { kind: saved.kind } }, profile, value: position.value }]
  }),
)
const total = computed(() => rows.value.reduce((sum, row) => sum + row.value, 0n))
// The total is shown only when every position is valued in the same unit.
const totalUnit = computed(() => sharedValueUnit(rows.value.map((row) => row.target.link.kind)))

// Remember every deposit seen here, so it stays listed if the directory can't be read later.
watch(rows, (list) =>
  remembered.remember(list.map((r) => ({ chainId: r.target.chainId, vault: r.target.vault, kind: r.target.link.kind, name: r.community?.profile.name }))),
)

// What couldn't be read: the whole directory, some of its chains, or the positions themselves. Then "No
// deposits yet" would be a guess, so it's never shown.
const unavailable = computed(() => directory.data.value?.unavailable ?? [])
const incomplete = computed(() => directory.isError.value || unavailable.value.length > 0 || positions.isError.value)
function retry() {
  if (directory.isError.value || unavailable.value.length > 0) directory.refetch()
  if (positions.isError.value) positions.refetch()
}
const loading = computed(() => directory.isLoading.value || positions.isLoading.value)

// The community page only offers its current vaults, so a deposit in a retired or unlisted vault, or one
// remembered here while the directory is unavailable, is withdrawn from here.
function isCurrent(row: Row): boolean {
  return row.community !== undefined && row.view !== undefined && row.community.vaults.includes(row.view)
}

// Opens the community page on this deposit's vault.
function rowLink(row: Row) {
  return { path: communityPath(row.community!), query: row.community!.vaults.length > 1 ? { vault: row.key } : {} }
}
const withdrawing = ref<string>()

function status(row: Row): string | undefined {
  if (!row.community || !row.view) return undefined
  if (row.view.link.retired) return 'Retired'
  if (row.view.problems.length > 0) return 'Not listed'
  if (!row.community.reviewed) return 'Unreviewed'
  return undefined
}
</script>

<template>
  <div class="space-y-6 pt-6">
    <div class="space-y-1">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">My deposits</h1>
      <p v-if="rows.length > 0" class="text-muted">
        <template v-if="totalUnit">≈ <TokenAmount :value="total" :unit="totalUnit" /> across</template><template v-else>Deposits in</template> {{ rows.length }} {{ rows.length === 1 ? 'community' : 'communities' }}
      </p>
    </div>
    <UEmpty
      v-if="!isConnected"
      icon="i-lucide-wallet"
      title="Sign in to see your deposits"
      :actions="[{ label: 'Sign in', onClick: () => connect() }]"
    />
    <template v-else>
      <!-- A failed read never reads as "no deposits": the money is untouched, it just can't all be listed. -->
      <UAlert
        v-if="incomplete && !loading"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="rows.length > 0 ? 'Some deposits may be missing' : 'Couldn\'t load your deposits'"
        :description="
          directory.isError.value
            ? `The community list couldn't be read${rows.length > 0 ? ', so this shows deposits remembered in this browser' : ''}. Your deposits are safe.`
            : unavailable.length > 0
              ? `Couldn't read ${unavailable.join(' and ')}. Deposits there are missing until it responds again.`
              : 'Your positions couldn\'t be read. Your deposits are safe.'
        "
        :actions="[{ label: 'Retry', color: 'neutral', variant: 'outline', onClick: retry }]"
      />
      <div v-if="loading && rows.length === 0" class="space-y-4">
        <USkeleton class="h-48" />
      </div>
      <UEmpty
        v-else-if="rows.length === 0 && !incomplete"
        icon="i-lucide-heart-handshake"
        title="No deposits yet"
        :actions="[{ label: 'Browse communities', to: '/' }]"
      />
      <UCard v-else-if="rows.length > 0" :ui="{ body: 'p-0 sm:p-0' }">
        <ul class="divide-y divide-default">
          <li v-for="row in rows" :key="row.key">
            <NuxtLink
              v-if="isCurrent(row)"
              :to="rowLink(row)"
              class="flex items-center gap-3 px-4 py-4 transition hover:bg-elevated/50 sm:px-6"
            >
              <CommunityAvatar :profile="row.profile" />
              <span class="min-w-0 flex-1 truncate font-medium">
                {{ row.profile.name }}
                <span v-if="multichain" class="text-sm font-normal text-muted"> · {{ chainLabel(row.target.chainId) }}</span>
              </span>
              <UBadge v-if="status(row)" :label="status(row)" color="neutral" variant="subtle" size="sm" />
              <span class="font-medium">≈ <TokenAmount :value="row.value" :unit="valueUnit(row.target.link.kind)" /></span>
              <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted" />
            </NuxtLink>
            <div v-else class="space-y-4 px-4 py-4 sm:px-6">
              <div class="flex items-center gap-3">
                <CommunityAvatar :profile="row.profile" />
                <span class="min-w-0 flex-1 truncate font-medium">
                  {{ row.profile.name }}
                  <span v-if="multichain" class="text-sm font-normal text-muted"> · {{ chainLabel(row.target.chainId) }}</span>
                </span>
                <UBadge v-if="status(row)" :label="status(row)" color="neutral" variant="subtle" size="sm" />
                <span class="font-medium">≈ <TokenAmount :value="row.value" :unit="valueUnit(row.target.link.kind)" /></span>
                <UButton
                  v-if="withdrawing !== row.key"
                  label="Withdraw"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  @click="withdrawing = row.key"
                />
              </div>
              <template v-if="withdrawing === row.key">
                <p class="text-sm text-muted">
                  {{
                    row.community
                      ? 'This vault no longer takes deposits. You can withdraw from it here.'
                      : 'Listed from this browser while the community list is unavailable. You can withdraw here.'
                  }}
                </p>
                <WithdrawForm :view="row.target" />
              </template>
            </div>
          </li>
        </ul>
      </UCard>
    </template>
  </div>
</template>
