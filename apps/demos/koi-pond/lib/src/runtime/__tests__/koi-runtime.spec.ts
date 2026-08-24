/**
 * @vitest-environment jsdom
 */
import type { FeatureLink, KoiRuntime } from '../../contract/wire.js'
import type { KoiCardDetails } from '../../model/card.js'
import type { KoiFramework, KoiOutline, KoiProfile, PondEnvironment, Vec2 } from '../../model/types.js'
import type { KoiState } from '../../motion/koi-motion.js'
import type { KoiRenderer } from '../koi-renderer.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describePond, describePondForFrame, entryStation } from '../../geometry/virtual-pond.js'
import { koiSeed, koiVariantSeed } from '../../model/traits.js'
import { KOI_PATH_MAX_POINTS } from '../../motion/predict.js'
import { createKoiRuntime } from '../koi-runtime.js'

/** A frame long enough to move a koi and short enough to stay under the clamp, in milliseconds. */
const FRAME_MS = 16

/** A gap that always crosses the outline cadence, in milliseconds. */
const REPORT_MS = 120

// why: The test document answers no media queries at all, and a koi asks one at boot to learn whether the visitor wants reduced motion.
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })

/** The window's schedulers as a browser types them, where a timer handle is a plain number. */
const scheduler = <
  { setTimeout: (handler: () => void, delay?: number) => number; setInterval: (handler: () => void, delay?: number) => number }
>(<unknown>window)

/** Everything one renderer was asked to do. */
interface RecordingRenderer extends KoiRenderer {
  /** Every frame it was asked to draw. */
  draws: Array<{ state: KoiState; dt: number }>
  /** Every hold it was told about. */
  selections: boolean[]
  /** Every hover it was told about. */
  hovers: boolean[]
  /** Every world it was told about. */
  ponds: PondEnvironment[]
  /** Every set of card facts it was handed. */
  cards: KoiCardDetails[]
  /** How many times it was asked to place the card. */
  placements: number
  /** How many times it was disposed. */
  disposals: number
}

/** A runtime under a hand-driven clock, with everything either side did written down. */
interface MountedKoi {
  /** The runtime itself. */
  runtime: KoiRuntime
  /** Every renderer it built, oldest first. */
  renderers: RecordingRenderer[]
  /** The profile each renderer was built around, oldest first. */
  profiles: KoiProfile[]
  /** The interval each inspector timer was started at, in milliseconds. */
  intervals: number[]
  /** The delay each timer still waiting to fire was scheduled at, in milliseconds. */
  delays(): number[]
  /** Every action the koi emitted. */
  sent: Array<{ type: string; data: unknown }>
  /**
   * Delivers one host action to the runtime's own wiring.
   *
   * @param event - The action type the host sent.
   * @param data - Its payload.
   */
  deliver(event: string, data?: unknown): void
  /**
   * Advances the clock and runs the frame waiting on it.
   *
   * @param ms - Milliseconds to advance before the frame runs.
   */
  step(ms: number): void
  /** Fires every timer still waiting. */
  runTimers(): void
  /** Every outline the koi reported. */
  outlines(): KoiOutline[]
  /** Whether a frame is still queued. */
  running(): boolean
}

/**
 * Builds a renderer that draws nothing and remembers everything.
 *
 * @returns The recording renderer.
 */
function recordingRenderer(): RecordingRenderer {
  const renderer: RecordingRenderer = {
    draws: [],
    selections: [],
    hovers: [],
    ponds: [],
    cards: [],
    placements: 0,
    disposals: 0,
    draw: (state, dt) => {
      renderer.draws.push({ state, dt })
    },
    setPond: (pond) => {
      renderer.ponds.push(pond)
    },
    setHovered: (hovered) => {
      renderer.hovers.push(hovered)
    },
    setSelected: (selected) => {
      renderer.selections.push(selected)
    },
    updateCard: (details) => {
      renderer.cards.push(details)
    },
    placeCard: () => {
      renderer.placements += 1
    },
    cardRects: () => null,
    dispose: () => {
      renderer.disposals += 1
    },
  }
  return renderer
}

/**
 * The renderer a mounted koi built at an index, or an empty recording when it built none.
 *
 * @param koi - The mounted koi.
 * @param index - Which of its renderers to read, oldest first.
 * @returns What that renderer was asked to do.
 */
function built(koi: MountedKoi, index: number): RecordingRenderer {
  return koi.renderers[index] ?? recordingRenderer()
}

/**
 * Mounts a koi whose frames, timers, renderers, and channel are all hand-driven.
 *
 * @param options - The framework it swims and whether anything embeds it.
 * @returns The mounted koi.
 */
function mount(options: { framework?: KoiFramework; hosted?: boolean } = {}): MountedKoi {
  const renderers: RecordingRenderer[] = []
  const profiles: KoiProfile[] = []
  const sent: Array<{ type: string; data: unknown }> = []
  const handlers = new Map<string, (data: unknown) => void>()
  const intervals: number[] = []
  const timers = new Map<number, { run: () => void; delay: number }>()
  let scheduled = 0
  let pending: FrameRequestCallback | null = null
  let clock = 1000

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending = callback
    return 1
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    pending = null
  })
  vi.spyOn(scheduler, 'setInterval').mockImplementation((_handler, delay) => {
    intervals.push(delay ?? 0)
    return intervals.length
  })
  vi.spyOn(scheduler, 'setTimeout').mockImplementation((handler, delay) => {
    scheduled += 1
    timers.set(scheduled, { run: handler, delay: delay ?? 0 })
    return scheduled
  })
  vi.spyOn(window, 'clearTimeout').mockImplementation((handle) => {
    timers.delete(<number>handle)
  })

  const link: FeatureLink = {
    on: (event, handler) => handlers.set(event, handler),
    send: (type, data) => sent.push({ type, data }),
  }

  const runtime = createKoiRuntime({
    framework: options.framework ?? 'vanilla',
    root: document.createElement('div'),
    link,
    hosted: options.hosted,
    rendererFactory: (_root, profile) => {
      profiles.push(profile)
      const renderer = recordingRenderer()
      renderers.push(renderer)
      return renderer
    },
  })

  return {
    runtime,
    renderers,
    profiles,
    intervals,
    sent,
    delays: () => [...timers.values()].map((timer) => timer.delay),
    deliver: (event, data) => handlers.get(event)?.(data),
    step: (ms) => {
      clock += ms
      const run = pending
      pending = null
      run?.(clock)
    },
    runTimers: () => {
      const due = [...timers.values()]
      timers.clear()
      for (const timer of due) {
        timer.run()
      }
    },
    outlines: () => sent.filter((message) => message.type === 'outline').map((message) => <KoiOutline>message.data),
    running: () => pending !== null,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createKoiRuntime', () => {
  it('starts the koi swimming as soon as it is built', () => {
    const koi = mount()
    koi.step(FRAME_MS)
    expect(built(koi, 0).draws).toHaveLength(1)
  })

  it('answers the pond without any wiring of its own', () => {
    const koi = mount()
    koi.deliver('hover', { hovered: true })
    expect(built(koi, 0).hovers).toEqual([true])
  })

  it('hands an announced world to the renderer that draws it', () => {
    const koi = mount()
    koi.deliver('pond', { width: 1600, height: 900 })
    expect(built(koi, 0).ponds).toEqual([{ width: 1600, height: 900 }])
  })

  it('carries the advancement it has committed to on every outline', () => {
    const koi = mount()
    koi.step(REPORT_MS)
    koi.step(REPORT_MS)
    koi.step(REPORT_MS)
    expect(koi.outlines().map((outline) => outline.path?.length)).toEqual([KOI_PATH_MAX_POINTS, KOI_PATH_MAX_POINTS, KOI_PATH_MAX_POINTS])
  })

  it('reports a koi holding its position as going nowhere', () => {
    const koi = mount()
    koi.step(REPORT_MS)
    koi.deliver('pause', { paused: true })
    koi.step(REPORT_MS)
    expect(koi.outlines().at(-1)).toEqual(expect.objectContaining({ speed: 0, intent: undefined }))
  })

  it('reports no advancement for a koi holding its position', () => {
    const koi = mount()
    koi.step(REPORT_MS)
    koi.deliver('pause', { paused: true })
    koi.step(REPORT_MS)
    expect(koi.outlines().map((outline) => outline.path !== undefined)).toEqual([true, false])
  })

  it('holds a resting koi where it was', () => {
    const koi = mount()
    koi.step(FRAME_MS)
    koi.deliver('pause', { paused: true, resting: true })
    const anchor = built(koi, 0).draws.at(-1)?.state.position
    koi.step(FRAME_MS)
    koi.step(FRAME_MS)
    expect(
      built(koi, 0)
        .draws.slice(-2)
        .map((frame) => frame.state.position)
    ).toEqual([anchor, anchor])
  })

  it('keeps a resting koi sculling', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true, resting: true })
    koi.step(FRAME_MS)
    koi.step(FRAME_MS)
    expect(
      built(koi, 0)
        .draws.slice(-2)
        .map((frame) => frame.state.speed / frame.state.length)
    ).toEqual([expect.closeTo(0.08), expect.closeTo(0.08)])
  })

  it('traces no silhouette around a resting koi', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true, resting: true })
    expect(built(koi, 0).selections).toEqual([false])
  })

  it('opens no identity card on a resting koi', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true, resting: true })
    koi.step(FRAME_MS)
    expect(built(koi, 0).cards).toEqual([])
  })

  it('starts no inspector timers for a resting koi', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true, resting: true })
    expect(koi.intervals).toEqual([])
  })

  it('places no card beside a resting koi', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true, resting: true })
    koi.step(FRAME_MS)
    expect(built(koi, 0).placements).toBe(0)
  })

  it('traces the silhouette around a koi a visitor holds', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true })
    expect(built(koi, 0).selections).toEqual([true])
  })

  it('opens the identity card of a koi a visitor holds', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true })
    expect(built(koi, 0).cards).toHaveLength(1)
  })

  it('starts the card and memory timers of a koi a visitor holds', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true })
    expect(koi.intervals).toEqual([500, 10_000])
  })

  it('closes the inspection when the hold ends', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true })
    koi.deliver('pause', { paused: false })
    expect(built(koi, 0).selections).toEqual([true, false])
  })

  it('gives the drawing surface back when the host stands the koi down', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    expect(koi.renderers.map((renderer) => renderer.disposals)).toEqual([1])
  })

  it('stops the loop when the host stands the koi down', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    expect(koi.running()).toBe(false)
  })

  it('builds a fresh surface when the koi is stood back up', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: false })
    koi.runTimers()
    expect(koi.renderers).toHaveLength(2)
  })

  it('swims again once its surface is back', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: false })
    koi.runTimers()
    koi.step(FRAME_MS)
    expect(built(koi, 1).draws).toHaveLength(1)
  })

  it('restores the hold a koi was under while it was stood down', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true })
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: false })
    koi.runTimers()
    expect(built(koi, 1).selections).toEqual([true])
  })

  it('waits its own ordinal out before it builds a surface', () => {
    const koi = mount()
    koi.deliver('identity', { framework: 'vanilla', seed: 1, instance: 2, url: 'https://koi.test/', depth: 3 })
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: false })
    expect(koi.delays()).toEqual([120])
  })

  it('builds nothing while its turn has not come', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: false })
    expect(koi.renderers).toHaveLength(1)
  })

  it('drops a pending wake when the koi is stood down again', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: false })
    koi.deliver('sleep', { paused: true })
    koi.runTimers()
    expect(koi.renderers).toHaveLength(1)
  })

  it('gives each surface back exactly once through a flurry', () => {
    const koi = mount()
    for (const asleep of [true, false, true, false, true]) {
      koi.deliver('sleep', { paused: asleep })
      koi.runTimers()
    }
    expect(koi.renderers.map((renderer) => renderer.disposals)).toEqual([1, 1, 1])
  })

  it('ignores a sleep the koi is already under', () => {
    const koi = mount()
    koi.deliver('sleep', { paused: true })
    koi.deliver('sleep', { paused: true })
    expect(koi.renderers.map((renderer) => renderer.disposals)).toEqual([1])
  })

  it('gives the surface back when the koi is torn down', () => {
    const koi = mount()
    koi.runtime.dispose()
    expect(koi.renderers.map((renderer) => renderer.disposals)).toEqual([1])
  })

  it('never swims again once it is torn down', () => {
    const koi = mount()
    koi.runtime.dispose()
    expect(koi.running()).toBe(false)
  })

  it('reads its embedding from what it was told rather than from the frame tree', () => {
    const koi = mount({ hosted: true })
    koi.deliver('pause', { paused: true })
    expect(built(koi, 0).cards).toEqual([expect.objectContaining({ hosted: true, origin: 'cross-origin' })])
  })

  it('reports nothing embedding a koi nothing was said to embed', () => {
    const koi = mount()
    koi.deliver('pause', { paused: true })
    expect(built(koi, 0).cards).toEqual([expect.objectContaining({ hosted: false, origin: null })])
  })

  it('never reads the window above it', () => {
    const above = vi.spyOn(window, 'parent', 'get')
    const koi = mount({ hosted: true })
    koi.step(REPORT_MS)
    koi.deliver('pause', { paused: true })
    expect(above).not.toHaveBeenCalled()
  })
})

describe('adopting a dealt identity', () => {
  /** The identity a host deals one of vanilla's koi. */
  const identity = (seed: number, instance: number) => ({ framework: 'vanilla', seed, instance, url: 'https://pond.test/', depth: 4 })

  it('keeps the canonical animal when the dealt seed is its own', () => {
    const koi = mount()
    koi.deliver('identity', identity(koiSeed('vanilla'), 0))
    expect(koi.renderers).toHaveLength(1)
  })

  it('rebuilds the animal around a variant seed', () => {
    const koi = mount()
    koi.deliver('identity', identity(koiVariantSeed('vanilla', 1), 1))
    expect(koi.renderers).toHaveLength(2)
  })

  it('hands the old body back before growing the new one', () => {
    const koi = mount()
    koi.deliver('identity', identity(koiVariantSeed('vanilla', 1), 1))
    expect(built(koi, 0).disposals).toBe(1)
  })

  it('deals a variant its own body', () => {
    const koi = mount()
    koi.deliver('identity', identity(koiVariantSeed('vanilla', 1), 1))
    // why: Only the phenotype channels read the variant seed — same species, same colours, a different animal.
    expect(koi.profiles[1]?.build).not.toEqual(koi.profiles[0]?.build)
  })

  it('stations a variant clear of the canonical entry', () => {
    const canonical = mount()
    canonical.step(FRAME_MS)
    const koi = mount()
    koi.deliver('identity', identity(koiVariantSeed('vanilla', 1), 1))
    koi.step(FRAME_MS)
    expect(built(koi, 1).draws[0]?.state.position).not.toEqual(built(canonical, 0).draws[0]?.state.position)
  })

  it('keeps hover through the rebirth', () => {
    const koi = mount()
    koi.deliver('hover', { hovered: true })
    koi.deliver('identity', identity(koiVariantSeed('vanilla', 1), 1))
    expect(built(koi, 1).hovers).toEqual([true])
  })
})

describe('a koi opened on its own', () => {
  /** Whether the page this koi swims on is dressed. */
  const dressed = (): boolean => document.querySelector('.koi-solo') !== null

  it('dresses its page when the app states nothing is hosting it', () => {
    const koi = mount({ hosted: false })
    expect(dressed()).toBe(true)
    koi.runtime.dispose()
  })

  it('leaves the page bare for an app that states it is hosted', () => {
    mount({ hosted: true })
    expect(dressed()).toBe(false)
  })

  it('leaves the page bare for an app that states nothing either way', () => {
    // why: Water painted inside a pond's frame blanks every koi below it, so silence is read as hosted; the cost of the opposite mistake is only the bare page this demo already had.
    mount()
    expect(dressed()).toBe(false)
  })

  it('swims the window it was opened in rather than the screen behind it', () => {
    const koi = mount({ hosted: false })
    koi.step(FRAME_MS)
    const drawn = built(koi, 0).draws.at(-1)?.state.position ?? { x: 0, y: 0 }
    // why: A world derived from the screen would send a koi off to swim in the part of it a windowed visitor is not looking at.
    expect(drawn.x).toBeLessThanOrEqual(window.innerWidth)
    expect(drawn.y).toBeLessThanOrEqual(window.innerHeight)
    koi.runtime.dispose()
  })

  it('takes the page back down the moment a pond announces a world', () => {
    const koi = mount({ hosted: false })
    koi.deliver('pond', describePondForFrame(640, 480, false))
    expect(dressed()).toBe(false)
  })

  it('takes the page back down when the koi is disposed', () => {
    const koi = mount({ hosted: false })
    koi.runtime.dispose()
    expect(dressed()).toBe(false)
  })
})

describe('entering an announced world', () => {
  /** The card world a small frame is given: far smaller than any screen snapshot. */
  const CARD_EDGE = 320

  /** How far a koi drifts in one frame at its very fastest, in pond pixels. */
  const FRAME_TRAVEL_PX = 30

  /** The world a koi builds for itself before anything answers it. */
  const guessed = (): PondEnvironment =>
    describePond(window.screen.width, window.screen.height, window.innerWidth, window.innerHeight, false)

  /**
   * How far a koi's last drawn nose sits from a point.
   *
   * @param koi - The mounted koi.
   * @param from - The pond-space point to measure against.
   * @returns The distance in pond pixels.
   */
  function drawnAwayFrom(koi: MountedKoi, from: Vec2): number {
    const position = built(koi, 0).draws.at(-1)?.state.position ?? { x: 0, y: 0 }
    return Math.hypot(position.x - from.x, position.y - from.y)
  }

  it('re-enters a koi told of a world it never stationed itself in', () => {
    const card = describePondForFrame(CARD_EDGE, CARD_EDGE, false)
    const koi = mount({ hosted: true })
    koi.step(FRAME_MS)
    koi.deliver('pond', card)
    koi.step(FRAME_MS)
    // how: The station is a pure function of the world and the seed, so the koi that entered this one is on the very spot this world would have opened it at.
    expect(drawnAwayFrom(koi, entryStation(card, koiSeed('vanilla')).position)).toBeLessThan(FRAME_TRAVEL_PX)
  })

  it('leaves a koi swimming where it is when the announced world is the one it has', () => {
    const koi = mount({ hosted: true })
    // why: Long enough to carry the koi well clear of its entry station, so a station it should never have been dealt again reads as the teleport it would be.
    for (let frame = 0; frame < 60; frame += 1) {
      koi.step(FRAME_MS)
    }
    const before = built(koi, 0).draws.at(-1)?.state.position ?? { x: 0, y: 0 }
    koi.deliver('pond', { ...guessed(), view: { x: 40, y: 40, width: 200, height: 200 } })
    koi.step(FRAME_MS)
    expect(drawnAwayFrom(koi, before)).toBeLessThan(FRAME_TRAVEL_PX)
  })

  it('hands the announced world to the renderer either way', () => {
    const koi = mount({ hosted: true })
    koi.deliver('pond', describePondForFrame(CARD_EDGE, CARD_EDGE, false))
    expect(built(koi, 0).ponds.at(-1)?.width).toBe(CARD_EDGE)
  })
})
