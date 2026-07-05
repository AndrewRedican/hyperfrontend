'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { EmbedStatus } from './clock-embed'
import { BOUNDARY_LABELS } from '@/lib/demo-manifest'
import { useCallback, useEffect, useRef, useState } from 'react'
import { abs, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ClockEmbed } from './clock-embed'

/** Props for {@link CoverFlow}. */
export interface CoverFlowProps {
  /** The demo albums to page through, in order. */
  entries: readonly DemoManifestEntry[]
}

/** Pixels of drag that move the deck by one card. */
const DRAG_PIXELS_PER_CARD = 260

/** Exponential friction rate (1/ms) for thrown decks. */
const FRICTION = 0.004

/** Spring rate (1/ms) pulling the deck onto the snapped card. */
const SPRING = 0.011

/**
 * A CSS-3D cover-flow over the demo manifest.
 *
 * Horizontal on landscape, a vertical stack-flow on portrait; drag, wheel, and
 * arrow keys all carry momentum and snap onto a card. Only the centered card
 * mounts its live feature — neighbors render committed poster art. Under
 * reduced motion the deck flattens to a previous/next pager.
 * @param root0
 * @param root0.entries
 */
export function CoverFlow({ entries }: CoverFlowProps) {
  const [position, setPosition] = useState(0)
  const [vertical, setVertical] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('connecting')

  const physics = useRef({ position: 0, velocity: 0, dragging: false, lastPointer: 0, lastTime: 0, raf: 0, animating: false })

  const clampIndex = useCallback((value: number) => max(0, min(entries.length - 1, value)), [entries.length])

  useEffect(() => {
    const portrait = window.matchMedia('(orientation: portrait)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyPortrait = () => setVertical(portrait.matches)
    const applyMotion = () => setReduced(motion.matches)
    applyPortrait()
    applyMotion()
    portrait.addEventListener('change', applyPortrait)
    motion.addEventListener('change', applyMotion)
    return () => {
      portrait.removeEventListener('change', applyPortrait)
      motion.removeEventListener('change', applyMotion)
    }
  }, [])

  const step = useCallback(
    (now: number) => {
      const state = physics.current
      const dt = min(48, now - state.lastTime)
      state.lastTime = now
      if (!state.dragging) {
        // how: Momentum decays exponentially while a spring pulls toward the nearest card, so a throw glides and lands in one motion.
        const target = clampIndex(round(state.position + state.velocity / FRICTION))
        state.velocity += -SPRING * SPRING * (state.position - target) * dt - 2 * SPRING * state.velocity * dt
        state.position += state.velocity * dt
        if (abs(state.position - target) < 0.002 && abs(state.velocity) < 0.00005) {
          state.position = target
          state.velocity = 0
          state.animating = false
        }
      }
      state.position = max(-0.3, min(entries.length - 0.7, state.position))
      setPosition(state.position)
      if (state.animating) {
        state.raf = requestAnimationFrame(step)
      }
    },
    [clampIndex, entries.length]
  )

  const wake = useCallback(() => {
    const state = physics.current
    if (state.animating) {
      return
    }
    state.animating = true
    state.lastTime = performance.now()
    state.raf = requestAnimationFrame(step)
  }, [step])

  useEffect(() => {
    const state = physics.current
    return () => cancelAnimationFrame(state.raf)
  }, [])

  const goTo = useCallback(
    (index: number) => {
      const state = physics.current
      // how: Seed exactly the velocity whose momentum travel reaches the target.
      state.velocity = (clampIndex(index) - state.position) * FRICTION
      state.dragging = false
      wake()
    },
    [clampIndex, wake]
  )

  const jumpTo = useCallback(
    (index: number) => {
      const state = physics.current
      state.position = clampIndex(index)
      state.velocity = 0
      setPosition(state.position)
    },
    [clampIndex]
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = physics.current
    state.dragging = true
    state.velocity = 0
    state.lastPointer = vertical ? event.clientY : event.clientX
    state.lastTime = performance.now()
    event.currentTarget.setPointerCapture(event.pointerId)
    wake()
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = physics.current
    if (!state.dragging) {
      return
    }
    const pointer = vertical ? event.clientY : event.clientX
    const delta = (state.lastPointer - pointer) / DRAG_PIXELS_PER_CARD
    const now = performance.now()
    const dt = now - state.lastTime
    state.position += delta
    if (dt > 0) {
      state.velocity = delta / dt
    }
    state.lastPointer = pointer
    state.lastTime = now
    setPosition(state.position)
  }

  const onPointerUp = () => {
    physics.current.dragging = false
    wake()
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const state = physics.current
    state.position += (event.deltaY + event.deltaX) / (DRAG_PIXELS_PER_CARD * 4)
    state.velocity = 0
    wake()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const previous = vertical ? 'ArrowUp' : 'ArrowLeft'
    const next = vertical ? 'ArrowDown' : 'ArrowRight'
    if (event.key !== previous && event.key !== next) {
      return
    }
    event.preventDefault()
    goTo(round(physics.current.position) + (event.key === next ? 1 : -1))
  }

  const centered = clampIndex(round(position))
  const current = entries[centered]

  if (reduced) {
    return <PagerFallback entries={entries} index={centered} onSelect={jumpTo} />
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Demo gallery"
        tabIndex={0}
        className={`relative w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${vertical ? 'h-[30rem]' : 'h-96'}`}
        style={{ perspective: '1200px' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {entries.map((entry, index) => (
          <CoverFlowCard
            key={entry.slug}
            entry={entry}
            offset={index - position}
            vertical={vertical}
            live={index === centered && abs(index - position) < 0.25}
            onSelect={() => goTo(index)}
            onStatus={setEmbedStatus}
          />
        ))}
      </div>
      {current ? (
        <div className="max-w-xl text-center">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{current.title}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{current.description}</p>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">{current.stack}</span>
            <span className="rounded-full bg-orange-100 px-2.5 py-1 font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              boundary: {BOUNDARY_LABELS[current.boundary]}
            </span>
            {current.featureUrl && embedStatus === 'offline' ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                warming up — poster preview
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Props for {@link CoverFlowCard}. */
interface CoverFlowCardProps {
  entry: DemoManifestEntry
  offset: number
  vertical: boolean
  live: boolean
  onSelect: () => void
  onStatus: (status: EmbedStatus) => void
}

function CoverFlowCard({ entry, offset, vertical, live, onSelect, onStatus }: CoverFlowCardProps) {
  const distance = abs(offset)
  const translate = offset * (vertical ? 55 : 60)
  const transform = vertical
    ? `translate(-50%, -50%) translateY(${translate}%) rotateX(${max(-38, min(38, -offset * 32))}deg) translateZ(${-distance * 140}px)`
    : `translate(-50%, -50%) translateX(${translate}%) rotateY(${max(-38, min(38, -offset * 32))}deg) translateZ(${-distance * 140}px)`
  return (
    <div
      className="absolute left-1/2 top-1/2 aspect-square w-72 sm:w-80"
      style={{ transform, zIndex: 100 - round(distance * 10), opacity: max(0, 1 - distance * 0.28), transformStyle: 'preserve-3d' }}
    >
      {live && entry.featureUrl ? (
        <ClockEmbed featureUrl={entry.featureUrl} poster={entry.poster} className="h-full w-full" onStatus={onStatus} />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          aria-label={`Show the ${entry.title} demo`}
          tabIndex={-1}
        >
          <img src={entry.poster} alt={`${entry.title} demo poster`} className="h-full w-full object-cover" draggable={false} />
        </button>
      )}
    </div>
  )
}

/** Props for {@link PagerFallback}. */
interface PagerFallbackProps {
  entries: readonly DemoManifestEntry[]
  index: number
  onSelect: (index: number) => void
}

/**
 * Reduced-motion fallback: one flat card with previous/next paging — no 3D, no
 * momentum, no autoplaying anything.
 * @param root0
 * @param root0.entries
 * @param root0.index
 * @param root0.onSelect
 */
function PagerFallback({ entries, index, onSelect }: PagerFallbackProps) {
  const entry = entries[index]
  if (!entry) {
    return null
  }
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="aspect-square w-72 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 sm:w-80">
        {entry.featureUrl ? (
          <ClockEmbed featureUrl={entry.featureUrl} poster={entry.poster} className="h-full w-full" />
        ) : (
          <img src={entry.poster} alt={`${entry.title} demo poster`} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="max-w-xl text-center">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{entry.title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{entry.description}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
          disabled={index === 0}
          onClick={() => onSelect(index - 1)}
        >
          ← Previous
        </button>
        <span className="text-xs text-slate-500">
          {index + 1} / {entries.length}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
          disabled={index === entries.length - 1}
          onClick={() => onSelect(index + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
