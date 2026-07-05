'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { EmbedStatus } from './clock-embed'
import { useCallback, useEffect, useRef, useState } from 'react'
import { min, pow } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ClockEmbed } from './clock-embed'

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
}

/**
 * The landing-page demo showcase: one manifest entry at a time inside a framed
 * card, with a conic-gradient ring sweeping around the frame until the next
 * demo takes over.
 *
 * Live entries mount through their vendored shell embed; planned entries show
 * committed poster art. The ring and the pause/skip controls paint above the
 * content — the buttons hang half outside the frame — so nothing the embed or
 * its poster renders can ever cover them. Pausing freezes the ring and holds
 * the current demo. Under reduced motion nothing auto-advances: the ring and
 * pause disappear and the skip button becomes a plain next button.
 * @param root0
 * @param root0.entries
 * @param root0.cycleDuration
 * @param root0.fastForwardDuration
 */
export function DemoShowcase({ entries, cycleDuration = 20000, fastForwardDuration = 2000 }: DemoShowcaseProps) {
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
    setEmbedStatus('connecting')
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

  const active = entries[activeIndex]
  if (!active) {
    return null
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center p-4 lg:p-8">
      <div className="relative w-full max-w-2xl">
        <div className="absolute inset-0 z-0 rounded-2xl border border-white/30 dark:border-white/20" />
        {/* note: keyed on the slug so switching demos unmounts the previous entry's embed outright */}
        <div
          key={active.slug}
          className="relative z-10 flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl bg-slate-900/5 p-6 backdrop-blur-sm dark:bg-white/5 lg:min-h-[500px] lg:p-8"
        >
          {active.featureUrl ? (
            <>
              <ClockEmbed
                featureUrl={active.featureUrl}
                poster={active.poster}
                className="aspect-square w-full max-w-md"
                onStatus={setEmbedStatus}
              />
              <p className="text-center text-xs text-slate-600 dark:text-slate-400">
                {embedStatus === 'live' ? (
                  <>Live demo — {active.stack}, embedded via its generated shell. </>
                ) : embedStatus === 'offline' ? (
                  <>Preview — the live demo is warming up on its own origin. </>
                ) : (
                  <>Connecting to the live demo on its own origin… </>
                )}
                <AllDemosLink />
              </p>
            </>
          ) : (
            <>
              <img
                src={active.poster}
                alt={`${active.title} demo poster`}
                draggable={false}
                className="aspect-square w-full max-w-md rounded-2xl object-cover"
              />
              <div className="max-w-md text-center">
                <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">{active.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{active.description}</p>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                  <AllDemosLink />
                </p>
              </div>
            </>
          )}
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
