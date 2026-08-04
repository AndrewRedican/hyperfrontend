'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { ComponentType } from 'react'
import type { DemoConsoleActionsProps, EventKind, ExtraShellOptions } from './demo-console-actions'
import type { DemoShell } from './demo-wiring'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ClockConsoleActions, CONSOLE_ACTION_CLASSES, HeartbeatConsoleActions } from './demo-console-actions'
import { demoWiringFor } from './demo-wiring'

/** Props for {@link DemoHostConsole}. */
export interface DemoHostConsoleProps {
  /** The demo currently centered in the gallery. */
  entry: DemoManifestEntry
  /** The centered live demo's shell handle, or `null` while none is mounted. */
  shell: DemoShell | null
  /** `true` renders the portrait cog widget; `false` renders the landscape inline panel. */
  floating: boolean
}

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

/** Status-dot color per session state, shown on the collapsed cog. */
const STATE_DOTS: Record<SessionState, string> = {
  connecting: 'bg-slate-400',
  healthy: 'bg-emerald-500',
  unobservable: 'bg-slate-400',
  suspect: 'bg-amber-500',
  gone: 'bg-red-500',
  closed: 'bg-slate-400',
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

/** The contract-specific action section each live demo contributes to the console. */
const DEMO_ACTIONS: Record<string, ComponentType<DemoConsoleActionsProps> | undefined> = {
  clock: ClockConsoleActions,
  heartbeat: HeartbeatConsoleActions,
}

/** The one-line pitch above each live demo's controls. */
const DEMO_BLURBS: Record<string, string> = {
  clock:
    'Everything below drives the centered clock’s real session — the same wire the article describes: liveness states, dirty reports, correlated requests, polite teardown, contract-declared display modes, and a handshake denial.',
  heartbeat:
    'Everything below drives the centered heart’s real session — cardiac beats and rhythm shifts crossing as contract events, a correlated ping with its measured round trip, host-commanded pacing, polite teardown, and the contract-declared display modes.',
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
 * A live host console for whichever demo is centered in the gallery: the
 * session protocol made visible and drivable.
 *
 * For a live demo, everything shown comes off the real wire — the four-state
 * liveness watchdog, the feature's dirty-state reports, the polite close
 * exchange, the contract-declared dialog and popup display modes, and the
 * demo's own contract actions contributed by its action section. For a demo
 * still in planning, the console idles with no controls — there is no session
 * to drive. Centering a different demo resets the console outright, so no
 * state, log entries, or controls linger from the previous session.
 *
 * The console floats beside the deck as a compact cog anchored to the
 * gallery's top-right corner — the session state stays visible as a dot on
 * the cog, and expanding it opens the full panel next to the embed instead of
 * a block at the bottom of the page.
 * @param root0
 * @param root0.entry
 * @param root0.shell
 * @param root0.floating
 */
export function DemoHostConsole({ entry, shell, floating }: DemoHostConsoleProps) {
  const [session, setSession] = useState<SessionState>('connecting')
  const [dirty, setDirty] = useState(false)
  const [events, setEvents] = useState<ConsoleEvent[]>([])
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const mountedAt = useRef(performance.now())
  const extraMount = useRef<HTMLDivElement | null>(null)
  const extraShells = useRef<DemoShell[]>([])
  const featureUrl = entry.featureUrl
  const contractLabel = demoWiringFor(entry.slug)?.contractLabel
  const live = featureUrl !== undefined && contractLabel !== undefined

  const log = useCallback((label: string, kind: EventKind = 'info') => {
    const at = `t+${((performance.now() - mountedAt.current) / 1000).toFixed(1)}s`
    setEvents((current) => [{ at, label, kind }, ...current].slice(0, EVENT_CAP))
  }, [])

  // why: Centering another demo makes this a different console — every trace of the previous session's state and log must go with it.
  useEffect(() => {
    setSession('connecting')
    setDirty(false)
    setEvents([])
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
      // why: The status payload is the watchdog snapshot object, not a bare state string.
      shell.on('status', (data) => {
        const state = isRecord(data) ? data['state'] : undefined
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
        log(`dirty-state — ${next ? 'unsaved work' : 'clean'}`, next ? 'warn' : 'info')
      }),
      shell.on('error', (data) => {
        log(`error — ${isRecord(data) && typeof data['reason'] === 'string' ? String(data['reason']) : 'unspecified'}`, 'error')
      }),
    ]
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [shell, log])

  // why: Display-mode and denial sessions outlive a click but not the page — destroy any stragglers on unmount.
  useEffect(() => {
    const opened = extraShells.current
    return () => opened.forEach((extra) => extra.destroy())
  }, [])

  const createExtraShell = useCallback(
    (options: ExtraShellOptions): DemoShell | null => {
      const mount = extraMount.current
      const demoWiring = demoWiringFor(entry.slug)
      if (!mount || !demoWiring || featureUrl === undefined) {
        return null
      }
      // note: The windowed and dialog modes never use the container; it satisfies the embedded-default options shape.
      const extra = demoWiring.createShell({
        container: mount,
        url: options.url ?? featureUrl,
        ...(options.displayMode !== undefined && { displayMode: options.displayMode }),
      })
      extraShells.current.push(extra)
      return extra
    },
    [entry.slug, featureUrl]
  )

  const toggleSession = useCallback(() => {
    if (!shell) {
      return
    }
    if (shell.isOpen) {
      log(dirty ? 'close requested — feature reports unsaved work' : 'close requested', dirty ? 'warn' : 'info')
      shell.close()
    } else {
      log('open requested')
      shell.open()
    }
  }, [dirty, log, shell])

  const openMode = useCallback(
    (displayMode: 'dialog' | 'popup') => {
      const extra = createExtraShell({ displayMode })
      if (!extra) {
        return
      }
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
    [createExtraShell, log]
  )

  const latest = events[0]
  const Actions = DEMO_ACTIONS[entry.slug]

  const consoleBody = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`font-display font-semibold text-slate-900 dark:text-white ${floating ? 'text-sm' : 'text-lg'}`}>
          Host console ({entry.title})
        </h2>
        {live ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-medium ${STATE_STYLES[session]}`}>session: {session}</span>
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${dirty ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              {dirty ? 'dirty: unsaved work' : 'dirty: clean'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {contractLabel}
            </span>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {entry.built === true ? 'no session — deploy pending' : 'no session — in planning'}
          </span>
        )}
      </div>
      {!live ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {entry.built === true
            ? `${entry.title} is built and merged — its live origin has not deployed yet, so there is no session to drive. Center a live demo card to operate a real one.`
            : `${entry.title} is still in planning — there is no live session to drive yet. Center a live demo card to operate a real one.`}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{DEMO_BLURBS[entry.slug]}</p>
          {Actions ? <Actions shell={shell} featureUrl={featureUrl} log={log} createExtraShell={createExtraShell} /> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={CONSOLE_ACTION_CLASSES} disabled={!shell} onClick={toggleSession}>
              {shell?.isOpen ? 'Close politely' : 'Reopen session'}
            </button>
            <button type="button" className={CONSOLE_ACTION_CLASSES} onClick={() => openMode('dialog')}>
              Open as dialog
            </button>
            <button type="button" className={CONSOLE_ACTION_CLASSES} onClick={() => openMode('popup')}>
              Open as popup
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 font-mono text-[11px] leading-relaxed dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              {latest ? (
                <p className={`truncate ${EVENT_STYLES[latest.kind]}`}>
                  <span className="text-slate-400 dark:text-slate-600">{latest.at}</span> {latest.label}
                </p>
              ) : (
                <p className="text-slate-500 dark:text-slate-500">
                  {shell ? 'session events appear here as they cross the wire…' : 'center a live demo card to attach the console'}
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
        </>
      )}
    </>
  )

  if (!floating) {
    return (
      <section className="mt-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-left dark:border-slate-700 dark:bg-slate-900/40">
        {consoleBody}
        {/* note: Hidden mount for the extra sessions — a refused or connecting handshake never displays its frame, so nothing paints here. */}
        <div ref={extraMount} className="hidden" aria-hidden />
      </section>
    )
  }

  return (
    <section className="pointer-events-none absolute right-2 top-2 z-[130] flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Collapse the host console' : 'Expand the host console'}
        title={`Host console — session: ${session}`}
        className="pointer-events-auto relative rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 shadow-md backdrop-blur-sm transition-colors hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-primary-400"
      >
        <CogIcon className="h-5 w-5" />
        {/* note: The session state stays readable while collapsed — the dot on the cog tracks the liveness pill's color. */}
        {live ? (
          <span
            aria-hidden
            className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${STATE_DOTS[session]}`}
          />
        ) : null}
      </button>
      {open ? (
        <div
          className={`pointer-events-auto mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white/90 p-4 text-left shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90 ${SCROLLBAR_CLASSES}`}
        >
          {consoleBody}
        </div>
      ) : null}
      {/* note: Hidden mount for the extra sessions, kept outside the collapsible panel so dialog/popup/denial shells survive a collapse. */}
      <div ref={extraMount} className="hidden" aria-hidden />
    </section>
  )
}

/** Props for {@link CogIcon}. */
interface CogIconProps {
  /** Extra classes for the svg element. */
  className?: string
}

/**
 * The gear glyph on the console's collapsed toggle.
 * @param root0
 * @param root0.className
 */
function CogIcon({ className }: CogIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
