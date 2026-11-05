<script setup lang="ts">
import { chainFor, chainLabel, formatPercent, getKind, kindCopy, nativeUnit, type Community, type VaultView } from '@yield-forward/core'

/// Plain answers to what a depositor wants to know before trusting a vault.
const props = defineProps<{ community: Community; view?: VaultView }>()
const apr = useApr(() => props.view)

const items = computed(() => {
  const name = props.community.profile.name
  const chains = [...new Set(props.community.vaults.map((v) => v.chainId))]
  const testnet = chains.length > 0 && chains.every((c) => chainFor(c).testnet)
  // The vault type answers the questions about how it earns; without a selected vault, the newest linked one's type.
  const kind = (props.view ?? props.community.vaultViews.at(-1))?.link.kind ?? ''
  const copy = kindCopy(kind)
  const rate = apr.data.value ? `currently ${formatPercent(apr.data.value)} (${getKind(kind)?.aprSource})` : undefined
  const own = copy.faq(name, rate)

  return [
    own.funding,
    {
      label: 'Can I get my deposit back?',
      content: `Yes, anytime, from this page or under My deposits. You withdraw the same value you deposited. Nobody else, including ${name}, can withdraw it or send it anywhere.`,
    },
    ...(own.asset ? [own.asset] : []),
    own.receives,
    {
      label: 'Who sends the payouts?',
      content: `Anyone, with "Pay out now" next to the payout history. Payouts go through a public contract (the payout trigger) that can only send the yield earned so far, and only to ${name}'s treasury. No server or private key is involved.`,
    },
    {
      label: `What can ${name}'s owner change?`,
      content:
        "The owner can stop new deposits for good, adjust the vault's loss check, change its admin roles, and propose a new treasury. A new treasury can take over 14 days after it's proposed at the earliest, and this page warns about it in the meantime. The owner can't touch your deposit, and stopping deposits never blocks withdrawals or payouts. If a role is changed, the vault fails the automatic check and is no longer listed, but deposits stay withdrawable under My deposits.",
    },
    {
      label: 'What does "Reviewed" mean?',
      content:
        "A curator has checked who runs the community and vouches for it in a public record. It doesn't change the vault or where the money goes. Unreviewed communities work the same way, so check who runs one before depositing.",
    },
    {
      label: 'How do I know the vault is genuine?',
      content:
        "Each time the page loads, the app rebuilds the vault's address from its settings and the unmodified Octant v1.3.0 code, then reads its live roles: the owner manages it, payouts go to this community's forwarder, and no public contract holds a role. Vaults that fail aren't listed. Technical details lists every contract, with links to the source.",
    },
    ...(own.loss ? [own.loss] : []),
    {
      label: 'Which network is this on?',
      content:
        chains.length === 0
          ? `${name} has no active vault.`
          : `${name}'s ${chains.length > 1 ? 'vaults are' : 'vault is'} on ${chains.map(chainLabel).join(' and ')}.${
              testnet ? ` Test ${[...new Set(chains.map((c) => nativeUnit(c).symbol))].join(' and ')} has no value, and you can get it free from a faucet.` : ''
            }`,
    },
    {
      label: 'What are the risks?',
      content: `${copy.risks} This is a proof of concept${
        testnet ? ' on a test network' : ''
      }: only deposit what you can afford to lose.`,
    },
  ]
})
</script>

<template>
  <section class="space-y-1 rounded-[1.5rem] border border-default bg-default px-5 pb-2 pt-4 sm:px-7 sm:pt-5">
    <h2 class="text-base font-semibold text-highlighted">Questions</h2>
    <UAccordion
      :items="items"
      type="multiple"
      :ui="{
        item: 'border-default',
        trigger: 'py-3 text-sm font-normal text-default hover:text-highlighted',
        trailingIcon: 'text-dimmed',
        body: 'max-w-prose pb-4 text-sm leading-relaxed text-muted',
      }"
    />
  </section>
</template>
