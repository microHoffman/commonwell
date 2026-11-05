<script setup lang="ts">
import { formatApprox, formatPercent, getKind, kindCopy, valueUnit, yearlyYield, type VaultView } from '@yield-forward/core'

/// Where the yield goes, drawn: deposits rest in the basin and stay the depositors', the yield they generate
/// rises to the surface (bubbles that open into ripples), and droplets carry it over the rim and down the
/// stream to the community. The visitor's own deposit and the amount they're typing are slices of the basin,
/// to scale, and each sends its own particle up and out.
const props = defineProps<{ view: VaultView; communityName: string }>()

const unit = computed(() => valueUnit(props.view.link.kind))
const copy = computed(() => kindCopy(props.view.link.kind))
const aprSource = computed(() => getKind(props.view.link.kind)?.aprSource)
const payouts = usePayouts(() => props.view)
const apr = useApr(() => props.view)
const { preview, value: ready } = usePayoutPreview(() => props.view)
const { isConnected } = useWallet()
const positions = usePositions(() => [props.view])
const draft = useDepositDraft()

const staked = computed(() => props.view.state?.depositorValue ?? 0n)
const donated = computed(() => totalDonated(payouts.data.value))
const yours = computed(() => (isConnected.value ? (positions.data.value?.[0]?.value ?? 0n) : 0n))
const adding = computed(() => (draft.value && draft.value > 0n ? draft.value : 0n))

// The basin's inner width in diagram units, and each slice's share of it. A slice never drops below a
// sliver, so a small deposit still shows.
const BASIN_LEFT = 24
const BASIN_RIGHT = 430
const BASIN = BASIN_RIGHT - BASIN_LEFT
function width(part: bigint, whole: bigint): number {
  if (part <= 0n || whole <= 0n) return 0
  const share = Number((part * 10_000n) / whole) / 10_000
  return Math.max(3, Math.min(BASIN, share * BASIN))
}
const whole = computed(() => staked.value + adding.value)
const yoursWidth = computed(() => width(yours.value, whole.value))
const addingWidth = computed(() => Math.min(width(adding.value, whole.value), BASIN - yoursWidth.value))
// The Deposited label sits in the basin's open leaf area; once the slices reach into it, it moves above the
// basin's left rim (mirroring Ready to pay out on the right), so it never covers a slice.
const crowded = computed(() => yoursWidth.value + addingWidth.value > 70)

// The amount ready to pay out, when there is one to show (zero counts); otherwise a word or a dash.
const readyValue = computed(() => (preview.value?.status === 'ready' ? (ready.value ?? 0n) : preview.value?.status === 'nothing' ? 0n : undefined))
const readyLabel = computed(() => {
  switch (preview.value?.status) {
    case 'paused-loss':
      return 'Paused'
    case 'no-deposits':
    case 'error':
      return '—'
    default:
      return '…'
  }
})
const readyHint = computed(() => {
  switch (preview.value?.status) {
    case 'ready':
      return `Earned since the last payout and waiting to be sent to ${props.communityName}. Anyone can send it.`
    case 'nothing':
      return `Nothing yet. ${copy.value.yieldCadence}`
    case 'paused-loss':
      return `Payouts resume when ${copy.value.recovery}.`
    case 'no-deposits':
      return 'Payouts start after the first deposit.'
    case 'error':
      return "Couldn't check right now."
    default:
      return undefined
  }
})
// Short form for the pill; the type's full rate name and its source sit behind the info icon.
const aprLabel = computed(() => (apr.data.value ? `${formatPercent(apr.data.value)} APR` : undefined))
const aprTip = computed(() => [copy.value.rateLabel, aprSource.value].filter(Boolean).join(': '))
// The whole vault's yearly yield, including the amount being typed, so the figure moves as you type.
const vaultPerYear = computed(() => (apr.data.value && whole.value > 0n ? yearlyYield(whole.value, apr.data.value) : undefined))
// Dust already reads "< 0.0001", so it doesn't also get "≈".
const vaultPerYearIsDust = computed(() => vaultPerYear.value !== undefined && formatApprox(vaultPerYear.value, unit.value.decimals).startsWith('<'))

// Your share of the vault, now and with the amount being typed.
function percentOf(part: bigint, total: bigint): number {
  return total > 0n ? Number((part * 1_000_000n) / total) / 10_000 : 0
}
function percentLabel(p: number): string {
  if (p > 0 && p < 0.1) return '< 0.1%'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(p)}%`
}
const deltaLabel = (p: number) => (p > 0 && p < 0.1 ? '+<0.1%' : `+${percentLabel(p)}`)
const shareNow = computed(() => percentOf(yours.value, staked.value))
const shareAfter = computed(() => percentOf(yours.value + adding.value, whole.value))
const barYours = computed(() => percentOf(yours.value, whole.value))
const barAdding = computed(() => percentOf(adding.value, whole.value))

// The flow only moves when there's something in the basin to generate yield.
const flowing = computed(() => staked.value > 0n || adding.value > 0n)
const STREAM_TAIL = 'C520 54 556 152 640 158'
const STREAM = `M428 54 ${STREAM_TAIL}`
const RIM = `M380 56 C400 56 418 55 428 54 ${STREAM_TAIL}`
// A particle rising out of a slice, over the rim and down the stream; x only ever increases.
const riseFrom = (x: number) => `M${x.toFixed(1)} 240 C${x.toFixed(1)} 180 ${(x + 2).toFixed(1)} 100 428 56 ${STREAM_TAIL}`
const yoursCentre = computed(() => BASIN_RIGHT - yoursWidth.value / 2)
const addingCentre = computed(() => BASIN_RIGHT - yoursWidth.value - addingWidth.value / 2)
// A long strip of waves that slides under a clip, so the surface moves without the basin changing shape.
const waveStrip = (y: number, amp: number, wl: number) =>
  `M-200 ${y} ${Array.from({ length: 16 }, (_, i) => `q${wl / 2} ${i % 2 ? amp : -amp} ${wl} 0`).join(' ')} V64 H-200 Z`
// The flow can be paused (WCAG 2.2.2), and it also rests while the diagram is off-screen.
const root = ref<HTMLElement>()
const picture = ref<SVGSVGElement>()
const userPaused = ref(false)
const onScreen = ref(true)
const paused = computed(() => userPaused.value || !onScreen.value)
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => (onScreen.value = entry?.isIntersecting ?? true))
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
// CSS animations pause through a class; the SVG droplets have their own clock.
watch(paused, (p) => (p ? picture.value?.pauseAnimations() : picture.value?.unpauseAnimations()))
const bubbles = [
  { x: 80, dur: 4.8, delay: 0 },
  { x: 160, dur: 5.5, delay: 0.8 },
  { x: 240, dur: 6.2, delay: 1.6 },
  { x: 320, dur: 4.8, delay: 2.4 },
  { x: 120, dur: 5.5, delay: 3.2 },
  { x: 280, dur: 6.2, delay: 4.0 },
]
</script>

<template>
  <section
    ref="root"
    class="@container relative overflow-hidden rounded-[1.5rem] bg-(--yf-flow) p-5 text-white sm:p-7"
    :class="paused && 'is-paused'"
    style="--ui-bg-elevated: #2b5e47"
  >
    <div class="relative flex items-center justify-between gap-3">
      <h2 class="font-semibold">Where the yield goes</h2>
      <button
        v-if="flowing"
        type="button"
        class="-m-1.5 inline-flex rounded-full p-1.5 text-(--yf-flow-text) transition-colors hover:bg-white/10 hover:text-white motion-reduce:hidden"
        :aria-label="userPaused ? 'Play the animation' : 'Pause the animation'"
        @click="userPaused = !userPaused"
      >
        <UIcon :name="userPaused ? 'i-lucide-play' : 'i-lucide-pause'" class="size-4" />
      </button>
    </div>

    <div class="relative mt-14 aspect-[800/280] @xl:mt-12">
      <svg ref="picture" viewBox="0 0 800 280" class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <!-- What you're adding is hatched: ochre stripes over the basin, so it reads as not there yet. -->
          <pattern id="mf-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2.6" height="7" fill="#e0ab5f" />
          </pattern>
          <clipPath id="mf-basin">
            <path d="M24 60 H430 V214 Q430 268 376 268 H78 Q24 268 24 214 Z" />
          </clipPath>
          <clipPath id="mf-surface">
            <rect x="24" y="20" width="406" height="44" />
          </clipPath>
        </defs>
        <path d="M24 60 H430 V214 Q430 268 376 268 H78 Q24 268 24 214 Z" class="fill-leaf" :class="!flowing && 'opacity-40'" />
        <g clip-path="url(#mf-basin)">
          <rect
            class="slice"
            y="60"
            height="210"
            fill="#c98a3d"
            :x="BASIN_RIGHT - yoursWidth"
            :width="yoursWidth"
            :style="{ x: `${BASIN_RIGHT - yoursWidth}px`, width: `${yoursWidth}px` }"
          />
          <rect
            class="slice"
            y="62"
            height="206"
            fill="url(#mf-hatch)"
            stroke="#e0ab5f"
            stroke-width="2"
            stroke-dasharray="5 4"
            :x="BASIN_RIGHT - yoursWidth - addingWidth"
            :width="addingWidth"
            :style="{ x: `${BASIN_RIGHT - yoursWidth - addingWidth}px`, width: `${addingWidth}px` }"
          />
          <!-- Yield being generated: bubbles rise from the deposits... -->
          <template v-if="flowing">
            <circle
              v-for="b in bubbles"
              :key="b.x"
              class="motion bubble"
              :cx="b.x"
              cy="262"
              r="3"
              fill="#b9d3a8"
              :style="{ animationDuration: `${b.dur}s`, animationDelay: `-${b.delay}s` }"
            />
          </template>
        </g>

        <!-- The surface: two layers of slow waves, or a still line when motion is reduced. -->
        <g v-if="flowing" class="motion" clip-path="url(#mf-surface)">
          <g class="wave wave-back"><path :d="waveStrip(44, 5, 70)" fill="#b9d3a8" /></g>
          <g class="wave"><path :d="waveStrip(48, 4, 84)" class="fill-sage" /></g>
        </g>
        <path class="still" :class="!flowing && 'inline!'" d="M24 48 Q110 40 200 48 T370 48 T430 48 V62 H24 Z" fill="#9db88a" />
        <!-- ...and open into ripples on the surface. -->
        <template v-if="flowing">
          <ellipse
            v-for="b in bubbles"
            :key="`r${b.x}`"
            class="motion ripple"
            :cx="b.x"
            cy="52"
            rx="8"
            ry="2.4"
            fill="none"
            stroke="#e8f2df"
            stroke-width="1.4"
            :style="{ animationDuration: `${b.dur}s`, animationDelay: `-${b.delay}s` }"
          />
        </template>

        <path :d="STREAM" fill="none" class="stroke-sage" stroke-width="13" stroke-linecap="round" />

        <!-- Droplets leave the rim for the community; your deposit and what you're adding each send their own. -->
        <g v-if="flowing" class="motion">
          <circle v-for="i in 3" :key="`d${i}`" r="0" fill="#e8f2df" opacity="0">
            <animateMotion dur="3.6s" :begin="`-${(i - 1) * 1.2}s`" repeatCount="indefinite" :path="RIM" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.42 0 0.58 1" />
            <animate attributeName="r" dur="3.6s" :begin="`-${(i - 1) * 1.2}s`" repeatCount="indefinite" values="0;3.2;3.2;1.6" keyTimes="0;0.22;0.88;1" />
            <animate attributeName="opacity" dur="3.6s" :begin="`-${(i - 1) * 1.2}s`" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.2;0.9;1" />
          </circle>
          <circle v-if="yoursWidth" r="0" fill="#e0ab5f" stroke="#fff" stroke-width="1.2" opacity="0">
            <animateMotion dur="6s" begin="-1s" repeatCount="indefinite" :path="riseFrom(yoursCentre)" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.42 0 0.58 1" />
            <animate attributeName="r" dur="6s" begin="-1s" repeatCount="indefinite" values="0;4;4;2" keyTimes="0;0.22;0.88;1" />
            <animate attributeName="opacity" dur="6s" begin="-1s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.2;0.9;1" />
          </circle>
          <circle v-if="addingWidth" r="0" fill="none" stroke="#e0ab5f" stroke-width="1.6" stroke-dasharray="2 2" opacity="0">
            <animateMotion dur="6s" begin="-4s" repeatCount="indefinite" :path="riseFrom(addingCentre)" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.42 0 0.58 1" />
            <animate attributeName="r" dur="6s" begin="-4s" repeatCount="indefinite" values="0;4;4;2" keyTimes="0;0.22;0.88;1" />
            <animate attributeName="opacity" dur="6s" begin="-4s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.2;0.9;1" />
          </circle>
        </g>

        <circle cx="700" cy="158" r="60" fill="#c98a3d" />
      </svg>

      <!-- Narrow: just the amounts, scaled with the picture and never below a readable size. -->
      <div class="font-semibold tracking-tight @xl:hidden">
        <span
          class="absolute text-[max(0.9375rem,4.4cqw)]"
          :class="crowded ? 'left-0 top-0 -translate-y-full pb-2' : 'left-[5.5%] top-[50%] rounded-lg bg-leaf px-2 py-0.5'"
          style="--ui-bg-elevated: #3f6a2a"
        >
          <span v-if="crowded" class="block text-xs font-normal tracking-normal text-(--yf-flow-text)">Deposited</span>
          <TokenAmount :value="staked" :unit="unit" approx />
        </span>
        <span class="absolute right-0 top-0 -translate-y-full pb-2 text-right text-[max(0.9375rem,4cqw)]">
          <span class="block text-xs font-normal tracking-normal text-(--yf-flow-text)">Ready to pay out</span>
          <TokenAmount v-if="readyValue !== undefined" :value="readyValue" :unit="unit" approx />
          <template v-else>{{ readyLabel }}</template>
        </span>
        <span class="absolute left-[87.5%] top-[81%] -translate-x-1/2 whitespace-nowrap text-[max(0.9375rem,4cqw)]">
          <TokenAmount :value="donated" :unit="unit" approx />
        </span>
      </div>

      <!-- Wide: every figure sits on the part of the picture it describes. -->
      <div class="hidden @xl:block">
        <div
          class="absolute"
          :class="crowded ? 'left-0 top-0 -translate-y-[38%]' : 'left-[5.5%] top-[36%] rounded-xl bg-leaf px-3 py-1.5'"
          style="--ui-bg-elevated: #3f6a2a"
        >
          <p class="text-sm" :class="crowded ? 'mb-1 text-(--yf-flow-text)' : 'text-white'">Deposited</p>
          <p class="mt-0.5 flex items-center gap-2.5">
            <span class="text-3xl font-semibold tracking-tight"><TokenAmount :value="staked" :unit="unit" approx /></span>
            <span v-if="aprLabel" class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
              {{ aprLabel }}
              <UTooltip v-if="aprTip" :text="aprTip"><button type="button" :aria-label="aprTip" class="inline-flex text-white/80 hover:text-white"><UIcon name="i-lucide-info" class="size-3.5" /></button></UTooltip>
            </span>
          </p>
        </div>
        <div class="absolute right-0 top-0 -translate-y-[38%] text-right">
          <p class="mb-1 flex items-center justify-end gap-1 text-sm text-(--yf-flow-text)">
            Ready to pay out
            <UTooltip v-if="readyHint" :text="readyHint" :ui="{ content: 'h-auto max-w-64 py-1.5', text: 'whitespace-normal' }">
              <button type="button" :aria-label="readyHint" class="inline-flex text-(--yf-flow-text) hover:text-white">
                <UIcon name="i-lucide-info" class="size-3.5" />
              </button>
            </UTooltip>
          </p>
          <p class="text-3xl font-semibold tracking-tight">
            <TokenAmount v-if="readyValue !== undefined" :value="readyValue" :unit="unit" approx />
            <template v-else>{{ readyLabel }}</template>
          </p>
        </div>
        <p class="absolute left-[87.5%] top-[56.4%] -translate-x-1/2 -translate-y-1/2 text-center text-forest-950" style="--ui-bg-elevated: #e0ab5f">
          <span class="mb-0.5 block text-sm font-medium">Donated</span>
          <span class="block text-lg font-semibold leading-tight"><TokenAmount :value="donated" :unit="unit" approx /></span>
        </p>
      </div>

      <!-- The slices' edges again, above the labels, so a label chip never hides where a slice begins. -->
      <svg viewBox="0 0 800 280" class="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <g clip-path="url(#mf-basin)" fill="none" stroke-width="2">
          <rect v-if="yoursWidth" class="slice" y="61" height="208" stroke="#e0ab5f" :x="BASIN_RIGHT - yoursWidth" :width="yoursWidth" :style="{ x: `${BASIN_RIGHT - yoursWidth}px`, width: `${yoursWidth}px` }" />
          <rect
            v-if="addingWidth"
            class="slice"
            y="62"
            height="206"
            stroke="#e0ab5f"
            stroke-dasharray="5 4"
            :x="BASIN_RIGHT - yoursWidth - addingWidth"
            :width="addingWidth"
            :style="{ x: `${BASIN_RIGHT - yoursWidth - addingWidth}px`, width: `${addingWidth}px` }"
          />
        </g>
      </svg>
    </div>

    <!-- Your share of the vault: the slices again, as one bar you can read at a glance. -->
    <div v-if="yours || adding" class="relative mt-5">
      <p class="text-sm @xl:text-[0.9375rem]">
        <template v-if="adding">
          You'd hold <b class="font-semibold">{{ percentLabel(shareAfter) }}</b> of this vault
          <span v-if="yours" class="text-(--yf-flow-text)">· {{ percentLabel(shareNow) }} now, {{ deltaLabel(shareAfter - shareNow) }} with this deposit</span>
        </template>
        <template v-else>You hold <b class="font-semibold">{{ percentLabel(shareNow) }}</b> of this vault</template>
      </p>
      <div class="mt-2 flex h-2.5 overflow-hidden rounded-full bg-leaf" aria-hidden="true">
        <span class="h-full" :style="{ width: `${100 - barYours - barAdding}%` }" />
        <span class="slice-bar h-full bg-ochre-500" :style="{ width: `${barYours}%` }" />
        <span class="slice-bar hatch h-full" :style="{ width: `${barAdding}%` }" />
      </div>
    </div>

    <!-- The key. On narrow cards it also names the amounts sitting on the picture. -->
    <ul class="relative mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-(--yf-flow-text)">
      <li class="flex items-baseline gap-1.5 @xl:hidden">
        <span class="size-2.5 shrink-0 translate-y-px rounded-[3px] bg-leaf ring-1 ring-white/30" />
        <span>
          Deposited<template v-if="aprLabel"> · {{ aprLabel }}</template>
          <UTooltip v-if="aprTip && aprLabel" :text="aprTip"><button type="button" :aria-label="aprTip" class="ml-1 inline-flex align-[-0.125em] hover:text-white"><UIcon name="i-lucide-info" class="size-3.5" /></button></UTooltip>
        </span>
      </li>
      <li class="flex items-center gap-1.5 @xl:hidden"><span class="size-2.5 rounded-[3px] bg-sage" />Ready to pay out</li>
      <li class="flex items-center gap-1.5 @xl:hidden"><span class="size-2.5 rounded-full bg-ochre-500" />Donated so far</li>
      <li v-if="yours" class="flex items-center gap-1.5">
        <span class="size-3 rounded-[3px] bg-ochre-500" />Your deposit <b class="font-semibold text-white">≈ <TokenAmount :value="yours" :unit="unit" approx /></b>
      </li>
      <li v-if="adding" class="flex items-center gap-1.5">
        <svg viewBox="0 0 12 12" class="size-3 shrink-0 rounded-[3px]" aria-hidden="true"><rect width="12" height="12" fill="#4f7a36" /><path d="M-3 3 L3 -3 M-3 9 L9 -3 M-3 15 L15 -3 M3 15 L15 3 M9 15 L15 9" stroke="#e0ab5f" stroke-width="1.6" /><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2" fill="none" stroke="#e0ab5f" stroke-width="1.5" stroke-dasharray="2.5 2" /></svg>
        Adding <b class="font-semibold text-white"><TokenAmount :value="adding" :unit="unit" approx /></b>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="size-3 shrink-0 translate-y-0.5 rounded-[3px] bg-sage" />
        <span class="text-pretty">
          <template v-if="vaultPerYear">Yield on all deposits <b class="font-semibold text-white"><template v-if="!vaultPerYearIsDust">≈ </template><TokenAmount :value="vaultPerYear" :unit="unit" approx /></b> a year to {{ communityName }}</template>
          <template v-else>Yield, sent on to {{ communityName }}</template>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.slice {
  transition:
    x 200ms cubic-bezier(0.16, 1, 0.3, 1),
    width 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.slice-bar {
  transition: width 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.hatch {
  background: #4f7a36 repeating-linear-gradient(45deg, #e0ab5f 0 1.6px, transparent 1.6px 4px);
  box-shadow: inset 0 0 0 1.5px #e0ab5f;
}
.still {
  display: none;
}
.wave {
  animation: wave 7s linear infinite;
}
.wave-back {
  animation-duration: 11s;
  animation-direction: reverse;
  opacity: 0.9;
}
@keyframes wave {
  to {
    transform: translateX(-168px);
  }
}
.bubble {
  animation: rise 5.5s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}
@keyframes rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  15% {
    opacity: 0.85;
  }
  88% {
    opacity: 0.85;
  }
  100% {
    transform: translateY(-206px);
    opacity: 0;
  }
}
.ripple {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: ripple 5.5s ease-out infinite;
}
@keyframes ripple {
  0%,
  88% {
    transform: scale(0.3);
    opacity: 0;
  }
  91% {
    opacity: 0.9;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}
.is-paused .wave,
.is-paused .bubble,
.is-paused .ripple {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .slice,
  .slice-bar {
    transition: none;
  }
  .motion {
    display: none;
  }
  .still {
    display: inline;
  }
}
</style>
