<script setup lang="ts">
import type { Alarm } from '../alarms/alarm-engine'
import { computed } from 'vue'
import { formatDate, formatTime, zoneLabel } from '../time/clock-time'

const props = defineProps<{
  /** Instant to display, in epoch milliseconds. */
  epochMs: number
  /** IANA timezone the panel reads in. */
  timezone: string
  /** BCP-47 locale used for formatting. */
  locale: string
  /** Armed alarms, soonest first. */
  alarms: Alarm[]
  /** The alarm currently firing, if any. */
  firing: Alarm | null
}>()

const time = computed(() => formatTime(props.epochMs, props.timezone, props.locale, 'digital'))
const date = computed(() => formatDate(props.epochMs, props.timezone, props.locale))
const zone = computed(() => zoneLabel(props.epochMs, props.timezone, props.locale))

const ENGRAVING = 'HYPERFRONTEND · 904L OYSTER CASE · DEMO CLOCK · '
</script>

<template>
  <div class="digital-face">
    <svg class="case-back" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <path id="lx-back-ring" d="M 100 15 A 85 85 0 1 1 99.99 15" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="93" fill="none" stroke="#6f7885" stroke-width="0.8" opacity="0.7" />
      <circle cx="100" cy="100" r="76" fill="none" stroke="#6f7885" stroke-width="0.8" opacity="0.7" />
      <text class="engraving">
        <textPath href="#lx-back-ring">{{ ENGRAVING }}</textPath>
      </text>
    </svg>
    <div class="lcd" :class="{ 'lcd--firing': firing !== null }">
      <div v-if="firing" class="firing-banner">⏰ {{ firing.label ?? firing.at }}</div>
      <div class="time">{{ time }}</div>
      <div class="meta">
        <span class="date">{{ date }}</span>
        <span class="zone">{{ zone }}</span>
      </div>
      <ul v-if="alarms.length > 0" class="alarm-list">
        <li v-for="alarm in alarms" :key="alarm.id">
          <span class="alarm-dot" aria-hidden="true"></span>{{ alarm.at }}<template v-if="alarm.label"> · {{ alarm.label }}</template>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.digital-face {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 50%;
  /* how: Brushed 904L case back — fine circular graining over a polished radial sheen. */
  background:
    repeating-radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 0 1.5px, rgba(10, 15, 22, 0.05) 1.5px 3px),
    radial-gradient(circle at 32% 28%, #eef1f5, #b9c1cb 40%, #7e8894 72%, #a8b0ba);
  border: 1.5px solid #39414a;
  box-sizing: border-box;
}

.case-back {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.engraving {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 7px;
  letter-spacing: 2.4px;
  fill: #5a6470;
}

.lcd {
  position: relative;
  width: 68%;
  border-radius: 12px;
  /* note: The LCD reads as a sapphire exhibition window into the movement — deep navy glass. */
  background: linear-gradient(160deg, #081228, #0c1c3e);
  border: 1px solid #24406e;
  box-shadow:
    inset 0 2px 9px rgba(1, 4, 12, 0.9),
    inset 0 -1px 0 rgba(160, 200, 255, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.35);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.time {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: clamp(26px, 15cqw, 44px);
  line-height: 1;
  color: #9fd4ff;
  text-shadow: 0 0 12px rgba(125, 200, 255, 0.5);
  white-space: nowrap;
}

.meta {
  display: flex;
  gap: 8px;
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 12px;
  color: #8fa3c0;
  white-space: nowrap;
}

.zone {
  /* note: Dimmer than the date but still ≥4.5:1 on the LCD glass for WCAG AA. */
  color: #7e94b8;
}

.alarm-list {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 12px;
  color: #cfe0f5;
}

.alarm-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fd7014;
  margin-right: 5px;
  vertical-align: middle;
}

.firing-banner {
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 14px;
  color: #ffb27d;
  animation: firing-flash 0.8s steps(2, jump-none) infinite;
}

.lcd--firing {
  box-shadow:
    inset 0 2px 9px rgba(1, 4, 12, 0.9),
    0 0 18px rgba(253, 112, 20, 0.55);
}

@keyframes firing-flash {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .firing-banner {
    animation: none;
  }
}
</style>
