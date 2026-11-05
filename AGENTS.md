# Repo rules

## Amounts in the UI

- Keep token amounts as `bigint` base units end to end (wei for 18-decimal tokens), and keep each amount with its `Unit` (`{ symbol, decimals }` from `packages/core/src/format.ts`). Get units from the vault type (`valueUnit`, `assetUnit`) or the chain (`nativeUnit`), never by assuming 18 decimals. Use floats only inside the display formatters in `packages/core/src/format.ts`.
- Never show a rounded amount on its own. Render amounts with `<TokenAmount :value :unit>` (`apps/web/app/components/TokenAmount.vue`); add `approx` for headline figures. It shows the rounded value and the exact one on hover.
- Amount inputs and their Max button use the exact value (`formatUnits` with the unit's decimals), never a rounded one. Parse typed amounts with `parseAmount(text, decimals)`, which rejects more decimals than the token has instead of rounding. Balances beside a field are amounts like any other: rounded through `<TokenAmount>`, exact on hover; Max fills the exact value into the field.
- Exceptions: button labels and toasts may use `formatAmount(value, decimals)` directly, because they can't be hovered and the exact amount is already visible in the input.
