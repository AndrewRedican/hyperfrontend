<script setup lang="ts">
import { computed } from 'vue'
import { wallTimeIn } from '../time/clock-time'

const props = defineProps<{
  /** Instant to display, in epoch milliseconds. */
  epochMs: number
  /** IANA timezone the dial reads in. */
  timezone: string
  /** Whether the second hand sweeps smoothly (off under reduced motion). */
  smooth: boolean
}>()

const wall = computed(() => wallTimeIn(props.epochMs, props.timezone))
const secondFraction = computed(() => (props.smooth ? (props.epochMs % 1000) / 1000 : 0))
const seconds = computed(() => wall.value.second + secondFraction.value)
const minutes = computed(() => wall.value.minute + seconds.value / 60)
const hours = computed(() => (wall.value.hour % 12) + minutes.value / 60)
const isDay = computed(() => wall.value.hour >= 6 && wall.value.hour < 18)

const NUMERALS = Array.from({ length: 12 }, (_, index) => {
  const angle = ((index + 1) * 30 - 90) * (Math.PI / 180)
  return { label: index + 1, x: 100 + 68 * Math.cos(angle), y: 100 + 68 * Math.sin(angle) }
})

const TICKS = Array.from({ length: 60 }, (_, index) => ({
  major: index % 5 === 0,
  angle: index * 6,
}))
</script>

<template>
  <svg class="analog-face" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="dial-metal" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#3d3a36" />
        <stop offset="55%" stop-color="#262421" />
        <stop offset="100%" stop-color="#161513" />
      </radialGradient>
    </defs>

    <circle cx="100" cy="100" r="94" fill="url(#dial-metal)" stroke="#4a453e" stroke-width="1.5" />

    <g stroke="#8a8378">
      <line
        v-for="tick in TICKS"
        :key="tick.angle"
        x1="100"
        :y1="tick.major ? 12 : 15"
        x2="100"
        y2="19"
        :stroke="tick.major ? '#fd7014' : '#8a8378'"
        :stroke-width="tick.major ? 2 : 0.75"
        :transform="`rotate(${tick.angle} 100 100)`"
      />
    </g>

    <text
      v-for="numeral in NUMERALS"
      :key="numeral.label"
      :x="numeral.x"
      :y="numeral.y"
      class="numeral"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ numeral.label }}
    </text>

    <g class="day-night" :opacity="0.9">
      <circle v-if="isDay" cx="100" cy="60" r="6" fill="#fd7014" />
      <path v-else d="M 104 54 a 6 6 0 1 0 2 11.5 a 7.5 7.5 0 0 1 -2 -11.5" fill="#c9c2b4" />
    </g>

    <g class="date-window">
      <rect x="88" y="130" width="24" height="15" rx="2.5" fill="#14120f" stroke="#4a453e" stroke-width="0.75" />
      <text x="100" y="138" class="date-text" text-anchor="middle" dominant-baseline="central">{{ wall.day }}</text>
    </g>

    <line
      x1="100"
      y1="108"
      x2="100"
      y2="58"
      stroke="#e8e2d6"
      stroke-width="5"
      stroke-linecap="round"
      :transform="`rotate(${hours * 30} 100 100)`"
    />
    <line
      x1="100"
      y1="112"
      x2="100"
      y2="36"
      stroke="#e8e2d6"
      stroke-width="3.25"
      stroke-linecap="round"
      :transform="`rotate(${minutes * 6} 100 100)`"
    />
    <line
      x1="100"
      y1="116"
      x2="100"
      y2="28"
      stroke="#fd7014"
      stroke-width="1.5"
      stroke-linecap="round"
      :transform="`rotate(${seconds * 6} 100 100)`"
    />

    <circle cx="100" cy="100" r="4.5" fill="#fd7014" stroke="#1a1815" stroke-width="1.5" />
  </svg>
</template>

<style scoped>
.analog-face {
  width: 100%;
  height: 100%;
  display: block;
}

.numeral {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 21px;
  fill: #e8e2d6;
}

.date-text {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 11px;
  fill: #fd7014;
}
</style>
