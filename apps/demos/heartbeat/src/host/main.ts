/**
 * The vanilla-TS host page: embeds the heartbeat feature same-origin with
 * `createShell`, draws the ECG from contract `beat` events, measures latency
 * with `ping`/`pong`, and surfaces the SDK's own liveness watchdog in a
 * separate connection panel so the two heartbeat layers stay distinguishable.
 *
 * The feature owns and renders the heart; this page owns everything drawn
 * over and around it — the ECG trace, the toast stickers popping off extra
 * beats, and the skull that materialises over a flatline.
 */
import type { HeartbeatStatus } from '@hyperfrontend/features/host'
import { createShell, mountEmbedded } from '@hyperfrontend/features/host'
import contract from '../../heartbeat.contract'
import { createHeartbeatAudio } from '../audio/heartbeat-audio'
import { createRollingBpm } from './bpm'
import { createEcgRenderer } from './ecg-canvas'
import { createFlatlineEdge } from './fx'
import { createStageFx } from './fx-dom'
import { isFlatline } from './ecg'
import './host.css'

/** A `beat` event as declared by the feature contract. */
interface BeatPayload {
  at: number
  seq: number
  bpm: number
  source: 'rhythm' | 'user'
}

/** A `rhythm` event as declared by the feature contract. */
interface RhythmPayload {
  state: 'beating' | 'suppressed' | 'flatline' | 'recovering'
  bpm: number
}

/** A `pong` reply as declared by the feature contract. */
interface PongPayload {
  seq: number
  sentAt: number
}

/**
 * Looks up a required element, failing loudly when the markup drifts.
 *
 * @param selector - The CSS selector to resolve.
 * @returns The matching element.
 */
function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) {
    throw new Error(`missing element: ${selector}`)
  }
  return found
}

const bpmEl = el<HTMLElement>('#bpm-value')
const beatsTotalEl = el<HTMLElement>('#beats-total')
const beatsUserEl = el<HTMLElement>('#beats-user')
const latencyEl = el<HTMLElement>('#latency-value')
const sdkStateEl = el<HTMLElement>('#sdk-state')
const sdkMissedEl = el<HTMLElement>('#sdk-missed')
const sdkLastBeatEl = el<HTMLElement>('#sdk-last-beat')
const ecgFlagEl = el<HTMLElement>('#ecg-flag')
const logEl = el<HTMLUListElement>('#event-log')
const rateEl = el<HTMLInputElement>('#rate')
const rateValueEl = el<HTMLOutputElement>('#rate-value')

const rolling = createRollingBpm()
const ecg = createEcgRenderer(el<HTMLCanvasElement>('#ecg'))
const fx = createStageFx(el<HTMLElement>('#fx-layer'))
const flatlineEdge = createFlatlineEdge()
// why: The feature declares the autoplay capability; this host surfaces it as an explicit approval and owns the playback that follows.
const audio = createHeartbeatAudio()

let totalBeats = 0
let userBeats = 0
let lastBeatAt: number | null = null
let lastKnownBpm = Number(rateEl.value)
let rhythmState: RhythmPayload['state'] = 'beating'
let pingSeq = 0

/**
 * Prepends one line to the event log, keeping the most recent nine.
 *
 * @param message - The line to log.
 */
function log(message: string): void {
  const item = document.createElement('li')
  item.textContent = `${new Date().toLocaleTimeString()} — ${message}`
  logEl.prepend(item)
  while (logEl.childElementCount > 9) {
    logEl.lastElementChild?.remove()
  }
}

const shell = createShell({
  modes: { embedded: mountEmbedded },
  container: '#stage',
  name: '@hyperfrontend/demo-heartbeat',
  // why: Resolved against this page, so the same markup works under `hf dev`, `vite preview`, and any static origin serving the pair.
  url: new URL('/', window.location.href).toString(),
  contract,
  // why: Matches the feature's declared protocol, so the pairing negotiates the v1 security envelope.
  protocol: 'v1',
})

shell.on('beat', (data: unknown) => {
  // note: Receive payloads are schema-validated by the SDK before consumer handlers run.
  const beat = <BeatPayload>data
  const receivedAt = Date.now()
  totalBeats += 1
  if (beat.source === 'user') {
    userBeats += 1
    log(`user beat #${beat.seq}`)
    // why: An extra beat is the visitor's doing — the host celebrates it with a toast sticker drifting off the heart.
    fx.spawnToast()
  }
  // why: Any beat ends a flatline, so the skull leaves immediately even mid-materialisation.
  fx.hideSkull()
  lastBeatAt = receivedAt
  rolling.addBeat(receivedAt)
  ecg.addBeat({ at: receivedAt, source: beat.source })
  // note: Silent until the visitor approves sound; a flatlined rhythm emits no beats, so nothing can sound while flat.
  audio.playBeat()
  beatsTotalEl.textContent = String(totalBeats)
  beatsUserEl.textContent = String(userBeats)
})

shell.on('rhythm', (data: unknown) => {
  const rhythm = <RhythmPayload>data
  rhythmState = rhythm.state
  if (rhythm.bpm > 0) {
    // why: The flatline judgement needs the last real pacing rate — a 0 would make the silence budget infinite.
    lastKnownBpm = rhythm.bpm
  }
  if (rhythm.state === 'beating') {
    // why: Only a steady rhythm reports the baseline; syncing the control from recovery-ramp values would desync it from the knob.
    rateEl.value = String(rhythm.bpm)
    rateValueEl.textContent = String(rhythm.bpm)
  }
  log(`rhythm: ${rhythm.state} @ ${rhythm.bpm} bpm`)
})

shell.on('status', (data: unknown) => {
  // note: The SDK watchdog reports a snapshot object, not a bare state string.
  const status = <HeartbeatStatus>data
  sdkStateEl.textContent = status.state
  sdkStateEl.dataset['state'] = status.state
  sdkMissedEl.textContent = String(status.missedBeats)
  sdkLastBeatEl.textContent = status.lastBeatAt === null ? '—' : `${Math.max(0, Date.now() - status.lastBeatAt)} ms ago`
  log(`sdk liveness: ${status.state}`)
})

shell.on('open', () => {
  log('channel open')
})

shell.on('close', () => {
  log('channel closed')
  rolling.reset()
  lastBeatAt = null
  // why: The host stops judging a rhythm it no longer observes — otherwise closing mid-flatline pins the flag and skull forever.
  rhythmState = 'beating'
  fx.hideSkull()
})

shell.on('error', (data: unknown) => {
  const record = <Record<string, unknown>>data
  log(`error: ${typeof record['reason'] === 'string' ? record['reason'] : 'unknown'}`)
})

shell.on('dirty-state', (data: unknown) => {
  const record = <Record<string, unknown>>data
  log(`dirty state: ${record['dirty'] === true ? 'disturbed rhythm' : 'steady'}`)
})

// how: The latency probe is a correlated request — the feature's responder echoes sentAt, and the pong event fires for plain listeners too.
setInterval(() => {
  if (!shell.isOpen) {
    return
  }
  pingSeq += 1
  void shell
    .request('ping', { seq: pingSeq, sentAt: Date.now() })
    .then((reply) => {
      latencyEl.textContent = String(Date.now() - (<PongPayload>reply).sentAt)
    })
    .catch(() => {
      latencyEl.textContent = '—'
    })
}, 2000)

// how: The vitals tick twice a second: rolling BPM from received intervals, plus the flatline judgement from state or silence.
setInterval(() => {
  const now = Date.now()
  const flat = rhythmState === 'flatline' || isFlatline(now, lastBeatAt, lastKnownBpm)
  ecg.setFlat(flat)
  // how: The edge detector fires 'show' once per flatline period; the skull otherwise manages its own 10-second lifetime.
  const skullEdge = flatlineEdge.evaluate(flat)
  if (skullEdge === 'show') {
    fx.showSkull()
  } else if (skullEdge === 'hide') {
    fx.hideSkull()
  }
  if (flat) {
    ecgFlagEl.hidden = false
    ecgFlagEl.textContent = 'FLATLINE'
    ecgFlagEl.dataset['kind'] = 'flatline'
    bpmEl.textContent = '0'
  } else {
    const bpm = rolling.bpmAt(now)
    bpmEl.textContent = bpm === null ? '—' : String(bpm)
    if (rhythmState === 'recovering') {
      ecgFlagEl.hidden = false
      ecgFlagEl.textContent = 'RECOVERING'
      ecgFlagEl.dataset['kind'] = 'recovering'
    } else {
      ecgFlagEl.hidden = true
    }
  }
}, 500)

rateEl.addEventListener('input', () => {
  rateValueEl.textContent = rateEl.value
  shell.send('set-rate', { bpm: Number(rateEl.value) })
})

const soundBtn = el<HTMLButtonElement>('#sound-btn')
soundBtn.addEventListener('click', () => {
  if (audio.isEnabled()) {
    audio.disable()
    soundBtn.textContent = 'Enable heartbeat sound'
    soundBtn.setAttribute('aria-pressed', 'false')
    log('heartbeat sound muted')
    return
  }
  // why: enable() runs inside this click so the browser's gesture requirement is satisfied; a refusal stays a logged fact, not an uncaught error.
  void audio.enable().then((running) => {
    if (running) {
      soundBtn.textContent = 'Mute heartbeat sound'
      soundBtn.setAttribute('aria-pressed', 'true')
      log('heartbeat sound enabled — host-owned playback approved')
    } else {
      log('heartbeat sound unavailable — the browser refused audio playback')
    }
  })
})

el<HTMLButtonElement>('#close-btn').addEventListener('click', () => {
  shell.close()
})

el<HTMLButtonElement>('#reopen-btn').addEventListener('click', () => {
  // note: open() after close() remounts the same shell; a full destroy() is only for releasing the handle for good.
  shell.open()
})

ecg.start()
shell.open()
