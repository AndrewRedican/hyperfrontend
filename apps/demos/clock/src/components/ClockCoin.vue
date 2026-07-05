<script setup lang="ts">
import type { Alarm } from '../alarms/alarm-engine'
import type { CoinFace } from '../physics/coin-physics'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createCoinPhysics } from '../physics/coin-physics'
import { formatTime } from '../time/clock-time'
import AnalogFace from './AnalogFace.vue'
import DigitalFace from './DigitalFace.vue'

const props = defineProps<{
  /** Instant to display, in epoch milliseconds. */
  epochMs: number
  /** IANA timezone the faces read in. */
  timezone: string
  /** BCP-47 locale used for formatting. */
  locale: string
  /** Armed alarms shown on the digital face. */
  alarms: Alarm[]
  /** The alarm currently firing, if any (drives the wobble + flash). */
  firing: Alarm | null
}>()

const emit = defineEmits<{
  /** The coin came to rest on a face. */
  settled: [face: CoinFace, cause: 'user' | 'host' | 'alarm']
}>()

const reducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const angle = ref(0)
const tiltX = ref(0)
const restingFace = ref<CoinFace>('analog')

// note: The cause of the flip in flight: user gestures leave it 'user'; flipTo stamps it.
let pendingCause: 'user' | 'host' | 'alarm' = 'user'

const physics = createCoinPhysics({
  onSettle: (face) => {
    restingFace.value = face
    emit('settled', face, pendingCause)
    pendingCause = 'user'
  },
})

/**
 * Flips the coin to a face on command (host or alarm). Under reduced motion the
 * flip is an instant crossfade instead of a physics spin.
 */
function flipTo(face: CoinFace, cause: 'host' | 'alarm'): void {
  if (reducedMotion) {
    if (restingFace.value === face) {
      return
    }
    restingFace.value = face
    emit('settled', face, cause)
    return
  }
  if (physics.mode === 'resting' && physics.face === face) {
    return
  }
  pendingCause = cause
  physics.flipTo(face, performance.now())
  wake()
}

defineExpose({ flipTo })

let raf = 0
let running = false
let visible = !document.hidden
let onScreen = true

function frame(now: number): void {
  angle.value = physics.step(now)
  // how: Relax the pointer tilt back to level.
  tiltX.value *= 0.9
  if (physics.mode === 'resting' && Math.abs(tiltX.value) < 0.05) {
    tiltX.value = 0
    running = false
    return
  }
  raf = requestAnimationFrame(frame)
}

/** Starts the physics loop when allowed to animate (visible + on-screen). */
function wake(): void {
  if (running || !visible || !onScreen) {
    return
  }
  running = true
  raf = requestAnimationFrame(frame)
}

function sleep(): void {
  cancelAnimationFrame(raf)
  running = false
  // note: While asleep, finish any motion instantly so state stays consistent.
  angle.value = physics.step(performance.now() + 60_000)
}

const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const handleVisibility = () => {
  visible = !document.hidden
  if (visible) {
    wake()
  } else {
    sleep()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibility)
  if ('IntersectionObserver' in window && root.value) {
    observer = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      if (onScreen) {
        wake()
      } else {
        sleep()
      }
    })
    observer.observe(root.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibility)
  observer?.disconnect()
  cancelAnimationFrame(raf)
})

let dragging = false
let dragStartX = 0
let dragStartTime = 0
let dragTravel = 0

function onPointerDown(event: PointerEvent): void {
  if (reducedMotion) {
    return
  }
  dragging = true
  dragStartX = event.clientX
  dragStartTime = performance.now()
  dragTravel = 0
  ;(<HTMLElement>event.currentTarget).setPointerCapture(event.pointerId)
  physics.grab(event.clientX, dragStartTime)
  wake()
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging) {
    if (!reducedMotion) {
      // how: A few degrees of springy X-tilt following the hover position.
      const rect = root.value?.getBoundingClientRect()
      if (rect) {
        tiltX.value = ((event.clientY - rect.top) / rect.height - 0.5) * -6
        wake()
      }
    }
    return
  }
  dragTravel += Math.abs(event.clientX - dragStartX)
  physics.drag(event.clientX, performance.now())
  wake()
}

function onPointerUp(): void {
  if (!dragging) {
    return
  }
  dragging = false
  const now = performance.now()
  if (dragTravel < 6 && now - dragStartTime < 350) {
    physics.release(now)
    physics.tap(now)
  } else {
    physics.release(now)
  }
  wake()
}

function onKeyFlip(event: KeyboardEvent): void {
  event.preventDefault()
  if (reducedMotion) {
    const next: CoinFace = restingFace.value === 'analog' ? 'digital' : 'analog'
    restingFace.value = next
    emit('settled', next, 'user')
    return
  }
  physics.tap(performance.now())
  wake()
}

const EDGE_LAYERS = 7

const coinStyle = computed(() =>
  reducedMotion ? undefined : { transform: `rotateX(${tiltX.value.toFixed(2)}deg) rotateY(${angle.value.toFixed(2)}deg)` }
)

// how: The specular highlight tracks a fixed light: strongest when a face points at it.
const shine = computed(() => {
  const radians = (angle.value * Math.PI) / 180
  return { opacity: 0.12 + 0.22 * Math.abs(Math.cos(radians)), offset: 50 - 35 * Math.sin(radians) }
})

const shadowStyle = computed(() => {
  const squash = 0.55 + 0.45 * Math.abs(Math.cos((angle.value * Math.PI) / 180))
  return {
    transform: `translateX(-50%) scaleX(${squash.toFixed(3)})`,
    opacity: (0.5 * squash).toFixed(3),
  }
})

const label = computed(() => {
  const minuteEpoch = props.epochMs - (props.epochMs % 60_000)
  return `Clock coin showing its ${restingFace.value} face — ${formatTime(minuteEpoch, props.timezone, props.locale, 'analog')}. Press Enter to flip.`
})
</script>

<template>
  <div ref="root" class="coin-scene" :class="{ 'coin-scene--reduced': reducedMotion }">
    <button
      type="button"
      class="coin-button"
      :aria-label="label"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown.enter="onKeyFlip"
      @keydown.space="onKeyFlip"
    >
      <div class="coin" :class="{ 'coin--alarm': firing !== null }" :style="coinStyle">
        <div
          v-for="layer in EDGE_LAYERS"
          :key="layer"
          class="edge"
          :style="{ transform: `translateZ(${(layer - (EDGE_LAYERS + 1) / 2) * 1.6}px)` }"
        ></div>
        <div class="coin-face coin-face--front" :class="{ 'coin-face--hidden': reducedMotion && restingFace !== 'analog' }">
          <AnalogFace :epoch-ms="epochMs" :timezone="timezone" :smooth="!reducedMotion" />
          <div class="shine" :style="{ opacity: shine.opacity, backgroundPosition: `${shine.offset}% 0` }"></div>
        </div>
        <div class="coin-face coin-face--back" :class="{ 'coin-face--hidden': reducedMotion && restingFace !== 'digital' }">
          <DigitalFace :epoch-ms="epochMs" :timezone="timezone" :locale="locale" :alarms="alarms" :firing="firing" />
          <div class="shine" :style="{ opacity: shine.opacity, backgroundPosition: `${100 - shine.offset}% 0` }"></div>
        </div>
      </div>
      <span v-if="firing" class="pulse" aria-hidden="true"></span>
    </button>
    <div class="ground-shadow" :style="shadowStyle" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.coin-scene {
  position: relative;
  width: min(72vmin, 420px);
  aspect-ratio: 1;
  perspective: 1100px;
  touch-action: none;
}

.coin-button {
  all: unset;
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  border-radius: 50%;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.coin-button:active {
  cursor: grabbing;
}

.coin-button:focus-visible {
  outline: none;
  filter: drop-shadow(0 0 14px rgba(253, 112, 20, 0.8));
}

.coin {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  will-change: transform;
}

.coin--alarm {
  animation: alarm-wobble 0.45s ease-in-out infinite;
}

.coin-face {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  backface-visibility: hidden;
  overflow: hidden;
  box-shadow:
    inset 0 0 0 5px #57503f,
    inset 0 0 0 7px #2c2823;
}

.coin-face--front {
  transform: translateZ(6px);
}

.coin-face--back {
  transform: rotateY(180deg) translateZ(6px);
}

.edge {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #38332b;
  box-shadow: inset 0 0 6px #14120f;
}

.shine {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 244, 224, 0.85) 50%, transparent 70%);
  background-size: 300% 100%;
  mix-blend-mode: screen;
}

.ground-shadow {
  position: absolute;
  left: 50%;
  bottom: -9%;
  width: 62%;
  height: 7%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(0, 0, 0, 0.75), transparent 70%);
  filter: blur(4px);
  pointer-events: none;
}

.pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(253, 112, 20, 0.7);
  animation: alarm-pulse 1.1s ease-out infinite;
  pointer-events: none;
}

@keyframes alarm-wobble {
  0%,
  100% {
    rotate: 0deg;
  }
  25% {
    rotate: 1.6deg;
  }
  75% {
    rotate: -1.6deg;
  }
}

@keyframes alarm-pulse {
  from {
    transform: scale(1);
    opacity: 0.8;
  }
  to {
    transform: scale(1.35);
    opacity: 0;
  }
}

.coin-scene--reduced .coin-face {
  transition: opacity 0.4s ease;
  transform: translateZ(6px);
}

.coin-scene--reduced .coin-face--hidden {
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .coin--alarm {
    animation: none;
  }
  .pulse {
    animation: none;
    opacity: 0.6;
  }
}
</style>
