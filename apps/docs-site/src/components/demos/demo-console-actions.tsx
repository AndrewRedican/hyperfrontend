'use client'

import type { DemoShell } from './demo-wiring'
import { useCallback, useEffect, useRef, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'

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

/** Pacing presets for the heartbeat's `set-rate` command, clamped by the contract to 40–180 bpm. */
const PACING_PRESETS = [
  { label: 'Pace 48 bpm', bpm: 48 },
  { label: 'Pace 72 bpm', bpm: 72 },
  { label: 'Pace 156 bpm', bpm: 156 },
]

/**
 * The heartbeat's contract-specific console actions: a correlated `ping`
 * request with its measured round trip, host-commanded pacing through
 * `set-rate`, and a live readout of the latest `beat` event — every
 * contraction the heart makes crosses the boundary as contract traffic.
 * @param root0
 * @param root0.shell
 * @param root0.log
 */
export function HeartbeatConsoleActions({ shell, log }: DemoConsoleActionsProps) {
  const [latency, setLatency] = useState<string | null>(null)
  const [lastBeat, setLastBeat] = useState<string | null>(null)
  const pingSeq = useRef(0)

  // why: Beats arrive faster than a log should scroll, so the newest one feeds a readout; the sparser rhythm transitions narrate into the log instead.
  useEffect(() => {
    if (!shell) {
      setLastBeat(null)
      return
    }
    const subscriptions = [
      shell.on('beat', (data) => {
        if (isRecord(data)) {
          setLastBeat(`#${String(data['seq'])} — ${String(data['bpm'])} bpm (${String(data['source'])})`)
        }
      }),
      shell.on('rhythm', (data) => {
        if (isRecord(data) && typeof data['state'] === 'string') {
          const state = data['state']
          const kind: EventKind =
            state === 'flatline' ? 'error' : state === 'suppressed' ? 'warn' : state === 'beating' ? 'success' : 'info'
          log(`rhythm — ${state} (${String(data['bpm'])} bpm)`, kind)
        }
      }),
    ]
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [shell, log])

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
      </div>
      {latency !== null ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">ping → {latency}</p> : null}
      {lastBeat !== null ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">latest beat → {lastBeat}</p> : null}
    </>
  )
}
