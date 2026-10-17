'use client'

import type { CSSProperties, FocusEvent as ReactFocusEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { DiscoveryContent, DiscoveryId, DiscoveryItem } from './discovery-model'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { abs, cos, max, min, PI, round, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import {
  cancelAnimationFrame,
  clearTimeout,
  requestAnimationFrame,
  setTimeout,
} from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ArrowGlyph, DiscoveryIcon, PlayGlyph } from './discovery-icons'
import { LAUNCH_FILM } from './discovery-model'
import { DiscoveryPanel, PanelShell } from './discovery-panel'
import { LaunchFilmDialog } from './launch-film-dialog'

/** The five tiles, in the order they first sit on the arc, left to right. */
const ITEMS: readonly DiscoveryItem[] = [
  {
    id: 'tutorials',
    title: 'Tutorials',
    description: 'Learn by building something real, one step at a time, ending with a working result.',
    href: '/docs/guides/?type=tutorial',
  },
  {
    id: 'how-to',
    title: 'How-to guides',
    description: 'Have a job to do? Follow a direct route from the problem you have to the outcome you want.',
    href: '/docs/guides/?type=how-to',
  },
  {
    id: 'film',
    title: 'The launch film',
    description: 'Seventy-eight seconds on what HyperFrontend is for.',
    href: null,
  },
  {
    id: 'demos',
    title: 'Live demos',
    description: 'Real feature apps on their own origins, composed here and running in your browser right now.',
    href: '/demos',
  },
  {
    id: 'articles',
    title: 'Articles',
    description: 'Long-form writing on the architecture: the pressures that produce it and the reasoning behind it.',
    href: '/articles',
  },
]

/** How long a tile holds the focus before the arc turns, in milliseconds. */
const CYCLE_MS = 8000

/** How much of the arc has to be on screen for it to count as what the reader is looking at. */
const PRIMARY_VISIBILITY = 0.5

/** How long the arc has to stay on screen before it counts as looked at rather than scrolled past, in milliseconds. */
const SETTLE_MS = 1000

/** How many positions the arc has: one per tile. */
const SLOTS = ITEMS.length

/** The position at the foot of the arc, where the focused tile sits. */
const FOCUS_SLOT = 2

/** Angle between neighbouring positions on the arc, in radians. */
const STEP = (18 * PI) / 180

/** The arc's radius as a fraction of the row's width. */
const RADIUS_RATIO = 0.68

/** A tile's width as a fraction of the row's width, within the bounds below. */
const TILE_RATIO = 0.185

/** The narrowest and widest a tile is drawn, in pixels. */
const TILE_WIDTH = { min: 168, max: 232 }

/** A tile's height as a fraction of its width. */
const TILE_ASPECT = 0.82

/** How large a tile is drawn at each position; the focused one leans forward, the ends fall back. */
const SLOT_SCALE: readonly number[] = [0.88, 0.96, 1.08, 0.96, 0.88]

/** How long a tile that leaves one end of the arc takes to fade before it reappears at the other, in milliseconds. */
const LEAVE_MS = 240

/** How long a touch on the arc holds the rotation, in milliseconds. */
const TOUCH_HOLD_MS = 12000

/** The row width the arc is laid out for before it has measured itself. */
const ASSUMED_WIDTH = 1184

/** No tiles at all. */
const NONE: ReadonlySet<DiscoveryId> = createSet<DiscoveryId>()

/** Where the arc's positions fall for one row width. */
interface ArcGeometry {
  /** Radius of the circle the positions sit on */
  radius: number
  /** Width of a tile at scale one */
  tileW: number
  /** Height of a tile at scale one */
  tileH: number
  /** How far below the arc's ends its foot sits */
  rise: number
}

/** Where a position sits, relative to the row's top centre. */
interface Placement {
  /** The tile centre's horizontal offset */
  x: number
  /** The tile's top edge's vertical offset */
  y: number
  /** The tile's scale */
  scale: number
}

/** Props for {@link DiscoveryArc}. */
interface DiscoveryArcProps {
  /** Everything the panels draw from */
  content: DiscoveryContent
}

/**
 * Which position a tile holds for a given turn of the arc.
 *
 * Tiles move toward the lower positions as the arc turns, so the tile to the
 * right of the focus is the next one into it, and the tile that leaves the
 * left end comes back in at the right.
 * @param index - The tile's place in {@link ITEMS}
 * @param offset - How many turns the arc has made
 * @returns The position, 0 at the left end
 */
function slotOf(index: number, offset: number): number {
  return (((index - offset) % SLOTS) + SLOTS) % SLOTS
}

/**
 * Lay the arc out for one row width.
 * @param width - The row's width in pixels
 * @returns The positions' geometry
 */
function measureArc(width: number): ArcGeometry {
  const tileW = max(TILE_WIDTH.min, min(TILE_WIDTH.max, width * TILE_RATIO))
  const radius = width * RADIUS_RATIO
  return { radius, tileW, tileH: round(tileW * TILE_ASPECT), rise: (1 - cos(STEP * FOCUS_SLOT)) * radius }
}

/**
 * Where a position sits, relative to the row's top centre.
 * @param slot - The position
 * @param geometry - The arc's geometry
 * @returns Its centre's horizontal offset, its top edge's vertical offset, and its scale
 */
function place(slot: number, geometry: ArcGeometry): Placement {
  const angle = (slot - FOCUS_SLOT) * STEP
  return { x: sin(angle) * geometry.radius, y: geometry.rise - (1 - cos(angle)) * geometry.radius, scale: SLOT_SCALE[slot] ?? 1 }
}

/**
 * The discovery arc: the four kinds of documentation and the launch film as
 * five tiles along the lower half of a circle, turning one position every
 * few seconds so each in turn comes to the foot and opens its own shelf
 * beneath. A tile can be brought to the foot by hand, which also stops the
 * turning, since a reader who chose something should keep it; the pointer,
 * the keyboard, the player, and a tab out of view all hold the arc still, and
 * so does scrolling on past it, so the shelf under it never changes under a
 * reader who is reading it. Whatever held it, it comes back with a whole
 * cycle ahead of it. Under reduced motion it never turns on its own at all.
 *
 * Below the desktop breakpoint the circle gives way to a row of chips that
 * scrolls sideways, with the same tiles, the same turning, and the same shelf
 * under it: a phone has no room for an arc, and a chip strip is a shape a
 * thumb already knows.
 * @param props - See {@link DiscoveryArcProps}.
 * @param props.content - Everything the panels draw from
 * @returns The arc, its controls, and the shelf beneath.
 */
export function DiscoveryArc({ content }: DiscoveryArcProps) {
  const [offset, setOffset] = useState(0)
  const [leaving, setLeaving] = useState<ReadonlySet<DiscoveryId>>(NONE)
  const [jumping, setJumping] = useState<ReadonlySet<DiscoveryId>>(NONE)
  const [paused, setPaused] = useState(false)
  const [filmOpen, setFilmOpen] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [touchHeld, setTouchHeld] = useState(false)
  const [visible, setVisible] = useState(false)
  const [awake, setAwake] = useState(true)
  const [geometry, setGeometry] = useState<ArcGeometry>(() => measureArc(ASSUMED_WIDTH))
  const [measured, setMeasured] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const arcRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const reducedRef = useRef(false)
  const progressRef = useRef(0)
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const settleFrame = useRef(0)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyMotion = () => {
      reducedRef.current = motion.matches
      setReduced(motion.matches)
    }
    applyMotion()
    motion.addEventListener('change', applyMotion)
    return () => motion.removeEventListener('change', applyMotion)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let settling: ReturnType<typeof setTimeout> | undefined
    // why: the tiles alone decide whether the arc is what the reader is looking at; a reader who has scrolled down to the shelf is reading it, and the shelf has to hold still for them
    const observer = new IntersectionObserver(
      ([entry]) => {
        const primary = (entry?.isIntersecting ?? false) && (entry?.intersectionRatio ?? 0) >= PRIMARY_VISIBILITY
        if (settling !== undefined) clearTimeout(settling)
        settling = undefined
        if (!primary) {
          setVisible(false)
          return
        }
        // why: a reader scrolling past takes the arc through its threshold on the way down; a second's dwell separates them from a reader who has stopped on it
        settling = setTimeout(() => {
          settling = undefined
          setVisible(true)
        }, SETTLE_MS)
      },
      { threshold: [0, PRIMARY_VISIBILITY] }
    )
    observer.observe(stage)
    const onVisibility = () => setAwake(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      if (settling !== undefined) clearTimeout(settling)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const arc = arcRef.current
    if (!arc) return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0
      // why: below the desktop breakpoint the arc is display none and measures zero; the chips take over and the arc keeps its last geometry for when the window widens again
      if (width > 0) {
        setGeometry(measureArc(width))
        setMeasured(true)
      }
    })
    observer.observe(arc)
    return () => observer.disconnect()
  }, [])

  useEffect(
    () => () => {
      if (phaseTimer.current !== undefined) clearTimeout(phaseTimer.current)
      if (touchTimer.current !== undefined) clearTimeout(touchTimer.current)
      cancelAnimationFrame(settleFrame.current)
    },
    []
  )

  const rotateTo = useCallback((next: number) => {
    const current = offsetRef.current
    const target = ((next % SLOTS) + SLOTS) % SLOTS
    progressRef.current = 0
    if (target === current) return
    if (phaseTimer.current !== undefined) clearTimeout(phaseTimer.current)
    cancelAnimationFrame(settleFrame.current)
    // why: a tile whose position changes by more than two would slide across the whole arc on a chord through the middle; it fades out at one end and back in at the other instead
    const jumpers = createSet<DiscoveryId>()
    ITEMS.forEach((item, index) => {
      if (abs(slotOf(index, target) - slotOf(index, current)) > 2) jumpers.add(item.id)
    })
    const commit = () => {
      offsetRef.current = target
      setOffset(target)
      setLeaving(NONE)
      setJumping(jumpers)
      // why: the jumped tiles land with transitions off and opacity zero; two frames later the transitions come back and they fade in where they landed
      settleFrame.current = requestAnimationFrame(() => {
        settleFrame.current = requestAnimationFrame(() => setJumping(NONE))
      })
    }
    if (jumpers.size === 0 || reducedRef.current) {
      commit()
      return
    }
    setLeaving(jumpers)
    phaseTimer.current = setTimeout(commit, LEAVE_MS)
  }, [])

  const running = !paused && !hovering && !focusWithin && !touchHeld && !filmOpen && visible && awake && !reduced

  useEffect(() => {
    if (!running) return
    // why: whatever stopped the arc, it comes back with a whole cycle ahead of it; a turn that fires the moment the reader returns, or several turns to make up for lost time, would be the arc catching up on a reader who was never watching
    progressRef.current = 0
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      if (last) progressRef.current = min(1, progressRef.current + (now - last) / CYCLE_MS)
      last = now
      if (progressRef.current >= 1) {
        rotateTo(offsetRef.current + 1)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, rotateTo])

  const focusedIndex = (FOCUS_SLOT + offset) % SLOTS
  const focusedId = ITEMS[focusedIndex]?.id ?? 'film'

  useEffect(() => {
    const strip = stripRef.current
    if (!strip || strip.clientWidth === 0) return
    const chip = strip.children[focusedIndex]
    if (!(chip instanceof HTMLElement)) return
    // why: the strip scrolls itself rather than calling scrollIntoView, which would also drag the page to the chip
    strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' })
  }, [focusedIndex, reduced])

  const select = (index: number) => {
    if (index === focusedIndex) {
      if (ITEMS[index]?.id === 'film') setFilmOpen(true)
      return
    }
    // why: a reader who chose a tile should keep it; the arc stops turning on its own until they ask it to go again
    setPaused(true)
    rotateTo(index - FOCUS_SLOT)
  }

  const onPointerEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') setHovering(true)
  }
  const onPointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') setHovering(false)
  }
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') return
    setTouchHeld(true)
    if (touchTimer.current !== undefined) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => setTouchHeld(false), TOUCH_HOLD_MS)
  }
  const onFocus = () => setFocusWithin(true)
  const onBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false)
  }

  const arcHeight = round(geometry.rise + geometry.tileH * (SLOT_SCALE[FOCUS_SLOT] ?? 1) + 12)

  return (
    <div
      ref={rootRef}
      className="discovery-arc"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div ref={stageRef}>
        {/* The arc, from the desktop breakpoint up */}
        <div
          ref={arcRef}
          role="group"
          aria-label="Explore the documentation"
          className="relative hidden lg:block"
          style={{ height: arcHeight }}
        >
          {ITEMS.map((item, index) => {
            const slot = slotOf(index, offset)
            const focused = slot === FOCUS_SLOT
            const spot = place(slot, geometry)
            const style: CSSProperties = {
              width: geometry.tileW,
              height: geometry.tileH,
              transform: `translate(calc(-50% + ${spot.x.toFixed(1)}px), ${spot.y.toFixed(1)}px) scale(${spot.scale})`,
              zIndex: 10 - abs(slot - FOCUS_SLOT) * 2,
            }
            const state = leaving.has(item.id) ? 'leaving' : jumping.has(item.id) ? 'jumping' : focused ? 'focused' : 'resting'
            return <ArcTile key={item.id} item={item} state={state} settled={measured} style={style} onSelect={() => select(index)} />
          })}
        </div>

        {/* The chips, below the desktop breakpoint */}
        <div className="lg:hidden">
          <div
            ref={stripRef}
            role="group"
            aria-label="Explore the documentation"
            className="discovery-strip -mx-6 flex gap-2 overflow-x-auto px-6 pb-3 sm:-mx-8 sm:px-8"
          >
            {ITEMS.map((item, index) => {
              const focused = index === focusedIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={focused}
                  onClick={() => select(index)}
                  className={`discovery-chip flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    focused
                      ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950/50 dark:text-primary-200'
                      : 'border-slate-200/80 bg-white/70 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/55 dark:text-slate-300'
                  }`}
                >
                  {item.id === 'film' ? <PlayGlyph className="h-4 w-4" /> : <DiscoveryIcon id={item.id} className="h-4 w-4" />}
                  {item.title}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 min-h-[21rem] lg:mt-6">
        <PanelShell label={ITEMS[focusedIndex]?.title ?? ''}>
          <div key={focusedId} className="discovery-panel__enter">
            <DiscoveryPanel focused={focusedId} content={content} onPlay={() => setFilmOpen(true)} />
          </div>
        </PanelShell>
      </div>

      <LaunchFilmDialog open={filmOpen} onClose={() => setFilmOpen(false)} />
    </div>
  )
}

/** Props for {@link ArcTile}. */
interface ArcTileProps {
  /** The tile's category */
  item: DiscoveryItem
  /** What the tile is doing: holding the focus, resting, fading out at one end, or landing at the other */
  state: 'focused' | 'resting' | 'leaving' | 'jumping'
  /** Whether the arc has measured its row; before that the tile takes its position without sliding there */
  settled: boolean
  /** The tile's size and place on the arc */
  style: CSSProperties
  /** Brings the tile to the focus, or plays the film once it is there */
  onSelect: () => void
}

/**
 * One tile on the arc. The whole tile is the control that brings it to the
 * focus; the category's destination is a separate link in its corner, so
 * choosing a tile and leaving for its index stay two different acts.
 * @param props - See {@link ArcTileProps}.
 * @param props.item - The tile's category
 * @param props.state - What the tile is doing
 * @param props.settled - Whether the arc has measured its row
 * @param props.style - The tile's size and place on the arc
 * @param props.onSelect - Brings the tile to the focus, or plays the film once it is there
 * @returns The tile.
 */
function ArcTile({ item, state, settled, style, onSelect }: ArcTileProps) {
  const focused = state === 'focused'
  const film = item.id === 'film'
  const label = film
    ? focused
      ? 'Play the launch film'
      : 'Show the launch film'
    : focused
      ? `${item.title} are showing`
      : `Show ${item.title.toLowerCase()}`
  return (
    <div
      className={`arc-tile group absolute left-1/2 top-0 arc-tile--${state} ${settled ? '' : 'arc-tile--unsettled'} ${film ? 'arc-tile--film' : ''}`}
      style={style}
      data-koi-lit
    >
      <button type="button" className="arc-tile__select" aria-pressed={film ? undefined : focused} aria-label={label} onClick={onSelect}>
        {film ? <FilmFace focused={focused} /> : <CategoryFace item={item} />}
      </button>
      {item.href ? (
        <Link href={item.href} className="arc-tile__go" aria-label={`Open ${item.title.toLowerCase()}`}>
          <ArrowGlyph className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  )
}

/** Props for {@link CategoryFace}. */
interface CategoryFaceProps {
  /** The category the face names */
  item: DiscoveryItem
}

/**
 * A category tile's face: its title and its glyph on one row, the promise beneath.
 * @param props - See {@link CategoryFaceProps}.
 * @param props.item - The category the face names
 * @returns The face.
 */
function CategoryFace({ item }: CategoryFaceProps) {
  return (
    <span className="flex h-full flex-col p-5 text-left">
      <span className="flex items-center justify-between gap-5">
        <span className="font-display text-base font-semibold leading-tight text-slate-900 dark:text-white">{item.title}</span>
        <span className="inline-flex shrink-0 rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
          <DiscoveryIcon id={item.id} className="h-5 w-5" />
        </span>
      </span>
      <span className="mt-2.5 line-clamp-4 text-xs leading-5 text-slate-600 dark:text-slate-400">{item.description}</span>
    </span>
  )
}

/** Props for {@link FilmFace}. */
interface FilmFaceProps {
  /** Whether the tile holds the focus, where pressing it plays the film */
  focused: boolean
}

/**
 * The film tile's face: the poster, with the title and a play mark on the same row the other tiles put theirs.
 * @param props - See {@link FilmFaceProps}.
 * @param props.focused - Whether the tile holds the focus
 * @returns The face.
 */
function FilmFace({ focused }: FilmFaceProps) {
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-[inherit] bg-slate-900">
      <img src={LAUNCH_FILM.poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
      <span className="absolute inset-x-0 top-0 bg-linear-to-b from-slate-950/80 via-slate-950/40 to-transparent px-5 pb-8 pt-4">
        <span className="flex items-center justify-between gap-5">
          <span className="font-display text-base font-semibold leading-tight text-white">The launch film</span>
          <span
            className={`inline-flex shrink-0 rounded-full p-2 text-white backdrop-blur-xs transition-colors ${focused ? 'bg-primary-500/80' : 'bg-white/20'}`}
          >
            <PlayGlyph className="h-5 w-5" />
          </span>
        </span>
      </span>
      <span className="absolute bottom-3 left-5 rounded-full bg-slate-950/60 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-white/90 backdrop-blur-xs">
        {LAUNCH_FILM.duration}
      </span>
    </span>
  )
}
