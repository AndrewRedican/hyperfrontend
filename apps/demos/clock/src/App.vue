<script setup lang="ts">
import type { CoinFace } from './physics/coin-physics'
import type { FormatCause } from './state/clock-store'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ClockCoin from './components/ClockCoin.vue'
import FrameworkBadge from './components/FrameworkBadge.vue'
import { useClockStore } from './state/clock-store'

const store = useClockStore()
const nowMs = ref(Date.now())
const coin = ref<InstanceType<typeof ClockCoin> | null>(null)
const announcement = ref('')

let raf = 0
let fallback: ReturnType<typeof setInterval> | null = null

// how: rAF keeps the second hand sweeping while the page is visible; a 1 Hz
// interval keeps time honest while hidden (no offscreen animation work).
function frame(): void {
  nowMs.value = Date.now()
  raf = requestAnimationFrame(frame)
}

function applyVisibility(): void {
  cancelAnimationFrame(raf)
  if (fallback !== null) {
    clearInterval(fallback)
    fallback = null
  }
  if (document.hidden) {
    fallback = setInterval(() => {
      nowMs.value = Date.now()
    }, 1000)
  } else {
    raf = requestAnimationFrame(frame)
  }
}

onMounted(() => {
  applyVisibility()
  document.addEventListener('visibilitychange', applyVisibility)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (fallback !== null) {
    clearInterval(fallback)
  }
  document.removeEventListener('visibilitychange', applyVisibility)
})

function onSettled(face: CoinFace, cause: FormatCause): void {
  store.format.value = face
  store.notifyFormatSettled(face, cause)
  announcement.value = `Clock now showing its ${face} face.`
  if (cause === 'user' && store.firing.value !== null) {
    store.dismissFiring()
  }
}

// how: A host `set-format` (store mutation from the contract wiring) plays out as
// a physics flip; flips the coin itself initiated are already in sync and no-op.
watch(store.format, (face) => {
  coin.value?.flipTo(face, 'host')
})

store.onAlarmFired((alarm) => {
  coin.value?.flipTo('digital', 'alarm')
  announcement.value = `Alarm ${alarm.label ?? alarm.at} is firing.`
})
</script>

<template>
  <main class="stage">
    <ClockCoin
      ref="coin"
      :epoch-ms="nowMs"
      :timezone="store.timezone.value"
      :locale="store.locale.value"
      :alarms="store.alarms.value"
      :firing="store.firing.value"
      @settled="onSettled"
    />
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    <FrameworkBadge />
  </main>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  background: transparent;
}
</style>

<style scoped>
.stage {
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  position: relative;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
