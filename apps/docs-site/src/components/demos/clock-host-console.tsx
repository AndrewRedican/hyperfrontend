'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { ClockShell } from './clock-embed'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createFeatureShell } from '@hyperfrontend/demo-clock-shell'

/** Props for {@link ClockHostConsole}. */
export interface ClockHostConsoleProps {
  /** The demo currently centered in the gallery. */
  entry: DemoManifestEntry
  /** The centered live demo's shell handle, or `null` while none is mounted. */
  shell: ClockShell | null
}

/** Severity of a logged wire event, driving its color treatment. */
type EventKind = 'info' | 'success' | 'warn' | 'error'

/** One line in the console's session event log. */
interface ConsoleEvent {
  /** Seconds since the console mounted, preformatted. */
  at: string
  /** Human-readable description of the wire event. */
  label: string
  /** Severity for color coding. */
  kind: EventKind
}

/** Session liveness as shown in the console's status pill. */
type SessionState = 'connecting' | 'healthy' | 'unobservable' | 'suspect' | 'gone' | 'closed'

/** Pill styling per session state. */
const STATE_STYLES: Record<SessionState, string> = {
  connecting: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  unobservable: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  suspect: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  gone: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

/** Event-text color per severity, matched to the surrounding design. */
const EVENT_STYLES: Record<EventKind, string> = {
  info: 'text-slate-600 dark:text-slate-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
}

/** Most events the log retains. */
const EVENT_CAP = 30

/** Custom scrollbar treatment for the expanded event log. */
const SCROLLBAR_CLASSES =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600'

/**
 * Narrows an unknown event payload to a plain record.
 * @param value - The candidate payload.
 * @returns `true` when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * A live host console for whichever demo is centered in the gallery: the
 * session protocol made visible and drivable.
 *
 * For the live clock, everything shown comes off the real wire — the
 * four-state liveness watchdog, the feature's dirty-state reports, a
 * correlated `get-time` request with its measured round trip, host-commanded
 * alarms, the polite close exchange, the contract-declared dialog and popup
 * display modes, and a deliberately version-mismatched pairing the handshake
 * refuses with a machine-readable denial. For a demo still in planning, the
 * console idles with no controls — there is no session to drive. Centering a
 * different demo resets the console outright, so no state, log entries, or
 * controls linger from the previous session.
 * @param root0
 * @param root0.entry
 * @param root0.shell
 */
export function ClockHostConsole({ entry, shell }: ClockHostConsoleProps) {
  const [session, setSession] = useState<SessionState>('connecting')
  const [dirty, setDirty] = useState(false)
  const [events, setEvents] = useState<ConsoleEvent[]>([])
  const [expanded, setExpanded] = useState(false)
  const [timeAnswer, setTimeAnswer] = useState<string | null>(null)
  const [denyVerdict, setDenyVerdict] = useState<string | null>(null)
  const [denyRunning, setDenyRunning] = useState(false)
  const mountedAt = useRef(performance.now())
  const lastAlarmId = useRef<string | null>(null)
  const extraMount = useRef<HTMLDivElement | null>(null)
  const extraShells = useRef<ClockShell[]>([])
  const featureUrl = entry.featureUrl

  const log = useCallback((label: string, kind: EventKind = 'info') => {
    const at = `t+${((performance.now() - mountedAt.current) / 1000).toFixed(1)}s`
    setEvents((current) => [{ at, label, kind }, ...current].slice(0, EVENT_CAP))
  }, [])

  // why: Centering another demo makes this a different console — every trace of the previous session's state and log must go with it.
  useEffect(() => {
    setSession('connecting')
    setDirty(false)
    setEvents([])
    setTimeAnswer(null)
    setDenyVerdict(null)
    setDenyRunning(false)
    lastAlarmId.current = null
  }, [entry.slug])

  useEffect(() => {
    if (!shell) {
      setSession('connecting')
      setDirty(false)
      return
    }
    setSession(shell.isOpen ? 'healthy' : 'connecting')
    const subscriptions = [
      shell.on('open', () => {
        setSession('healthy')
        log('open — handshake complete, queued sends flushed', 'success')
      }),
      shell.on('status', (state) => {
        if (state === 'healthy') {
          setSession(state)
          log('status — healthy', 'success')
        } else if (state === 'unobservable') {
          setSession(state)
          log('status — unobservable (a page is hidden; silence is weak evidence)')
        } else if (state === 'suspect') {
          setSession(state)
          log('status — suspect (missed beats)', 'warn')
        } else if (state === 'gone') {
          setSession(state)
          log('status — gone', 'error')
        }
      }),
      shell.on('closing', () => log('closing — flush window open, channel still delivering')),
      shell.on('close', (data) => {
        setSession('closed')
        setDirty(false)
        if (isRecord(data) && data['reason'] === 'peer-reload') {
          log('close — peer-reload, feature re-adopted', 'warn')
        } else {
          log('close — session ended')
        }
      }),
      shell.on('dirty-state', (data) => {
        const next = isRecord(data) && data['dirty'] === true
        setDirty(next)
        log(`dirty-state — ${next ? 'unsaved alarms' : 'clean'}`, next ? 'warn' : 'info')
      }),
      shell.on('error', (data) => {
        log(`error — ${isRecord(data) && typeof data['reason'] === 'string' ? String(data['reason']) : 'unspecified'}`, 'error')
      }),
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

  // why: Display-mode and denial sessions outlive a click but not the page — destroy any stragglers on unmount.
  useEffect(() => {
    const opened = extraShells.current
    return () => opened.forEach((extra) => extra.destroy())
  }, [])

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

  const toggleSession = useCallback(() => {
    if (!shell) {
      return
    }
    if (shell.isOpen) {
      log(dirty ? 'close requested — feature reports unsaved alarms' : 'close requested', dirty ? 'warn' : 'info')
      shell.close()
    } else {
      log('open requested')
      shell.open()
    }
  }, [dirty, log, shell])

  const openMode = useCallback(
    (displayMode: 'dialog' | 'popup') => {
      const mount = extraMount.current
      if (!mount || featureUrl === undefined) {
        return
      }
      // note: The windowed and dialog modes never use the container; it satisfies the embedded-default options shape.
      const extra = createFeatureShell({ container: mount, url: featureUrl, displayMode })
      extraShells.current.push(extra)
      // why: The second session's lifecycle is narrated off its real events — a session is only "open" when the wire says so.
      extra.on('open', () => {
        if (displayMode === 'dialog') {
          log('dialog session open — Esc or a backdrop click closes it', 'success')
        } else {
          log('popup session open — the browser window is authoritative; close it like any window', 'success')
        }
      })
      extra.on('error', (data) => {
        const reason = isRecord(data) && typeof data['reason'] === 'string' ? String(data['reason']) : 'unspecified'
        if (reason === 'open-timeout') {
          log(`${displayMode} session never opened — the feature origin is unreachable or serving an incompatible build`, 'error')
        } else {
          log(`${displayMode} session error — ${reason}`, 'error')
        }
      })
      extra.on('close', () => {
        log(`${displayMode} session closed`)
        extra.destroy()
      })
      extra.open()
      log(`${displayMode} session requested — stays invisible until the handshake completes`)
    },
    [featureUrl, log]
  )

  const runDenyDemo = useCallback(() => {
    const mount = extraMount.current
    if (!mount || denyRunning || featureUrl === undefined) {
      return
    }
    setDenyRunning(true)
    setDenyVerdict(null)
    // how: The feature announces the overridden contract version at the handshake, so the pairing is refused before anything opens — the frame never paints.
    const separator = featureUrl.includes('?') ? '&' : '?'
    const mismatched = createFeatureShell({ container: mount, url: `${featureUrl}${separator}contract-version=9.9.9` })
    extraShells.current.push(mismatched)
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
  }, [denyRunning, featureUrl, log])

  const actionClasses =
    'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary-400 hover:text-primary-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:text-primary-400'

  const latest = events[0]

  return (
    <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-left dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Host console ({entry.title})</h2>
        {featureUrl !== undefined ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-medium ${STATE_STYLES[session]}`}>session: {session}</span>
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${dirty ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              {dirty ? 'dirty: unsaved alarms' : 'dirty: clean'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              contract 0.2.0 · protocol v1
            </span>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            no session — in planning
          </span>
        )}
      </div>
      {featureUrl === undefined ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {entry.title} is still in planning — there is no live session to drive yet. Center the Clock card to operate a real one.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Everything below drives the centered clock&apos;s real session — the same wire the article describes: liveness states, dirty
            reports, correlated requests, polite teardown, contract-declared display modes, and a handshake denial.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={actionClasses} disabled={!shell} onClick={() => void requestTime()}>
              Request the time
            </button>
            <button type="button" className={actionClasses} disabled={!shell} onClick={() => void armAlarm()}>
              Arm an alarm (+2 min)
            </button>
            <button type="button" className={actionClasses} disabled={!shell} onClick={clearAlarm}>
              Clear last alarm
            </button>
            <button type="button" className={actionClasses} disabled={!shell} onClick={toggleSession}>
              {shell?.isOpen ? 'Close politely' : 'Reopen session'}
            </button>
            <button type="button" className={actionClasses} onClick={() => openMode('dialog')}>
              Open as dialog
            </button>
            <button type="button" className={actionClasses} onClick={() => openMode('popup')}>
              Open as popup
            </button>
            <button type="button" className={actionClasses} disabled={denyRunning} onClick={runDenyDemo}>
              {denyRunning ? 'Denying…' : 'Try a version mismatch'}
            </button>
          </div>
          {timeAnswer !== null ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">get-time → {timeAnswer}</p> : null}
          {denyVerdict !== null ? (
            <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
              version 9.9.9 pairing {denyVerdict} — additive contract evolution never gates, but an incompatible cut is refused before
              anything opens.
            </p>
          ) : null}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 font-mono text-[11px] leading-relaxed dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              {latest ? (
                <p className={`truncate ${EVENT_STYLES[latest.kind]}`}>
                  <span className="text-slate-400 dark:text-slate-600">{latest.at}</span> {latest.label}
                </p>
              ) : (
                <p className="text-slate-500 dark:text-slate-500">
                  {shell ? 'session events appear here as they cross the wire…' : 'center the clock card to attach the console'}
                </p>
              )}
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                className="shrink-0 font-sans text-[11px] font-medium text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
              >
                {expanded ? 'Collapse ▲' : `History (${events.length}) ▼`}
              </button>
            </div>
            {expanded ? (
              <div className={`max-h-40 overflow-y-auto border-t border-slate-200 px-3 py-2 dark:border-slate-700 ${SCROLLBAR_CLASSES}`}>
                {events.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-500">no events yet</p>
                ) : (
                  events.map((event, index) => (
                    <p key={`${event.at}-${index}`} className={EVENT_STYLES[event.kind]}>
                      <span className="text-slate-400 dark:text-slate-600">{event.at}</span> {event.label}
                    </p>
                  ))
                )}
              </div>
            ) : null}
          </div>
          {/* note: Hidden mount for the extra sessions — a refused or connecting handshake never displays its frame, so nothing paints here. */}
          <div ref={extraMount} className="hidden" aria-hidden />
        </>
      )}
    </section>
  )
}
