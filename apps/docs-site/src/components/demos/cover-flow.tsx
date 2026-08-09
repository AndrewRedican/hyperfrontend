'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { EmbedStatus } from './demo-embed'
import type { DemoShell } from './demo-wiring'
import { BOUNDARY_LABELS } from '@/lib/demo-manifest'
import { useCallback, useEffect, useRef, useState } from 'react'
import { abs, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { DemoEmbed } from './demo-embed'
import { DemoFallbackCard, getDemoTheme, restingStatusFor } from './demo-fallback-card'
import { RingControl } from './ring-control'

/** Props for {@link CoverFlow}. */
export interface CoverFlowProps {
  /** The demo albums to page through, in order. */
  entries: readonly DemoManifestEntry[]
  /** Receives the centered live demo's shell handle, and `null` while none is mounted. */
  onShell?: (shell: DemoShell | null) => void
  /** Notified whenever a different demo settles into the center. */
  onCentered?: (entry: DemoManifestEntry) => void
}

/** Pixels of drag that move the deck by one card. */
const DRAG_PIXELS_PER_CARD = 260

/** Pixels of drag on the side dial that move the deck by one card. */
const RING_DRAG_PIXELS_PER_CARD = 56

/** Exponential friction rate (1/ms) for thrown decks. */
const FRICTION = 0.004

/** Spring rate (1/ms) pulling the deck onto the snapped card. */
const SPRING = 0.011

/**
 * A CSS-3D cover-flow over the demo manifest.
 *
 * Horizontal on landscape, a vertical stack-flow on portrait; drag, wheel, and
 * arrow keys all carry momentum and snap onto a card. Only the centered card
 * mounts its live feature — every other card renders the demo's themed
 * fallback card. Under reduced motion the deck flattens to a previous/next
 * pager.
 * @param root0
 * @param root0.entries
 * @param root0.onShell
 * @param root0.onCentered
 */
export function CoverFlow({ entries, onShell, onCentered }: CoverFlowProps) {
  const [position, setPosition] = useState(0)
  const [vertical, setVertical] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('connecting')
  const [expanded, setExpanded] = useState(false)

  const physics = useRef({ position: 0, velocity: 0, dragging: false, lastPointer: 0, lastTime: 0, raf: 0, animating: false })

  // why: The expand/collapse cue crosses to the running feature (a translucency hint, not a lifecycle event), so the deck keeps its own handle on the centered shell.
  const shellRef = useRef<DemoShell | null>(null)
  const holdShell = useCallback(
    (shell: DemoShell | null) => {
      shellRef.current = shell
      onShell?.(shell)
    },
    [onShell]
  )

  const setScene = useCallback((scene: 'card' | 'full') => {
    shellRef.current?.send('set-scene', { scene })
  }, [])

  const expand = useCallback(() => {
    setExpanded(true)
    setScene('full')
  }, [setScene])

  const collapse = useCallback(() => {
    setExpanded(false)
    setScene('card')
  }, [setScene])

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

  const dragBegin = useCallback(
    (event: React.PointerEvent<HTMLElement>, pointer: number) => {
      const state = physics.current
      state.dragging = true
      state.velocity = 0
      state.lastPointer = pointer
      state.lastTime = performance.now()
      event.currentTarget.setPointerCapture(event.pointerId)
      wake()
    },
    [wake]
  )

  const dragMove = useCallback((pointer: number, pixelsPerCard: number) => {
    const state = physics.current
    if (!state.dragging) {
      return
    }
    const delta = (state.lastPointer - pointer) / pixelsPerCard
    const now = performance.now()
    const dt = now - state.lastTime
    state.position += delta
    if (dt > 0) {
      state.velocity = delta / dt
    }
    state.lastPointer = pointer
    state.lastTime = now
    setPosition(state.position)
  }, [])

  const dragEnd = useCallback(() => {
    physics.current.dragging = false
    wake()
  }, [wake])

  const spin = useCallback(
    (delta: number, pixelsPerCard: number) => {
      const state = physics.current
      state.position += delta / (pixelsPerCard * 4)
      state.velocity = 0
      wake()
    },
    [wake]
  )

  // why: On portrait the deck itself must not capture drags or wheel — those belong to normal page scrolling; the side dial navigates instead.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!vertical) {
      dragBegin(event, event.clientX)
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!vertical) {
      dragMove(event.clientX, DRAG_PIXELS_PER_CARD)
    }
  }

  const onPointerUp = () => {
    if (!vertical) {
      dragEnd()
    }
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!vertical) {
      spin(event.deltaY + event.deltaX, DRAG_PIXELS_PER_CARD)
    }
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

  // why: The presentation cue must survive feature reloads — every fresh proof of life re-tells the pond whether it is a masked card or the revealed overlay.
  useEffect(() => {
    if (embedStatus === 'live' && current?.expandable) {
      setScene(expanded ? 'full' : 'card')
    }
  }, [embedStatus, expanded, current?.expandable, setScene])

  useEffect(() => {
    if (!expanded) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        collapse()
      }
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [expanded, collapse])

  // why: Handing the stage to another demo tears the expanded session down with it; the overlay must not linger over a card that no longer owns it.
  useEffect(() => {
    setExpanded(false)
  }, [centered])

  // why: No embed may mount before the initial #<slug> deep-link is applied — otherwise the first card's feature opens a session only to be destroyed one frame later when the deck jumps to the linked demo.
  const [arrived, setArrived] = useState(false)

  // why: Holds the index a #<slug> deep-link is still traveling toward, so hash writes wait until the deck arrives instead of clobbering the link.
  const pendingHashTarget = useRef<number | null>(null)

  // why: /demos/#<slug> bookmarks a spot in the strip — restore it on load and follow later hash edits so shared links land on the right card.
  useEffect(() => {
    const indexForHash = () => {
      let slug = ''
      try {
        slug = decodeURIComponent(window.location.hash.slice(1))
      } catch {
        return -1
      }
      return slug ? entries.findIndex((entry) => entry.slug === slug) : -1
    }
    const initial = indexForHash()
    if (initial >= 0) {
      pendingHashTarget.current = initial
      jumpTo(initial)
    }
    setArrived(true)
    const onHashChange = () => {
      const index = indexForHash()
      if (index >= 0) {
        goTo(index)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [entries, goTo, jumpTo])

  // why: The console and caption follow whichever demo settles into the center, in both the deck and the reduced-motion pager.
  const notifyCentered = useRef(onCentered)
  notifyCentered.current = onCentered
  useEffect(() => {
    const entry = entries[centered]
    if (!entry) {
      return
    }
    notifyCentered.current?.(entry)
    if (pendingHashTarget.current !== null && pendingHashTarget.current !== centered) {
      return
    }
    pendingHashTarget.current = null
    // why: replaceState keeps the centered slug bookmarkable without stacking a history entry per swipe.
    if (window.location.hash !== `#${entry.slug}`) {
      window.history.replaceState(null, '', `#${entry.slug}`)
    }
  }, [centered, entries])

  if (reduced) {
    return <PagerFallback entries={entries} index={centered} live={arrived} onSelect={jumpTo} onShell={holdShell} />
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Demo gallery"
        tabIndex={0}
        className={`relative w-full select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${vertical ? 'h-[30rem]' : 'h-96 touch-none'}`}
        // why: Perspective makes this container the containing block for fixed descendants, so it has to lift while the centered card is stretched over the viewport.
        style={expanded ? undefined : { perspective: '1200px' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <AmbientGlow entries={entries} position={position} />
        {/* note: round() already gives the centered index ±0.5 of hysteresis, so gating on it alone keeps the embed mounted through spring overshoot. */}
        {entries.map((entry, index) => (
          <CoverFlowCard
            key={entry.slug}
            entry={entry}
            offset={index - position}
            vertical={vertical}
            live={index === centered && arrived}
            expanded={expanded && index === centered}
            onExpand={entry.expandable && index === centered && embedStatus === 'live' ? expand : undefined}
            onCollapse={collapse}
            onNeighbor={(direction) => {
              collapse()
              goTo(centered + direction)
            }}
            onSelect={() => goTo(index)}
            onStatus={setEmbedStatus}
            onShell={holdShell}
          />
        ))}
        {vertical ? (
          <RingControl
            titles={entries.map((entry) => entry.title)}
            position={position}
            centered={centered}
            onBegin={(event) => dragBegin(event, event.clientY)}
            onMove={(event) => dragMove(event.clientY, RING_DRAG_PIXELS_PER_CARD)}
            onEnd={dragEnd}
            onSpin={(delta) => spin(delta, RING_DRAG_PIXELS_PER_CARD)}
            onKeyNav={onKeyDown}
          />
        ) : null}
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
                warming up
              </span>
            ) : null}
          </p>
          <SourceLinks entry={current} />
        </div>
      ) : null}
    </div>
  )
}

/** Props for {@link AmbientGlow}. */
interface AmbientGlowProps {
  /** The demo albums in the deck, in order. */
  entries: readonly DemoManifestEntry[]
  /** The deck's fractional position, so glows crossfade mid-drag. */
  position: number
}

/**
 * The ambient light behind the deck: each demo's accent hue bleeds out from
 * the stage center at a strength matching how close its card is to the center,
 * so the backdrop crossfades between neighboring hues while the deck travels —
 * the same effect as a video player tinting the room around the screen.
 * @param root0
 * @param root0.entries
 * @param root0.position
 */
function AmbientGlow({ entries, position }: AmbientGlowProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {entries.map((entry, index) => {
        const strength = max(0, 1 - abs(index - position))
        if (strength === 0) {
          return null
        }
        const theme = getDemoTheme(entry.slug)
        return (
          <div key={entry.slug} className="absolute left-1/2 top-1/2" style={{ opacity: strength }}>
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

/** Props for {@link CoverFlowCard}. */
interface CoverFlowCardProps {
  entry: DemoManifestEntry
  offset: number
  vertical: boolean
  live: boolean
  /** `true` while this card is stretched over the viewport as the demo's overlay. */
  expanded: boolean
  /** Offered when this card can expand right now; absent hides the affordance. */
  onExpand?: () => void
  /** Collapses the overlay back into the card. */
  onCollapse: () => void
  /** Collapses and hands the stage to a neighbouring demo. */
  onNeighbor: (direction: -1 | 1) => void
  onSelect: () => void
  onStatus: (status: EmbedStatus) => void
  onShell?: (shell: DemoShell | null) => void
}

/**
 * One deck card. Expanded, the same element — same live iframe, same session —
 * restyles into a viewport overlay: the card was only ever a window onto the
 * running scene, and expanding it just widens the window.
 * @param root0
 * @param root0.entry
 * @param root0.offset
 * @param root0.vertical
 * @param root0.live
 * @param root0.expanded
 * @param root0.onExpand
 * @param root0.onCollapse
 * @param root0.onNeighbor
 * @param root0.onSelect
 * @param root0.onStatus
 * @param root0.onShell
 */
function CoverFlowCard({
  entry,
  offset,
  vertical,
  live,
  expanded,
  onExpand,
  onCollapse,
  onNeighbor,
  onSelect,
  onStatus,
  onShell,
}: CoverFlowCardProps) {
  const distance = abs(offset)
  const translate = offset * (vertical ? 55 : 60)
  const transform = vertical
    ? `translate(-50%, -50%) translateY(${translate}%) rotateX(${max(-38, min(38, -offset * 32))}deg) translateZ(${-distance * 140}px)`
    : `translate(-50%, -50%) translateX(${translate}%) rotateY(${max(-38, min(38, -offset * 32))}deg) translateZ(${-distance * 140}px)`
  return (
    <div
      className={expanded ? 'fixed inset-0 z-[200]' : 'absolute left-1/2 top-1/2 aspect-square w-72 sm:w-80'}
      style={
        expanded
          ? undefined
          : { transform, zIndex: 100 - round(distance * 10), opacity: max(0, 1 - distance * 0.28), transformStyle: 'preserve-3d' }
      }
    >
      {live && entry.featureUrl ? (
        <>
          <DemoEmbed entry={entry} className="h-full w-full" frameless={expanded} onStatus={onStatus} onShell={onShell} />
          {onExpand && !expanded ? (
            <button
              type="button"
              onClick={onExpand}
              // why: The deck's drag machinery pointer-captures presses on the container; without stopping propagation the capture retargets the click and the button never fires.
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900/70 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90"
              aria-label={`Expand the ${entry.title} demo over the page`}
            >
              Click to expand ⤢
            </button>
          ) : null}
          {expanded ? <ExpandedChrome title={entry.title} onCollapse={onCollapse} onNeighbor={onNeighbor} /> : null}
        </>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="h-full w-full rounded-2xl shadow-xl"
          aria-label={`Show the ${entry.title} demo`}
          tabIndex={-1}
        >
          <DemoFallbackCard entry={entry} status={restingStatusFor(entry)} />
        </button>
      )}
    </div>
  )
}

/** Props for {@link ExpandedChrome}. */
interface ExpandedChromeProps {
  /** The expanded demo's title, for the control labels. */
  title: string
  /** Collapses the overlay back into its card. */
  onCollapse: () => void
  /** Collapses and hands the stage to a neighbouring demo. */
  onNeighbor: (direction: -1 | 1) => void
}

/**
 * The overlay's own controls: close, and next/previous demo — the same
 * conventions the deck teaches, floated over the revealed scene.
 * @param root0
 * @param root0.title
 * @param root0.onCollapse
 * @param root0.onNeighbor
 */
function ExpandedChrome({ title, onCollapse, onNeighbor }: ExpandedChromeProps) {
  // why: The deck's drag machinery pointer-captures presses that bubble to the container; the overlay's controls must keep their presses to themselves.
  const keep = (event: React.PointerEvent) => event.stopPropagation()
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onClick={onCollapse}
        onPointerDown={keep}
        className="pointer-events-auto absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90"
        aria-label={`Close the expanded ${title} demo`}
      >
        ✕
      </button>
      <span className="pointer-events-none absolute right-14 top-6 text-[0.66rem] tracking-wider text-white/50">esc</span>
      <button
        type="button"
        onClick={() => onNeighbor(-1)}
        onPointerDown={keep}
        className="pointer-events-auto absolute left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90"
        aria-label="Previous demo"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => onNeighbor(1)}
        onPointerDown={keep}
        className="pointer-events-auto absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90"
        aria-label="Next demo"
      >
        →
      </button>
    </div>
  )
}

/** Props for {@link SourceLinks}. */
interface SourceLinksProps {
  /** The centered demo whose source locations to link. */
  entry: DemoManifestEntry
}

/**
 * GitHub links into the demo's host and hostee implementations, shown for
 * demos that have source to show.
 * @param root0
 * @param root0.entry
 */
function SourceLinks({ entry }: SourceLinksProps) {
  if (!entry.sourceLinks || entry.sourceLinks.length === 0) {
    return null
  }
  return (
    <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
      <span className="text-slate-500 dark:text-slate-500">Source:</span>
      {entry.sourceLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
        >
          {link.label} ↗
        </a>
      ))}
    </p>
  )
}

/** Props for {@link PagerFallback}. */
interface PagerFallbackProps {
  entries: readonly DemoManifestEntry[]
  index: number
  /** `false` while the initial deep-link is still being applied, so no embed mounts against the wrong card. */
  live: boolean
  onSelect: (index: number) => void
  onShell?: (shell: DemoShell | null) => void
}

/**
 * Reduced-motion fallback: one flat card with previous/next paging — no 3D, no
 * momentum, no autoplaying anything.
 * @param root0
 * @param root0.entries
 * @param root0.index
 * @param root0.live
 * @param root0.onSelect
 * @param root0.onShell
 */
function PagerFallback({ entries, index, live, onSelect, onShell }: PagerFallbackProps) {
  const entry = entries[index]
  if (!entry) {
    return null
  }
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-square w-72 sm:w-80">
        <div
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${getDemoTheme(entry.slug).glowOuter}`}
        />
        {live && entry.featureUrl ? (
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <DemoEmbed entry={entry} className="h-full w-full" onShell={onShell} />
          </div>
        ) : (
          <DemoFallbackCard entry={entry} status={restingStatusFor(entry)} />
        )}
      </div>
      <div className="max-w-xl text-center">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{entry.title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{entry.description}</p>
        <SourceLinks entry={entry} />
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
