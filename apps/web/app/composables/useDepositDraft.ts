import type { InjectionKey, Ref } from 'vue'

/// The amount being typed into the deposit form, in the vault type's value unit, so the money diagram can
/// draw it before it's sent. The community page provides it; the form writes it and the diagram reads it.
const key: InjectionKey<Ref<bigint | undefined>> = Symbol('deposit-draft')

export function provideDepositDraft(): Ref<bigint | undefined> {
  const draft = ref<bigint>()
  provide(key, draft)
  return draft
}

/// Outside a community page there is nothing to draw, so writes go to a throwaway ref.
export function useDepositDraft(): Ref<bigint | undefined> {
  return inject(key, () => ref<bigint>(), true)
}
