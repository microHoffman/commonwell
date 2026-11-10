import { getKind } from '@commonwell/core'
import { isAddress, type Address } from 'viem'

/// A vault this browser saw the wallet deposit into: enough to read the position and withdraw straight from
/// the chain. `name` is the community's, for the row.
export type RememberedVault = { chainId: number; vault: Address; kind: string; name?: string }

const storageKey = (account: string) => `commonwell:vaults:${account.toLowerCase()}`
const sameVault = (a: RememberedVault, b: RememberedVault) => a.chainId === b.chainId && a.vault.toLowerCase() === b.vault.toLowerCase()

function read(account: string): RememberedVault[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(storageKey(account)) ?? '[]')
    return Array.isArray(list)
      ? list.filter((v): v is RememberedVault => typeof v?.chainId === 'number' && isAddress(v?.vault) && getKind(v?.kind) !== undefined)
      : []
  } catch {
    return []
  }
}

/// The vaults the connected wallet deposited into, remembered in this browser, so My deposits can still list
/// them and withdraw when the community directory can't be read. A convenience only: storage can be blocked
/// or cleared, and then the list is empty.
export function useRememberedVaults() {
  const { address } = useWallet()
  const vaults = ref<RememberedVault[]>([])
  watch(address, (account) => (vaults.value = account ? read(account) : []), { immediate: true })

  function remember(entries: RememberedVault[]) {
    const account = address.value
    if (!account) return
    const next = [...vaults.value]
    let changed = false
    for (const entry of entries) {
      const i = next.findIndex((v) => sameVault(v, entry))
      if (i === -1) next.push(entry)
      else if (entry.name && next[i]!.name !== entry.name) next[i] = { ...next[i]!, name: entry.name }
      else continue
      changed = true
    }
    if (!changed) return
    vaults.value = next
    try {
      localStorage.setItem(storageKey(account), JSON.stringify(next))
    } catch {
      // Storage blocked: the list lasts for this page only.
    }
  }

  return { vaults: readonly(vaults), remember }
}
