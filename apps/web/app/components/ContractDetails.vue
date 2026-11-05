<script setup lang="ts">
import { attestationUrl, chainLabel, getKind, kindCopy, recordOf, type Community, type VaultView } from '@commonwell/core'

const props = defineProps<{ community: Community; view?: VaultView }>()
const appConfig = useAppConfig()
const record = computed(() => (props.view ? recordOf(props.community, props.view) : undefined))

type Row = { label: string; note?: string; address?: string; text?: string; href?: string }
const rows = computed<Row[]>(() => {
  const v = props.view
  const r = record.value
  if (!v || !r) return []
  const deployment = useDeployment(v.chainId)
  const kindConfig = deployment.kinds[v.link.kind]
  const kind = getKind(v.link.kind)
  const recordRow = (label: string, uid: `0x${string}` | undefined, tx?: `0x${string}`): Row =>
    uid ? { label, text: uid, href: attestationUrl(deployment, uid, tx) } : { label, text: 'not reviewed' }
  return [
    { label: 'Network', text: `${chainLabel(v.chainId)} · chain ID ${v.chainId}` },
    { label: 'Vault', address: v.vault, note: 'holds the deposits' },
    { label: 'Payout forwarder', address: v.forwarder, note: 'receives the yield and passes it on' },
    { label: 'Treasury', address: v.treasury, note: 'receives the payouts' },
    { label: 'Owner', address: r.owner, note: 'vault management and profile' },
    { label: 'Emergency admin', address: v.params?.emergencyAdmin },
    { label: 'Payout trigger', address: triggerFor(v), note: 'anyone can send payouts through it' },
    { label: kind?.assetUnit.symbol ?? 'Asset', address: kindConfig?.asset, note: `${kindCopy(v.link.kind).assetDescription}, what the vault holds` },
    { label: 'Deposit router', address: kindConfig?.depositRouter, note: 'makes each deposit one transaction' },
    { label: 'Shared vault logic', address: kindConfig?.implementation, note: "Octant's YieldSkimmingTokenizedStrategy" },
    { label: 'Vault type', text: kind?.label ?? v.link.kind, href: kind?.sourceUrl },
    recordRow('Community record', r.id, r.tx),
    recordRow('Vault link record', v.link.uid, v.link.tx),
    recordRow('Review record', r.endorsement?.uid, r.endorsement?.tx),
  ]
})

const links = computed(() => [
  { label: 'How the contracts fit together', to: `${appConfig.repoUrl}#contracts` },
  { label: 'Source code', to: appConfig.repoUrl },
  ...(props.view && getKind(props.view.link.kind) ? [{ label: 'Octant v1.3.0 source', to: getKind(props.view.link.kind)!.sourceUrl }] : []),
])
</script>

<template>
  <!-- A closed reference card; its padding matches the questions card, so the chevrons line up. -->
  <UCollapsible class="rounded-[1.5rem] border border-default bg-default">
    <button
      type="button"
      class="group flex w-full items-center gap-3 rounded-[1.5rem] px-5 py-4 text-left transition-colors hover:bg-muted sm:px-7"
    >
      <UIcon name="i-lucide-file-code-2" class="size-5 shrink-0 text-muted" />
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium text-default">Technical details</span>
        <span class="block text-xs text-muted">Contracts, roles and on-chain records</span>
      </span>
      <UIcon name="i-lucide-chevron-down" class="size-5 shrink-0 text-dimmed transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </button>
    <template #content>
      <div class="space-y-4 px-5 pb-5 pt-2 sm:px-7">
        <ul v-if="view && view.problems.length > 0" class="text-sm text-error">
          <li v-for="problem in view.problems" :key="problem">{{ problem }}</li>
        </ul>
        <dl class="space-y-3 text-sm">
          <div v-for="row in rows" :key="row.label">
            <dt class="text-xs text-muted">
              {{ row.label }}<span v-if="row.note"> · {{ row.note }}</span>
            </dt>
            <dd class="min-w-0">
              <ULink
                v-if="row.address"
                :to="explorerUrl(view!.chainId, `address/${row.address}`)"
                target="_blank"
                class="break-all font-mono text-xs hover:text-primary"
              >
                {{ row.address }}
              </ULink>
              <ULink v-else-if="row.href" :to="row.href" target="_blank" class="break-all font-mono text-xs hover:text-primary">
                {{ row.text }}
              </ULink>
              <span v-else class="break-all font-mono text-xs">{{ row.text }}</span>
            </dd>
          </div>
        </dl>
        <ul class="space-y-1 border-t border-default pt-3 text-sm">
          <li v-for="link in links" :key="link.label">
            <ULink :to="link.to" target="_blank" class="inline-flex items-center gap-1 text-primary">
              {{ link.label }} <UIcon name="i-lucide-external-link" class="size-3.5" />
            </ULink>
          </li>
        </ul>
      </div>
    </template>
  </UCollapsible>
</template>
