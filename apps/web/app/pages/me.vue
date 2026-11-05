<script setup lang="ts">
import { chainLabel, sharedValueUnit, valueUnit, type Community, type VaultView } from '@yield-forward/core'
import { useWeb3AuthConnect } from '@web3auth/modal/vue'

useHead({ title: 'My deposits · Yield Forward' })

const { data, isLoading } = useDirectory()
const { isConnected } = useWallet()
const { connect } = useWeb3AuthConnect()
const multichain = useMultichain()

// Every vault ever linked, whatever its status: a deposit must stay withdrawable even after a vault
// is retired, loses its review or stops passing the automatic check.
const entries = computed(() => {
  const seen = new Set<string>()
  const list: { community: Community; view: VaultView }[] = []
  for (const community of data.value?.communities ?? []) {
    for (const view of community.vaultViews) {
      const key = vaultKey(view)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ community, view })
    }
  }
  return list
})
const positions = usePositions(() => entries.value.map((e) => e.view))
const total = computed(() => rows.value.reduce((sum, row) => sum + row.position.value, 0n))
// The total is shown only when every position is valued in the same unit.
const totalUnit = computed(() => sharedValueUnit(rows.value.map((row) => row.view.link.kind)))
const rows = computed(() =>
  (positions.data.value ?? []).flatMap((position) =>
    entries.value
      .filter((e) => vaultKey(e.view) === vaultKey(position))
      .map((e) => ({ ...e, position })),
  ),
)

type Entry = { community: Community; view: VaultView }

// The community page only offers its current vaults, so a deposit in a retired or unlisted vault is
// withdrawn from here.
function isCurrent(entry: Entry): boolean {
  return entry.community.vaults.includes(entry.view)
}

// Opens the community page on this deposit's vault.
function entryLink(entry: Entry) {
  return { path: communityPath(entry.community), query: entry.community.vaults.length > 1 ? { vault: vaultKey(entry.view) } : {} }
}
const withdrawing = ref<string>()

function status(entry: Entry): string | undefined {
  if (entry.view.link.retired) return 'Retired'
  if (entry.view.problems.length > 0) return 'Not listed'
  if (!entry.community.reviewed) return 'Unreviewed'
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
    <div v-else-if="isLoading || positions.isLoading.value" class="space-y-4">
      <USkeleton class="h-48" />
    </div>
    <UEmpty
      v-else-if="rows.length === 0"
      icon="i-lucide-heart-handshake"
      title="No deposits yet"
      :actions="[{ label: 'Browse communities', to: '/' }]"
    />
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }">
      <ul class="divide-y divide-default">
        <li v-for="entry in rows" :key="vaultKey(entry.view)">
          <NuxtLink
            v-if="isCurrent(entry)"
            :to="entryLink(entry)"
            class="flex items-center gap-3 px-4 py-4 transition hover:bg-elevated/50 sm:px-6"
          >
            <CommunityAvatar :profile="entry.community.profile" />
            <span class="min-w-0 flex-1 truncate font-medium">
              {{ entry.community.profile.name }}
              <span v-if="multichain" class="text-sm font-normal text-muted"> · {{ chainLabel(entry.view.chainId) }}</span>
            </span>
            <UBadge v-if="status(entry)" :label="status(entry)" color="neutral" variant="subtle" size="sm" />
            <span class="font-medium">≈ <TokenAmount :value="entry.position.value" :unit="valueUnit(entry.view.link.kind)" /></span>
            <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted" />
          </NuxtLink>
          <div v-else class="space-y-4 px-4 py-4 sm:px-6">
            <div class="flex items-center gap-3">
              <CommunityAvatar :profile="entry.community.profile" />
              <span class="min-w-0 flex-1 truncate font-medium">
              {{ entry.community.profile.name }}
              <span v-if="multichain" class="text-sm font-normal text-muted"> · {{ chainLabel(entry.view.chainId) }}</span>
            </span>
              <UBadge v-if="status(entry)" :label="status(entry)" color="neutral" variant="subtle" size="sm" />
              <span class="font-medium">≈ <TokenAmount :value="entry.position.value" :unit="valueUnit(entry.view.link.kind)" /></span>
              <UButton
                v-if="withdrawing !== vaultKey(entry.view)"
                label="Withdraw"
                size="sm"
                color="neutral"
                variant="outline"
                @click="withdrawing = vaultKey(entry.view)"
              />
            </div>
            <template v-if="withdrawing === vaultKey(entry.view)">
              <p class="text-sm text-muted">This vault no longer takes deposits. You can withdraw from it here.</p>
              <WithdrawForm :view="entry.view" />
            </template>
          </div>
        </li>
      </ul>
    </UCard>
  </div>
</template>
