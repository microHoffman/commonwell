import { useQueryClient } from '@tanstack/vue-query'
import { BaseError, UserRejectedRequestError } from 'viem'

export function isUserRejection(error: unknown): boolean {
  if (error instanceof BaseError) return Boolean(error.walk((e) => e instanceof UserRejectedRequestError))
  return error instanceof Error && /reject|denied|cancel/i.test(error.message)
}

export function errorMessage(error: unknown): string {
  if (isUserRejection(error)) return 'Cancelled in your wallet.'
  if (error instanceof BaseError) return error.shortMessage
  return error instanceof Error ? error.message : String(error)
}

/// Runs a wallet action with a pending flag and toasts, then refreshes every query.
export function useTx() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const pending = ref(false)

  async function run<T>(success: string, action: () => Promise<T>): Promise<T | undefined> {
    pending.value = true
    try {
      const result = await action()
      toast.add({ title: success, color: 'success', icon: 'i-lucide-check' })
      return result
    } catch (error) {
      toast.add({ title: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
      return undefined
    } finally {
      pending.value = false
      await queryClient.invalidateQueries()
    }
  }

  return { run, pending }
}

export function explorerUrl(chainId: number, path: string): string {
  return `${useDeployment(chainId).explorer}/${path}`
}
