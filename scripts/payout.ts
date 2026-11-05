// Sends every community's pending payout in one transaction (the CLI version of "Send all payouts").
//
//   bun run payout --deployment <name>      (signs with PAYOUT_KEY, else DEPLOYER_KEY, or their keystores)
import { formatEther } from 'viem'
import { loadDirectory, previewPayout, sendAllPayouts, shortAddress, validateCommunity } from '../packages/core/src/index.ts'
import { deploymentName, explorerTx, hasKey, publicClient, requireDeployment, wallet } from './lib.ts'

const deployment = requireDeployment(deploymentName())
const client = publicClient(deployment.chainId, deployment)
const sender = wallet(hasKey('PAYOUT_KEY') ? 'PAYOUT_KEY' : 'DEPLOYER_KEY', deployment.chainId, deployment)

const directory = await loadDirectory(client, deployment)
const views = await Promise.all(directory.communities.map((c) => validateCommunity(client, c, deployment)))
const targets = []
for (const view of views) {
  for (const vault of view.active) {
    if (!vault.forwarder) continue
    const trigger = deployment.kinds[vault.link.kind]!.payoutTrigger
    const target = { trigger, forwarder: vault.forwarder, vault: vault.vault }
    const preview = await previewPayout(client, sender.account.address, target.trigger, target.forwarder, target.vault)
    const detail = preview.status === 'ready' ? `${formatEther(preview.assets)} wstETH` : preview.status
    const name = view.active.length > 1 ? `${view.profile.name} ${shortAddress(vault.vault)}` : view.profile.name
    console.log(`${name.padEnd(24)} ${detail}`)
    if (preview.status === 'ready') targets.push(target)
  }
}

if (targets.length === 0) {
  console.log('\nNothing to send yet: Lido updates its rate once a day.')
} else {
  const hash = await sendAllPayouts(client, sender, targets)
  console.log(`\nSent ${targets.length} payout(s)  ${explorerTx(deployment, hash)}`)
}
