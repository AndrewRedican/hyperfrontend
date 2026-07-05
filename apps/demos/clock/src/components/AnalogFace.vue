<script setup lang="ts">
import { computed, ref } from 'vue'
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

const RADIANS = Math.PI / 180
const point = (radius: number, degrees: number): [number, number] => [
  100 + radius * Math.sin(degrees * RADIANS),
  100 - radius * Math.cos(degrees * RADIANS),
]
const rounded = (value: number): number => Number(value.toFixed(2))

// how: Sunray brushing — spoke brightness peaks along the 135° light axis.
const RAYS = Array.from({ length: 72 }, (_, index) => {
  const degrees = index * 5
  const [x1, y1] = point(14, degrees)
  const [x2, y2] = point(69.5, degrees)
  const alignment = Math.cos((degrees + 45) * RADIANS)
  return {
    x1: rounded(x1),
    y1: rounded(y1),
    x2: rounded(x2),
    y2: rounded(y2),
    opacity: Number((0.025 + 0.11 * alignment * alignment).toFixed(3)),
  }
})

const TRACK = Array.from({ length: 60 }, (_, index) => {
  const degrees = index * 6
  const major = index % 5 === 0
  const [x1, y1] = point(major ? 65.5 : 66.8, degrees)
  const [x2, y2] = point(69, degrees)
  return { x1: rounded(x1), y1: rounded(y1), x2: rounded(x2), y2: rounded(y2), major }
})

// note: Dive-bezel convention — per-minute graduations across the first quarter, five-minute marks beyond.
const BEZEL_MARKS = Array.from({ length: 59 }, (_, index) => index + 1)
  .filter((minute) => (minute <= 15 || minute % 5 === 0) && minute % 10 !== 0)
  .map((minute) => {
    const degrees = minute * 6
    const five = minute % 5 === 0
    const [x1, y1] = point(80.5, degrees)
    const [x2, y2] = point(84.5, degrees)
    return { x1: rounded(x1), y1: rounded(y1), x2: rounded(x2), y2: rounded(y2), five }
  })

// how: Numerals rotate with their position but flip through the lower arc to stay readable.
const BEZEL_NUMERALS = [10, 20, 30, 40, 50].map((minute) => {
  const degrees = minute * 6
  const [x, y] = point(80.8, degrees)
  return { minute, x: rounded(x), y: rounded(y), rotate: degrees > 100 && degrees < 260 ? degrees + 180 : degrees }
})

const KNURL = Array.from({ length: 96 }, (_, index) => {
  const degrees = index * 3.75
  const [x1, y1] = point(88.6, degrees)
  const [x2, y2] = point(97.8, degrees)
  return { x1: rounded(x1), y1: rounded(y1), x2: rounded(x2), y2: rounded(y2) }
})

const INDEX_DOTS = [1, 2, 4, 5, 7, 8, 10, 11].map((hour) => {
  const [x, y] = point(59, hour * 30)
  return { hour, x: rounded(x), y: rounded(y) }
})

const REHAUT_TEXT = 'HYPERFRONTEND · '.repeat(8).trim()

// how: The bezel turns bi-directionally by dragging its ring, clicking into 3° ratchet detents.
const DETENT_DEGREES = 3
// note: A press that travels less than this reads as a click, which steps one detent instead.
const CLICK_TRAVEL_DEGREES = 1.5
const bezelAngle = ref(0)
const face = ref<SVGSVGElement | null>(null)
let activePointer: number | null = null
let grabOffset = 0
let lastDegrees = 0
let dragTravel = 0

function pointerDegrees(event: PointerEvent): number {
  const rect = face.value?.getBoundingClientRect()
  if (!rect) {
    return 0
  }
  const x = event.clientX - (rect.left + rect.width / 2)
  const y = event.clientY - (rect.top + rect.height / 2)
  return Math.atan2(x, -y) / RADIANS
}

/** Steps the bezel one ratchet detent in either direction. */
function nudgeBezel(direction: 1 | -1): void {
  bezelAngle.value += direction * DETENT_DEGREES
}

defineExpose({ nudgeBezel })

function onBezelDown(event: PointerEvent): void {
  // why: only the primary pointer's main button may grab — a second finger or a right-click would corrupt the shared drag state.
  if (activePointer !== null || !event.isPrimary || event.button !== 0) {
    return
  }
  activePointer = event.pointerId
  lastDegrees = pointerDegrees(event)
  grabOffset = lastDegrees - bezelAngle.value
  dragTravel = 0
  ;(<Element>event.currentTarget).setPointerCapture(event.pointerId)
}

function onBezelMove(event: PointerEvent): void {
  if (event.pointerId !== activePointer) {
    return
  }
  const degrees = pointerDegrees(event)
  // how: Normalize the frame delta into (-180, 180] so crossing the atan2 seam never inflates the travel.
  dragTravel += Math.abs(((degrees - lastDegrees + 540) % 360) - 180)
  lastDegrees = degrees
  bezelAngle.value = Math.round((degrees - grabOffset) / DETENT_DEGREES) * DETENT_DEGREES
}

function onBezelUp(event: PointerEvent): void {
  if (event.pointerId !== activePointer) {
    return
  }
  activePointer = null
  // how: A stationary press ratchets one detent — clockwise from the right half, counter-clockwise from the left.
  if (dragTravel < CLICK_TRAVEL_DEGREES) {
    nudgeBezel(lastDegrees >= 0 ? 1 : -1)
  }
}

function onBezelCancel(event: PointerEvent): void {
  if (event.pointerId === activePointer) {
    activePointer = null
  }
}
</script>

<template>
  <svg ref="face" class="analog-face" :class="{ 'analog-face--night': !isDay }" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="lx-steel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f4f7fa" />
        <stop offset="35%" stop-color="#c3ccd6" />
        <stop offset="70%" stop-color="#79828e" />
        <stop offset="100%" stop-color="#dfe4ea" />
      </linearGradient>
      <linearGradient id="lx-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f9f5ea" />
        <stop offset="50%" stop-color="#d8cfb6" />
        <stop offset="100%" stop-color="#a89e83" />
      </linearGradient>
      <linearGradient id="lx-hand" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#eef2f6" />
        <stop offset="50%" stop-color="#aeb8c2" />
        <stop offset="100%" stop-color="#5f6873" />
      </linearGradient>
      <radialGradient id="lx-ceramic" cx="38%" cy="30%" r="85%">
        <stop offset="0%" stop-color="#1c2c4c" />
        <stop offset="60%" stop-color="#0d1830" />
        <stop offset="100%" stop-color="#060d1c" />
      </radialGradient>
      <radialGradient id="lx-dial" cx="50%" cy="50%" r="52%">
        <stop offset="0%" stop-color="#12315f" />
        <stop offset="62%" stop-color="#0b2350" />
        <stop offset="100%" stop-color="#081a3c" />
      </radialGradient>
      <linearGradient id="lx-dial-light" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7ba7e0" stop-opacity="0.30" />
        <stop offset="45%" stop-color="#7ba7e0" stop-opacity="0" />
        <stop offset="100%" stop-color="#000714" stop-opacity="0.30" />
      </linearGradient>
      <radialGradient id="lx-cyclops" cx="35%" cy="28%" r="80%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.20" />
        <stop offset="55%" stop-color="#cfe0ff" stop-opacity="0.06" />
        <stop offset="100%" stop-color="#12295a" stop-opacity="0.18" />
      </radialGradient>
      <radialGradient id="lx-dome" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.11" />
        <stop offset="70%" stop-color="#ffffff" stop-opacity="0.035" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="lx-gold-sun" cx="38%" cy="32%" r="80%">
        <stop offset="0%" stop-color="#f6dd96" />
        <stop offset="100%" stop-color="#c2a14a" />
      </radialGradient>
      <filter id="lx-drop" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.55" />
        <feOffset dx="0.5" dy="0.8" result="s" />
        <feFlood flood-color="#010615" flood-opacity="0.55" />
        <feComposite in2="s" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <path id="lx-rehaut-path" d="M 100 28.4 A 71.6 71.6 0 1 1 99.99 28.4" fill="none" />
    </defs>

    <circle cx="100" cy="100" r="99.3" fill="url(#lx-steel)" />
    <circle cx="100" cy="100" r="99.3" fill="none" stroke="#20262e" stroke-width="0.9" />

    <g
      class="bezel"
      :transform="`rotate(${bezelAngle} 100 100)`"
      @pointerdown.stop="onBezelDown"
      @pointermove="onBezelMove"
      @pointerup="onBezelUp"
      @pointercancel="onBezelCancel"
    >
      <circle cx="100" cy="100" r="98.2" fill="url(#lx-steel)" />
      <line
        v-for="(tooth, index) in KNURL"
        :key="index"
        :x1="tooth.x1"
        :y1="tooth.y1"
        :x2="tooth.x2"
        :y2="tooth.y2"
        stroke="#39404b"
        stroke-width="0.8"
        opacity="0.55"
      />
      <circle cx="100" cy="100" r="88.2" fill="none" stroke="#4b545f" stroke-width="0.7" />
      <circle cx="100" cy="100" r="87" fill="url(#lx-ceramic)" />
      <path d="M 34 45 A 87 87 0 0 1 100 13" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="4" />
      <line
        v-for="mark in BEZEL_MARKS"
        :key="`${mark.x1}-${mark.y1}`"
        :x1="mark.x1"
        :y1="mark.y1"
        :x2="mark.x2"
        :y2="mark.y2"
        stroke="#d9dfe7"
        :stroke-width="mark.five ? 1.5 : 0.7"
        opacity="0.9"
      />
      <text
        v-for="numeral in BEZEL_NUMERALS"
        :key="numeral.minute"
        :x="numeral.x"
        :y="numeral.y"
        class="bezel-numeral"
        text-anchor="middle"
        dominant-baseline="central"
        :transform="`rotate(${numeral.rotate} ${numeral.x} ${numeral.y})`"
      >
        {{ numeral.minute }}
      </text>
      <path d="M 95.2 15.4 L 104.8 15.4 L 100 24.8 Z" fill="#d9dfe7" />
      <circle cx="100" cy="18.6" r="1.9" class="lume" />
    </g>

    <circle cx="100" cy="100" r="74" fill="#0a1730" />
    <circle cx="100" cy="100" r="74" fill="none" stroke="#233a66" stroke-width="0.5" />
    <text class="rehaut" font-size="3.7" fill="#3d5c94" letter-spacing="1.1">
      <textPath href="#lx-rehaut-path">{{ REHAUT_TEXT }}</textPath>
    </text>

    <circle cx="100" cy="100" r="70" fill="url(#lx-dial)" />
    <g>
      <line
        v-for="(ray, index) in RAYS"
        :key="index"
        :x1="ray.x1"
        :y1="ray.y1"
        :x2="ray.x2"
        :y2="ray.y2"
        stroke="#a8c4ec"
        stroke-width="0.55"
        :opacity="ray.opacity"
      />
    </g>
    <circle cx="100" cy="100" r="70" fill="url(#lx-dial-light)" />
    <line
      v-for="(tick, index) in TRACK"
      :key="index"
      :x1="tick.x1"
      :y1="tick.y1"
      :x2="tick.x2"
      :y2="tick.y2"
      stroke="#bcc9de"
      :stroke-width="tick.major ? 1 : 0.5"
      opacity="0.85"
    />

    <text x="100" y="57" class="brand" text-anchor="middle">HYPERFRONTEND</text>
    <text x="100" y="63.5" class="motto" text-anchor="middle">PERPETUAL MICRO-FRONTEND</text>
    <text x="100" y="111" class="motto" text-anchor="middle">SUPERLATIVE COMPOSABILITY</text>
    <text x="100" y="116.5" class="motto" text-anchor="middle">OFFICIALLY EMBEDDED</text>

    <circle
      v-for="dot in INDEX_DOTS"
      :key="dot.hour"
      :cx="dot.x"
      :cy="dot.y"
      r="4.1"
      class="lume"
      stroke="url(#lx-gold)"
      stroke-width="1.7"
      filter="url(#lx-drop)"
    />
    <path d="M 91.8 31.5 L 108.2 31.5 L 100 47.5 Z" class="lume" stroke="url(#lx-gold)" stroke-width="1.8" filter="url(#lx-drop)" />
    <rect x="97.3" y="149" width="5.4" height="16" rx="0.9" class="lume" stroke="url(#lx-gold)" stroke-width="1.6" filter="url(#lx-drop)" />
    <rect x="35" y="97.3" width="16" height="5.4" rx="0.9" class="lume" stroke="url(#lx-gold)" stroke-width="1.6" filter="url(#lx-drop)" />

    <g class="day-night" filter="url(#lx-drop)">
      <circle cx="100" cy="131" r="7.7" fill="#050f22" />
      <g v-if="isDay">
        <circle cx="100" cy="131" r="4.1" fill="url(#lx-gold-sun)" />
      </g>
      <g v-else>
        <circle cx="97" cy="130" r="3.9" fill="#dfe5ec" />
        <circle cx="96" cy="129" r="0.8" fill="#b9c2cc" />
        <circle cx="98.3" cy="131.5" r="0.55" fill="#b9c2cc" />
        <circle cx="104.5" cy="127.5" r="0.5" fill="#e8eef6" />
        <circle cx="103.6" cy="133.8" r="0.4" fill="#e8eef6" />
        <circle cx="106" cy="131" r="0.35" fill="#e8eef6" />
      </g>
      <circle cx="100" cy="131" r="7.7" fill="none" stroke="url(#lx-gold)" stroke-width="1.2" />
    </g>

    <g class="date-window" filter="url(#lx-drop)">
      <rect x="143" y="92.6" width="20.5" height="14.8" rx="1.2" fill="#f4f5f4" />
      <rect x="143" y="92.6" width="20.5" height="14.8" rx="1.2" fill="none" stroke="url(#lx-gold)" stroke-width="1.4" />
    </g>
    <text x="153.2" y="100.6" class="date-text" text-anchor="middle" dominant-baseline="central">{{ wall.day }}</text>

    <g filter="url(#lx-drop)">
      <g :transform="`rotate(${hours * 30} 100 100)`">
        <polygon points="98.4,102 98.9,60.8 101.1,60.8 101.6,102" fill="url(#lx-hand)" stroke="#39414a" stroke-width="0.35" />
        <circle cx="100" cy="54" r="6.2" fill="none" stroke="url(#lx-hand)" stroke-width="2.1" />
        <circle cx="100" cy="54" r="5.15" class="lume" />
        <line x1="100" y1="54" x2="100" y2="48.85" stroke="url(#lx-hand)" stroke-width="1.1" />
        <line x1="100" y1="54" x2="104.45" y2="56.55" stroke="url(#lx-hand)" stroke-width="1.1" />
        <line x1="100" y1="54" x2="95.55" y2="56.55" stroke="url(#lx-hand)" stroke-width="1.1" />
        <polygon points="99.1,47.9 100,42.2 100.9,47.9" fill="url(#lx-hand)" />
      </g>
      <g :transform="`rotate(${minutes * 6} 100 100)`">
        <polygon points="98.6,104 98.95,34.5 101.05,34.5 101.4,104" fill="url(#lx-hand)" stroke="#39414a" stroke-width="0.35" />
        <rect x="99.35" y="40" width="1.3" height="47" class="lume" />
      </g>
      <g :transform="`rotate(${seconds * 6} 100 100)`">
        <line x1="100" y1="113.5" x2="100" y2="31.5" stroke="#fd7014" stroke-width="1.1" />
        <circle cx="100" cy="41" r="2.4" class="lume" stroke="#fd7014" stroke-width="0.8" />
        <circle cx="100" cy="110" r="2.6" fill="#fd7014" />
      </g>
      <circle cx="100" cy="100" r="3.9" fill="url(#lx-hand)" stroke="#2b323a" stroke-width="0.6" />
      <circle cx="100" cy="100" r="1.4" fill="#fd7014" />
    </g>

    <!-- note: Glass never intercepts input — the dome overlaps the bezel's drag ring. -->
    <g pointer-events="none">
      <ellipse cx="74" cy="64" rx="48" ry="35" fill="url(#lx-dome)" transform="rotate(-28 74 64)" />
      <path
        d="M 47.62 55.42 A 68.5 68.5 0 0 1 76.53 34.31"
        fill="none"
        stroke="#ffffff"
        stroke-opacity="0.16"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <ellipse cx="132" cy="140" rx="30" ry="20" fill="#4b7ad0" opacity="0.05" transform="rotate(-30 132 140)" />
      <ellipse cx="153.2" cy="100" rx="14.6" ry="11.4" fill="url(#lx-cyclops)" stroke="#e9f2ff" stroke-opacity="0.28" stroke-width="0.5" />
      <ellipse cx="148" cy="95" rx="4.8" ry="2.1" fill="#ffffff" opacity="0.26" transform="rotate(-32 148 95)" />
    </g>

    <g class="crown">
      <path d="M 186.5 88.5 Q 195.5 90.5 196.5 95 L 189 97.5 Z" fill="url(#lx-steel)" stroke="#39414a" stroke-width="0.4" />
      <path d="M 186.5 111.5 Q 195.5 109.5 196.5 105 L 189 102.5 Z" fill="url(#lx-steel)" stroke="#39414a" stroke-width="0.4" />
      <rect x="190.8" y="94.4" width="8.3" height="11.2" rx="2.2" fill="url(#lx-steel)" stroke="#2c333c" stroke-width="0.5" />
      <g stroke="#4d5560" stroke-width="0.55" opacity="0.75">
        <line x1="192.6" y1="94.8" x2="192.6" y2="105.2" />
        <line x1="194.4" y1="94.5" x2="194.4" y2="105.5" />
        <line x1="196.2" y1="94.5" x2="196.2" y2="105.5" />
        <line x1="197.9" y1="94.9" x2="197.9" y2="105.1" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.analog-face {
  width: 100%;
  height: 100%;
  display: block;
}

.bezel {
  cursor: ew-resize;
}

.lume {
  fill: #cfe9ff;
}

.analog-face--night .lume {
  fill: #8fd8ff;
  filter: drop-shadow(0 0 2.5px rgba(96, 183, 255, 0.95));
}

.bezel-numeral {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 9.5px;
  fill: #d9dfe7;
}

.rehaut {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
}

.brand {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 8.2px;
  fill: #dce6f5;
  letter-spacing: 1.6px;
}

.motto {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 4px;
  fill: #8fa5c8;
  letter-spacing: 0.8px;
}

.date-text {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 12.5px;
  font-weight: 700;
  fill: #15181d;
}
</style>
