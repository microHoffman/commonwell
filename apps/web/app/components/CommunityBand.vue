<script setup lang="ts">
/// A community's colour band: a few circles and half circles from the shared palette, laid out from its
/// name, so every community gets its own band without uploading anything.
const props = defineProps<{ seed: string }>()

const inks = ['#1f4d3a', '#4f7a36', '#9db88a', '#c98a3d', '#e3eee6']

// A small deterministic PRNG (mulberry32), seeded from the name.
const shapes = computed(() => {
  let state = [...props.seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 2166136261)
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T,>(list: T[]) => list[Math.floor(next() * list.length)]!
  // Ground is one of the two greens or ochre; the shapes avoid the ground's own ink.
  const ground = pick(inks.slice(0, 2).concat(inks[3]!))
  const others = inks.filter((ink) => ink !== ground)
  const big = Array.from({ length: 3 }, (_, i) => ({
    cx: 60 + i * 340 + next() * 200,
    cy: next() < 0.5 ? 0 : 96,
    r: 50 + next() * 40,
    fill: pick(others.slice(0, 3)),
  }))
  const halves = Array.from({ length: 2 }, (_, i) => {
    const x = 200 + i * 360 + next() * 120
    const top = next() < 0.5
    const r = 36 + next() * 14
    return { d: top ? `M${x - r} 0 a${r} ${r} 0 0 0 ${2 * r} 0z` : `M${x - r} 96 a${r} ${r} 0 0 1 ${2 * r} 0z`, fill: pick(others) }
  })
  const dots = Array.from({ length: 3 }, () => ({ cx: 80 + next() * 640, cy: 18 + next() * 60, r: 4 + next() * 5 }))
  return { ground, big, halves, dots }
})
</script>

<template>
  <svg viewBox="0 0 800 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="block size-full">
    <rect width="800" height="96" :fill="shapes.ground" />
    <circle v-for="(c, i) in shapes.big" :key="`c${i}`" :cx="c.cx" :cy="c.cy" :r="c.r" :fill="c.fill" />
    <path v-for="(h, i) in shapes.halves" :key="`h${i}`" :d="h.d" :fill="h.fill" />
    <circle v-for="(d, i) in shapes.dots" :key="`d${i}`" :cx="d.cx" :cy="d.cy" :r="d.r" fill="#e3eee6" opacity="0.9" />
  </svg>
</template>
