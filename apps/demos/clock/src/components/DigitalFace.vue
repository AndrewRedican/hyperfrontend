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
</script>

<template>
  <div class="digital-face">
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
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #3d3a36, #262421 55%, #161513);
  border: 1.5px solid #4a453e;
  box-sizing: border-box;
}

.lcd {
  width: 72%;
  border-radius: 10px;
  background: linear-gradient(160deg, #0d0f0c, #131611);
  border: 1px solid #05060409;
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.9),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06);
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
  color: #fd7014;
  text-shadow: 0 0 12px rgba(253, 112, 20, 0.45);
  white-space: nowrap;
}

.meta {
  display: flex;
  gap: 8px;
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 12px;
  color: #b8b1a3;
  white-space: nowrap;
}

.zone {
  color: #7d766a;
}

.alarm-list {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  font-family: 'BenchNine', 'Arial Narrow', sans-serif;
  font-size: 12px;
  color: #d8d2c4;
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
    inset 0 2px 8px rgba(0, 0, 0, 0.9),
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
