import { chainFor, chainLabel, type Deployment, type Wallet } from '@commonwell/core'
import { getWalletClient, switchChain } from '@wagmi/core'
import { useConfig, useConnection } from '@wagmi/vue'
import { createPublicClient, fallback, http, numberToHex, type PublicClient } from 'viem'

const files = import.meta.glob<Deployment>('../../../../deployments/*.json', { eager: true, import: 'default' })

let deployments: Deployment[] | undefined

/// The deployments this build reads (NUXT_PUBLIC_DEPLOYMENTS, comma-separated deployments/<name>.json),
/// one chain each. The first is the default chain.
export function useDeployments(): Deployment[] {
  if (deployments) return deployments
  const names = String(useRuntimeConfig().public.deployments)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  const list = names.map((name) => {
    const deployment = Object.entries(files).find(([path]) => path.endsWith(`/${name}.json`))?.[1]
    if (!deployment) throw new Error(`deployments/${name}.json is missing. Run \`bun run deploy:core --deployment ${name}\`.`)
    return deployment
  })
  if (list.length === 0) throw new Error('No deployment is configured. Set NUXT_PUBLIC_DEPLOYMENTS.')
  const chains = list.map((d) => d.chainId)
  if (new Set(chains).size !== chains.length) throw new Error('Each deployment must be on a different chain.')
  deployments = list
  return list
}

export function useDeployment(chainId: number): Deployment {
  const deployment = useDeployments().find((d) => d.chainId === chainId)
  if (!deployment) throw new Error(`No deployment on chain ${chainId}`)
  return deployment
}

/// Whether the build reads more than one chain; the UI names chains only then.
export function useMultichain(): boolean {
  return useDeployments().length > 1
}

/// NUXT_PUBLIC_RPC_URLS overrides a deployment's public RPCs: `560048=https://a,https://b;1=https://c`.
/// A plain comma-separated list applies to the default chain.
function rpcUrlsFor(deployment: Deployment): string[] {
  const configured = String(useRuntimeConfig().public.rpcUrls || '').trim()
  for (const entry of configured.split(';').map((e) => e.trim()).filter(Boolean)) {
    const [chain, urls] = entry.includes('=') ? entry.split('=', 2) : [String(useDeployments()[0]!.chainId), entry]
    if (Number(chain) !== deployment.chainId) continue
    const list = urls!.split(',').map((u) => u.trim()).filter(Boolean)
    if (list.length > 0) return list
  }
  return deployment.rpcUrls
}

const publicClients = new Map<number, PublicClient>()

/// Reads go through our own clients (public RPCs with fallback), not through the wallet.
export function usePublicClient(chainId: number): PublicClient {
  let client = publicClients.get(chainId)
  if (!client) {
    client = createPublicClient({
      chain: chainFor(chainId),
      transport: fallback(rpcUrlsFor(useDeployment(chainId)).map((url) => http(url))),
    }) as PublicClient
    publicClients.set(chainId, client)
  }
  return client
}

export function useWeb3AuthConfig() {
  const config = useRuntimeConfig().public
  const list = useDeployments()
  return {
    web3AuthOptions: {
      disableAnalytics: true,
      clientId: String(config.web3AuthClientId),
      web3AuthNetwork: String(config.web3AuthNetwork) as 'sapphire_devnet',
      // Skip Web3Auth's sign-in-with-wallet check after an external wallet connects: its server rejects
      // Hoodi ("Chain does not exist"), and nothing here uses the token it issues.
      initialAuthenticationMode: 'connect-only' as const,
      defaultChainId: numberToHex(list[0]!.chainId),
      chains: list.map((deployment) => {
        const chain = chainFor(deployment.chainId)
        const [rpcTarget, ...fallbackRpcTargets] = rpcUrlsFor(deployment)
        return {
          chainNamespace: 'eip155' as const,
          chainId: numberToHex(chain.id),
          rpcTarget: rpcTarget!,
          fallbackRpcTargets,
          displayName: chainLabel(chain.id),
          blockExplorerUrl: deployment.explorer,
          ticker: chain.nativeCurrency.symbol,
          tickerName: chain.nativeCurrency.name,
          logo: `${window.location.origin}/icon.svg`,
          isTestnet: chain.testnet ?? false,
          decimals: chain.nativeCurrency.decimals,
        }
      }),
    },
  }
}

/// The connected wallet. `getWallet(chainId)` switches to that chain first, so no transaction is
/// ever sent to the wrong network.
export function useWallet() {
  const list = useDeployments()
  const config = useConfig()
  const connection = useConnection()
  const address = computed(() => connection.address.value)
  const chainId = computed(() => connection.chainId.value)
  /// On a chain none of the deployments is on.
  const wrongNetwork = computed(() => connection.isConnected.value && !list.some((d) => d.chainId === chainId.value))

  async function getWallet(target: number): Promise<Wallet> {
    if (connection.chainId.value !== target) await switchChain(config, { chainId: target })
    return (await getWalletClient(config, { chainId: target })) as Wallet
  }

  return { address, chainId, isConnected: connection.isConnected, wrongNetwork, getWallet }
}
