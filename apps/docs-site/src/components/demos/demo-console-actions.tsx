'use client'

import type { DemoShell } from './demo-wiring'
import type { LubDub } from './heartbeat-monitor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { createEcgStrip, createLubDub, createObservedBpm } from './heartbeat-monitor'

/** Severity of a logged wire event, driving its color treatment. */
export type EventKind = 'info' | 'success' | 'warn' | 'error'

/** Shared styling for every console action button. */
export const CONSOLE_ACTION_CLASSES =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary-400 hover:text-primary-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:text-primary-400'

/** Options for creating an extra console session beside the embedded one. */
export interface ExtraShellOptions {
  /** Windowed display mode; omitted mounts the embedded default into the hidden anchor. */
  displayMode?: 'dialog' | 'popup'
  /** Feature URL override (e.g. a version-mismatch query); defaults to the demo's deployed URL. */
  url?: string
}

/** Props every demo's console action section receives. */
export interface DemoConsoleActionsProps {
  /** The centered demo's live shell handle, or `null` while none is mounted. */
  shell: DemoShell | null
  /** URL of the demo's deployed feature app. */
  featureUrl: string | undefined
  /** Appends a line to the console's session event log. */
  log: (label: string, kind?: EventKind) => void
  /** Creates an extra shell session against the demo's origin (windowed modes, denial experiments); `null` while the demo has no live origin. */
  createExtraShell: (options: ExtraShellOptions) => DemoShell | null
}

/**
 * Narrows an unknown event payload to a plain record.
 * @param value - The candidate payload.
 * @returns `true` when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * The clock's contract-specific console actions: a correlated `get-time`
 * request with its measured round trip, host-commanded alarms narrated off
 * their real echo events, and a deliberately version-mismatched pairing the
 * handshake refuses with a machine-readable denial.
 * @param root0
 * @param root0.shell
 * @param root0.featureUrl
 * @param root0.log
 * @param root0.createExtraShell
 */
export function ClockConsoleActions({ shell, featureUrl, log, createExtraShell }: DemoConsoleActionsProps) {
  const [timeAnswer, setTimeAnswer] = useState<string | null>(null)
  const [denyVerdict, setDenyVerdict] = useState<string | null>(null)
  const [denyRunning, setDenyRunning] = useState(false)
  const lastAlarmId = useRef<string | null>(null)

  // why: The alarm narration and the clear button both hang off the real echo events, so they follow whichever session currently holds the console.
  useEffect(() => {
    if (!shell) {
      lastAlarmId.current = null
      return
    }
    const subscriptions = [
      shell.on('alarm-set', (data) => {
        if (isRecord(data) && typeof data['id'] === 'string') {
          lastAlarmId.current = data['id']
          log(`alarm-set — ${String(data['id'])} at ${String(data['at'])}`, 'success')
        }
      }),
      shell.on('alarm-fired', () => log('alarm-fired — the coin flips itself')),
      shell.on('alarm-cleared', (data) => log(`alarm-cleared — ${isRecord(data) ? String(data['id']) : ''}`)),
    ]
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [shell, log])

  const requestTime = useCallback(async () => {
    if (!shell) {
      return
    }
    const started = performance.now()
    try {
      const answer = await shell.request('get-time', undefined, { timeoutMs: 5000 })
      const elapsed = (performance.now() - started).toFixed(1)
      const formatted = isRecord(answer) && typeof answer['formatted'] === 'string' ? answer['formatted'] : '(unformatted)'
      setTimeAnswer(`${formatted} — round trip ${elapsed} ms`)
      log(`request get-time — answered in ${elapsed} ms`, 'success')
    } catch {
      setTimeAnswer('request failed')
      log('request get-time — failed', 'error')
    }
  }, [log, shell])

  const armAlarm = useCallback(async () => {
    if (!shell) {
      return
    }
    try {
      const answer = await shell.request('get-time', undefined, { timeoutMs: 5000 })
      if (!isRecord(answer) || typeof answer['epochMs'] !== 'number' || typeof answer['timezone'] !== 'string') {
        return
      }
      // how: The alarm time is authored in the clock's own timezone, two minutes out, so it visibly arms and then fires while a visitor watches.
      const at = new Intl.DateTimeFormat('en-GB', {
        timeZone: answer['timezone'],
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(answer['epochMs'] + 120_000)
      shell.send('set-alarm', { at, label: 'console demo' })
      log(`set-alarm — ${at} (${String(answer['timezone'])})`)
    } catch {
      log('set-alarm — get-time failed, alarm not armed', 'error')
    }
  }, [log, shell])

  const clearAlarm = useCallback(() => {
    if (!shell || lastAlarmId.current === null) {
      return
    }
    shell.send('clear-alarm', { id: lastAlarmId.current })
    lastAlarmId.current = null
  }, [shell])

  const runDenyDemo = useCallback(() => {
    if (denyRunning || featureUrl === undefined) {
      return
    }
    // how: The feature announces the overridden contract version at the handshake, so the pairing is refused before anything opens — the frame never paints.
    const separator = featureUrl.includes('?') ? '&' : '?'
    const mismatched = createExtraShell({ url: `${featureUrl}${separator}contract-version=9.9.9` })
    if (!mismatched) {
      return
    }
    setDenyRunning(true)
    setDenyVerdict(null)
    let settled = false
    const finish = (verdict: string) => {
      if (!settled) {
        settled = true
        setDenyVerdict(verdict)
        setDenyRunning(false)
        mismatched.destroy()
      }
    }
    mismatched.on('error', (data) => {
      if (isRecord(data) && typeof data['reason'] === 'string') {
        finish(`refused — reason: ${String(data['reason'])}`)
        log(`deny — ${String(data['reason'])} (contract 9.9.9 vs 0.2.0)`, 'error')
      }
    })
    mismatched.open()
  }, [createExtraShell, denyRunning, featureUrl, log])

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={() => void requestTime()}>
          Request the time
        </button>
        <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={() => void armAlarm()}>
          Arm an alarm (+2 min)
        </button>
        <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={clearAlarm}>
          Clear last alarm
        </button>
        <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={denyRunning} onClick={runDenyDemo}>
          {denyRunning ? 'Denying…' : 'Try a version mismatch'}
        </button>
      </div>
      {timeAnswer !== null ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">get-time → {timeAnswer}</p> : null}
      {denyVerdict !== null ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          version 9.9.9 pairing {denyVerdict} — additive contract evolution never gates, but an incompatible cut is refused before anything
          opens.
        </p>
      ) : null}
    </>
  )
}

/**
 * The koi pond's contract-specific console actions: a `disturb` the gallery
 * sends on the visitor's behalf to strike the water without a pointer, a live
 * `shoal` readout of how many koi have connected behind the scene, and the
 * `sequence-complete` the pond emits once every fish has fled and settled back
 * into an ambient cruise — the outer, gallery-facing half of the two-contract
 * nesting, none of which knows there are seven framework apps behind it.
 * @param root0
 * @param root0.shell
 * @param root0.log
 */
export function KoiPondConsoleActions({ shell, log }: DemoConsoleActionsProps) {
  const [shoal, setShoal] = useState<string | null>(null)
  const [lastScatter, setLastScatter] = useState<string | null>(null)

  // why: The shoal readout and the scatter narration hang off the pond's real emitted events, so they follow whichever session currently holds the console.
  useEffect(() => {
    if (!shell) {
      setShoal(null)
      return
    }
    const subscriptions = [
      shell.on('shoal', (data) => {
        if (isRecord(data) && typeof data['connected'] === 'number' && typeof data['expected'] === 'number') {
          setShoal(`${String(data['connected'])} of ${String(data['expected'])} koi connected`)
        }
      }),
      shell.on('sequence-complete', (data) => {
        const fish = isRecord(data) && typeof data['fish'] === 'number' ? String(data['fish']) : 'the'
        setLastScatter(`the shoal settled — ${fish} koi returned to cruising`)
        log(`sequence-complete — ${fish} koi settled after the scatter`, 'success')
      }),
    ]
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [shell, log])

  const disturb = useCallback(() => {
    if (!shell) {
      return
    }
    // how: The strike is a fraction across the pond, not a pixel, so the host places it wherever the scene is measured — a click at the centre without a pointer.
    shell.send('disturb', { fx: 0.5, fy: 0.5 })
    setLastScatter(null)
    log('disturb — struck the water at the pond’s centre; the nearby koi scatter')
  }, [log, shell])

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={disturb}>
          Disturb the pond
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
        {shoal !== null ? `shoal → ${shoal}` : 'shoal → waiting for the koi to connect…'}
      </p>
      {lastScatter !== null ? <p className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-400">{lastScatter}</p> : null}
    </>
  )
}

/** Pacing presets for the heartbeat's `set-rate` command, clamped by the contract to 40–180 bpm. */
const PACING_PRESETS = [
  { label: 'Pace 48 bpm', bpm: 48 },
  { label: 'Pace 72 bpm', bpm: 72 },
  { label: 'Pace 156 bpm', bpm: 156 },
]

/**
 * The heartbeat's contract-specific console actions: a correlated `ping`
 * request with its measured round trip, host-commanded pacing through
 * `set-rate`, a live ECG strip and observed-rate readout driven by the real
 * `beat` stream, and the approval that turns on host-owned heartbeat sound —
 * every contraction the heart makes crosses the boundary as contract traffic.
 * @param root0
 * @param root0.shell
 * @param root0.log
 */
export function HeartbeatConsoleActions({ shell, log }: DemoConsoleActionsProps) {
  const [latency, setLatency] = useState<string | null>(null)
  const [lastBeat, setLastBeat] = useState<string | null>(null)
  const [observed, setObserved] = useState(0)
  const [soundOn, setSoundOn] = useState(false)
  const pingSeq = useRef(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const vitals = useRef(createObservedBpm())
  const chime = useRef<LubDub | null>(null)

  // why: Beats arrive faster than a log should scroll, so they feed the strip and readouts; the sparser rhythm transitions narrate into the log instead.
  useEffect(() => {
    if (!shell) {
      setLastBeat(null)
      setObserved(0)
      vitals.current.reset()
      return
    }
    const strip = canvas.current === null ? null : createEcgStrip(canvas.current)
    strip?.start()
    // why: The readout keeps re-sampling between beats so silence visibly decays it instead of freezing the last value.
    const ticker = setInterval(() => {
      setObserved(vitals.current.readingAt(dateNow()))
    }, 500)
    const subscriptions = [
      shell.on('beat', (data) => {
        const receivedAt = dateNow()
        vitals.current.addBeat(receivedAt)
        setObserved(vitals.current.readingAt(receivedAt))
        strip?.setFlat(false)
        strip?.addBeat({ at: receivedAt, source: isRecord(data) && data['source'] === 'user' ? 'user' : 'rhythm' })
        // note: Silent until the visitor approves sound; a flatlined rhythm emits no beats, so nothing can sound while flat.
        chime.current?.playBeat()
        if (isRecord(data)) {
          setLastBeat(`#${String(data['seq'])} (${String(data['source'])})`)
        }
      }),
      shell.on('rhythm', (data) => {
        if (isRecord(data) && typeof data['state'] === 'string') {
          const state = data['state']
          strip?.setFlat(state === 'flatline')
          const kind: EventKind =
            state === 'flatline' ? 'error' : state === 'suppressed' ? 'warn' : state === 'beating' ? 'success' : 'info'
          log(`rhythm — ${state} (target ${String(data['bpm'])} bpm)`, kind)
        }
      }),
    ]
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
      clearInterval(ticker)
      strip?.stop()
    }
  }, [shell, log])

  const toggleSound = useCallback(() => {
    if (chime.current?.isEnabled() === true) {
      chime.current.disable()
      setSoundOn(false)
      log('heartbeat sound muted')
      return
    }
    if (chime.current === null) {
      chime.current = createLubDub()
    }
    // why: enable() runs inside this click so the browser's gesture requirement is satisfied; a refusal stays a logged fact, not an uncaught error.
    void chime.current.enable().then((running) => {
      setSoundOn(running)
      log(
        running
          ? 'heartbeat sound enabled — the feature declares the autoplay capability, the host owns playback after this approval'
          : 'heartbeat sound unavailable — the browser refused audio playback',
        running ? 'success' : 'warn'
      )
    })
  }, [log])

  const ping = useCallback(async () => {
    if (!shell) {
      return
    }
    pingSeq.current += 1
    const started = performance.now()
    try {
      await shell.request('ping', { seq: pingSeq.current, sentAt: dateNow() }, { timeoutMs: 5000 })
      const elapsed = (performance.now() - started).toFixed(1)
      setLatency(`${elapsed} ms round trip`)
      log(`request ping — pong in ${elapsed} ms`, 'success')
    } catch {
      setLatency('ping failed')
      log('request ping — failed', 'error')
    }
  }, [log, shell])

  const pace = useCallback(
    (bpm: number) => {
      if (!shell) {
        return
      }
      shell.send('set-rate', { bpm })
      log(`set-rate — ${bpm} bpm requested`)
    },
    [log, shell]
  )

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={() => void ping()}>
          Ping the heart
        </button>
        {PACING_PRESETS.map((preset) => (
          <button key={preset.bpm} type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={() => pace(preset.bpm)}>
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={CONSOLE_ACTION_CLASSES}
          disabled={!shell}
          aria-pressed={soundOn}
          onClick={toggleSound}
          title="The feature declares the autoplay capability; playback is host-owned and starts only after this approval."
        >
          {soundOn ? 'Mute heartbeat sound' : 'Enable heartbeat sound'}
        </button>
      </div>
      {/* note: The strip is host-drawn from received beat events — the same authoritative stream the effects and the chime consume. */}
      <canvas ref={canvas} width={352} height={56} aria-hidden className="mt-3 h-14 w-full rounded-md" />
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        measured → {observed} bpm{lastBeat !== null ? ` · latest beat ${lastBeat}` : ''}
      </p>
      {latency !== null ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">ping → {latency}</p> : null}
    </>
  )
}
