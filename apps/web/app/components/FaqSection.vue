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
      label: 'What does it cost me?',
      content: `You give ${name} the ${copy.yieldNoun} your deposit earns, and you pay the network fees for depositing and withdrawing. Your deposit itself stays yours. Neither this app nor Octant takes a fee.${copy.fees ? ` ${copy.fees}` : ''}`,
    },
    {
      label: 'Can I get my deposit back?',
      content: `Yes, anytime and right away, from this page or under My deposits. There's no lock-up, and you can withdraw all of it or part. You get back the value you deposited${
        own.loss ? `, or in rare cases slightly less (see "${own.loss.label}")` : ''
      }. Nobody else, including ${name}, can withdraw it or send it anywhere.`,
    },
    ...(own.asset ? [own.asset] : []),
    own.receives,
    {
      label: 'Who sends the payouts?',
      content: `Anyone can, with "Pay out" in the Payouts box when something is waiting. A payout can only send what has been earned so far, and only to ${name}'s treasury. Nothing is lost between payouts: everything earned goes out with the next one.`,
    },
    {
      label: 'Do I need a crypto wallet?',
      content: 'No. You can sign in with email or a social account, and a wallet is created for you. You can also connect a wallet you already have.',
    },
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
      label: `What can ${name}'s owner change?`,
      content:
        "The owner can't touch your deposit. They can stop new deposits for good, which never blocks withdrawals or payouts. They can also move payouts to a new address: the change takes at least 14 days, this page warns about it in the meantime, and you can withdraw before it happens. Once it does, the vault is no longer listed, and your deposit stays withdrawable under My deposits. The same happens if the owner hands over management of the vault. The owner can also adjust the vault's loss check and change who can stop deposits.",
    },
    {
      label: 'What does "Reviewed" mean?',
      content:
        "One of this site's curators has checked who runs the community and vouches for it in a public record. It doesn't change the vault or where the money goes. Unreviewed communities work the same way, so check who runs one before depositing.",
    },
    {
      label: 'How do I know the vault is genuine?',
      content: `Every time the page loads, the app checks that the vault runs Octant's original, unmodified code, that ${name}'s owner still manages it, and that it pays out only to ${name}. Vaults that fail aren't listed. Technical details lists every contract, with links to the source.`,
    },
    {
      label: 'Has the code been audited?',
      content:
        "Octant's vault code has been audited by Spearbit, Bailsec and Cantina, and in a public audit competition. This app's two small contracts, the deposit router and the payout trigger, haven't had a security review yet.",
    },
    {
      label: 'What if this website goes away?',
      content:
        'Your deposit is held by the vault contract, not by this website, so it stays withdrawable. You, or anyone who knows how to call a contract, can withdraw it directly, for example on a block explorer, using the vault address in Technical details.',
    },
    ...(own.loss ? [own.loss] : []),
    {
      label: 'What are the risks?',
      content: `${copy.risks} ${testnet ? 'This is a proof of concept on a test network, where the tokens have no value.' : 'This is a proof of concept: only deposit what you can afford to lose.'}`,
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
