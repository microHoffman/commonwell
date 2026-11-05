import type { VaultKindId } from '../../packages/core/src/index.ts'
import { lidoWstethV1 } from './lido-wsteth-v1.ts'
import type { ScriptKind } from './types.ts'

/// One entry per vault type in packages/core/src/kinds/; typechecking fails when one is missing.
export const scriptKinds: Record<VaultKindId, ScriptKind> = {
  'lido-wsteth-v1': lidoWstethV1,
}

export type { DeployContext, ScriptKind } from './types.ts'
