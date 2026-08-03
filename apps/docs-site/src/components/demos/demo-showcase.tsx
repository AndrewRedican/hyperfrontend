'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { EmbedStatus } from './clock-embed'
import { useCallback, useEffect, useRef, useState } from 'react'
import { min, pow } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ClockEmbed } from './clock-embed'
import { DemoFallbackCard, getDemoTheme } from './demo-fallback-card'

/** Snapshot taken when fast-forward begins so the easing can interpolate from that moment. */
interface FastForwardStart {
  /** Timestamp when the skip was requested. */
  time: number
  /** Progress percentage already elapsed when the skip was requested. */
  progress: number
}

/** Props for {@link DemoShowcase}. */
export interface DemoShowcaseProps {
  /** The demo albums to rotate through, in order. */
  entries: readonly DemoManifestEntry[]
  /** Milliseconds each demo stays on screen before auto-advancing. */
  cycleDuration?: number
  /** Milliseconds the skip fast-forward easing takes to drain the remaining ring. */
  fastForwardDuration?: number
  /** Notified with the staged demo on mount and whenever rotation hands the stage to another demo. */
  onActive?: (entry: DemoManifestEntry) => void
}

/**
 * The landing-page demo showcase: one manifest entry at a time inside a framed
 * card, with a conic-gradient ring sweeping around the frame until the next
 * demo takes over.
 *
 * Every entry renders as an absolutely-stacked layer inside one fixed
 * square stage — the live embed mounts once per page load and stays mounted
 * while rotation only toggles which layer is visible and interactive, so
 * returning to the clock is instant and the frame never changes height.
 * Planned entries render as DOM placeholder cards. The ring and the
 * pause/skip controls paint above the content — the buttons hang half outside
 * the frame — so nothing a layer renders can ever cover them. The staged
 * demo's accent hue glows out from behind the frame, clipped to the showcase's
 * own container, and crossfades as rotation hands the stage over. Pausing
 * freezes the ring and holds the current demo. Under reduced motion nothing
 * auto-advances: the ring and pause disappear and the skip button becomes a
 * plain next button.
 * @param root0
 * @param root0.entries
 * @param root0.cycleDuration
 * @param root0.fastForwardDuration
 * @param root0.onActive
 */
export function DemoShowcase({ entries, cycleDuration = 20000, fastForwardDuration = 2000, onActive }: DemoShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [fastForwarding, setFastForwarding] = useState(false)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('connecting')
  const rafRef = useRef(0)
  const startTimeRef = useRef(0)
  const progressRef = useRef(0)
  const fastForwardStartRef = useRef<FastForwardStart | null>(null)

  // why: the rAF loop and skip() need the live percentage without subscribing to per-frame state.
  const applyProgress = useCallback((value: number) => {
    progressRef.current = value
    setProgress(value)
  }, [])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyMotion = () => setReduced(motion.matches)
    applyMotion()
    motion.addEventListener('change', applyMotion)
    return () => motion.removeEventListener('change', applyMotion)
  }, [])

  const advance = useCallback(() => {
    setActiveIndex((index) => (index + 1) % entries.length)
    // why: a rollover from either branch must clear any mid-flight skip, or the next cycle fast-forwards itself.
    setFastForwarding(false)
    fastForwardStartRef.current = null
    startTimeRef.current = 0
    applyProgress(0)
  }, [applyProgress, entries.length])

  const skip = useCallback(() => {
    if (reduced || paused) {
      advance()
      return
    }
    if (fastForwarding) {
      return
    }
    setFastForwarding(true)
    fastForwardStartRef.current = { time: performance.now(), progress: progressRef.current }
  }, [advance, fastForwarding, paused, reduced])

  const togglePause = useCallback(() => setPaused((value) => !value), [])

  useEffect(() => {
    if (reduced) {
      // why: reduced motion halts the loop entirely, so stale ring progress and any mid-flight skip are discarded.
      applyProgress(0)
      setFastForwarding(false)
      fastForwardStartRef.current = null
      startTimeRef.current = 0
      return
    }
    if (paused) {
      // why: pausing freezes the ring in place; resuming re-seeds the cycle from the frozen percentage.
      startTimeRef.current = 0
      return
    }
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp - (progressRef.current / 100) * cycleDuration
      }
      const start = fastForwardStartRef.current
      if (fastForwarding && start) {
        // how: an ease-out cubic drains the remaining ring over fastForwardDuration, then the demo advances.
        const eased = 1 - pow(1 - min((timestamp - start.time) / fastForwardDuration, 1), 3)
        const next = start.progress + (100 - start.progress) * eased
        if (next >= 100) {
          advance()
        } else {
          applyProgress(next)
        }
      } else {
        const next = ((timestamp - startTimeRef.current) / cycleDuration) * 100
        if (next >= 100) {
          advance()
        } else {
          applyProgress(next)
        }
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [advance, applyProgress, cycleDuration, fastForwardDuration, fastForwarding, paused, reduced])

  // why: whoever hosts the showcase may tint surrounding ambience (the hero lattice) toward the staged demo; the latest-ref keeps the notification out of the rotation effect's deps.
  const notifyActive = useRef(onActive)
  notifyActive.current = onActive
  useEffect(() => {
    const entry = entries[activeIndex]
    if (entry) {
      notifyActive.current?.(entry)
    }
  }, [activeIndex, entries])

  const active = entries[activeIndex]
  if (!active) {
    return null
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center p-4 lg:p-8">
      <ShowcaseAmbient entries={entries} activeIndex={activeIndex} />
      <div className="relative w-full max-w-2xl">
        <div className="absolute inset-0 z-0 rounded-2xl border border-white/30 dark:border-white/20" />
        <div className="relative z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-900/5 p-6 backdrop-blur-sm dark:bg-white/5 lg:p-8">
          {/* note: All entries stay mounted as stacked layers — rotation only toggles visibility, so the embed's session survives every wrap. */}
          <div className="relative aspect-square w-full max-w-md">
            {entries.map((entry, index) => (
              <div
                key={entry.slug}
                inert={index !== activeIndex}
                className={`absolute inset-0 transition-opacity duration-500 ${index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                {entry.featureUrl ? (
                  <ClockEmbed entry={entry} className="h-full w-full" onStatus={setEmbedStatus} />
                ) : (
                  <DemoFallbackCard entry={entry} />
                )}
              </div>
            ))}
          </div>
          <div className="flex min-h-[4.5rem] w-full max-w-md flex-col items-center justify-center text-center">
            {active.featureUrl ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {embedStatus === 'live' ? (
                  <>Live demo — {active.stack}, embedded via its generated shell. </>
                ) : embedStatus === 'offline' ? (
                  <>Preview — the live demo is warming up on its own origin. </>
                ) : (
                  <>Connecting to the live demo on its own origin… </>
                )}
                <AllDemosLink />
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">{active.description}</p>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <AllDemosLink />
                </p>
              </>
            )}
          </div>
        </div>
        {reduced ? null : <ProgressBorder progress={progress} />}
        <div className="absolute -bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
          {reduced ? null : (
            <button
              type="button"
              onClick={togglePause}
              aria-pressed={paused}
              aria-label={paused ? 'Resume demo rotation' : 'Pause demo rotation'}
              className={CONTROL_BUTTON_CLASSES}
            >
              {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
            </button>
          )}
          {/* note: aria-disabled + the skip() guard instead of `disabled`, which would drop keyboard focus to body mid-fast-forward. */}
          <button
            type="button"
            onClick={skip}
            aria-disabled={fastForwarding}
            className={`${CONTROL_BUTTON_CLASSES} ${fastForwarding ? 'opacity-50' : ''}`}
            aria-label="Skip to next demo"
          >
            <SkipIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Props for {@link ShowcaseAmbient}. */
interface ShowcaseAmbientProps {
  /** The demo albums in rotation, in order. */
  entries: readonly DemoManifestEntry[]
  /** Index of the demo currently holding the stage. */
  activeIndex: number
}

/**
 * The ambient light behind the showcase frame: each demo's accent hue glows
 * out from the stage centre and crossfades as rotation hands the stage to the
 * next demo — the landing-page cousin of the demos-page deck glow, clipped to
 * the showcase's own container so it never bleeds into the rest of the hero.
 * @param root0
 * @param root0.entries
 * @param root0.activeIndex
 */
function ShowcaseAmbient({ entries, activeIndex }: ShowcaseAmbientProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {entries.map((entry, index) => {
        const theme = getDemoTheme(entry.slug)
        return (
          <div
            key={entry.slug}
            className={`absolute left-1/2 top-1/2 transition-opacity duration-1000 ${index === activeIndex ? 'opacity-100' : 'opacity-0'}`}
          >
            <div
              className={`absolute h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl sm:h-[28rem] sm:w-[36rem] ${theme.glowOuter}`}
            />
            <div
              className={`absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl sm:h-72 sm:w-72 ${theme.glowCore}`}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Shared styling for the showcase's floating control buttons. */
const CONTROL_BUTTON_CLASSES =
  'rounded-full bg-white/10 p-2 text-slate-500 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-slate-700 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'

/** The gallery link every showcase caption ends with. */
function AllDemosLink() {
  return (
    <a href="/demos" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
      All demos →
    </a>
  )
}

/** Props for {@link ProgressBorder}. */
interface ProgressBorderProps {
  /** Cycle progress percentage, 0–100. */
  progress: number
}

/**
 * The conic-gradient ring sweeping around the frame. XOR-masking two stacked
 * fills leaves only the 2px border edge painted, and pointer events pass
 * straight through, so the ring sits above the content without blocking it.
 * @param root0
 * @param root0.progress
 */
function ProgressBorder({ progress }: ProgressBorderProps) {
  if (progress <= 0) {
    return null
  }
  const angle = (progress / 100) * 360
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
      style={{
        background: `conic-gradient(from -90deg, #6366f1 ${angle}deg, transparent ${angle}deg)`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        maskComposite: 'exclude',
        padding: '2px',
      }}
    />
  )
}

/** Props for {@link SkipIcon}. */
interface SkipIconProps {
  /** Extra classes for the svg element. */
  className?: string
}

function SkipIcon({ className }: SkipIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v6.62c0 1.44 1.555 2.343 2.805 1.628L12 13.471v3.839c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.061C13.555 6.347 12 7.25 12 8.69v3.839L5.055 7.06z" />
    </svg>
  )
}

/** Props for {@link PauseIcon}. */
interface PauseIconProps {
  /** Extra classes for the svg element. */
  className?: string
}

function PauseIcon({ className }: PauseIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" />
    </svg>
  )
}

/** Props for {@link PlayIcon}. */
interface PlayIconProps {
  /** Extra classes for the svg element. */
  className?: string
}

function PlayIcon({ className }: PlayIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.3 4.19c-1.25-.714-2.8.188-2.8 1.628v12.364c0 1.44 1.55 2.342 2.8 1.628l10.82-6.182c1.26-.72 1.26-2.536 0-3.256L6.3 4.19z" />
    </svg>
  )
}
