import type { AbiEvent, Address, GetLogsParameters, GetLogsReturnType, PublicClient } from 'viem'

/// getLogs in block ranges. Providers cap ranges differently (and change their caps), so the range
/// starts large and halves whenever the RPC rejects a request.
export async function getLogsChunked<const TEvent extends AbiEvent>(
  client: PublicClient,
  params: {
    address: Address | Address[]
    event: TEvent
    args?: GetLogsParameters<TEvent>['args']
    fromBlock: bigint
    toBlock?: bigint
  },
  initialChunk = 50_000n,
): Promise<GetLogsReturnType<TEvent>> {
  const toBlock = params.toBlock ?? (await client.getBlockNumber())
  const logs: GetLogsReturnType<TEvent> = []
  let chunk = initialChunk
  let from = params.fromBlock
  while (from <= toBlock) {
    const to = from + chunk - 1n < toBlock ? from + chunk - 1n : toBlock
    try {
      const page = await client.getLogs({
        address: params.address,
        event: params.event,
        args: params.args,
        fromBlock: from,
        toBlock: to,
      } as GetLogsParameters<TEvent>)
      logs.push(...(page as GetLogsReturnType<TEvent>))
      from = to + 1n
    } catch (error) {
      if (chunk <= 100n) throw error
      chunk /= 2n
    }
  }
  return logs
}
