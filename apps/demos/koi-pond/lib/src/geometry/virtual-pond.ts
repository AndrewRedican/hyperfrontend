/**
 * The virtual pond: a stable coordinate space, and windows onto it.
 *
 * The pond is sized once, from a screen snapshot taken when the scene first
 * opens, and never changes for the life of the running instance. What changes
 * is the *view* — the window of pond space the presenting frame currently
 * shows. A gallery card, an expanded overlay, and a debug panel are different
 * windows onto the same pond; none of them redefines the water. Pond space
 * additionally runs past every pond edge by a margin measured in fish lengths,
 * so a koi that swims out of view keeps an honest position and comes back on
 * its own terms — nothing is ever clamped to a frame, and nothing bounces.
 *
 * The boundary is felt rather than hit. {@link boundaryPressure} reports how
 * hard the far edge is pushing on a koi *given where it is heading*: a fish
 * running parallel to an edge feels nothing, and a fish pointed at one feels the
 * pressure build long before it arrives. Steering on that pressure produces the
 * long, lazy curve a koi actually swims; steering on distance alone produces a
 * fish that bounces.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'
import type { PondEnvironment, PondWindow, Vec2 } from '../model/types.js'
import { DEPTH_LEVELS, KOI_FRAMEWORKS } from '../model/types.js'
import { koiSeed } from '../model/traits.js'

/** How far pond space runs past each pond edge, in nominal fish lengths. */
export const MARGIN_FISH_LENGTHS = 1.05

/** The nominal fish length as a fraction of the pond's shorter axis. */
const FISH_LENGTH_RATIO = 0.36

/** Smallest nominal fish length in CSS pixels, so a koi stays legible on a small screen. */
const MIN_FISH_LENGTH = 130

/** Largest nominal fish length in CSS pixels, so a koi does not fill a cinema display. */
const MAX_FISH_LENGTH = 560

/** Smallest virtual pond dimensions, should a screen report something degenerate. */
const MIN_POND = { width: 800, height: 600 }

/** Largest virtual pond dimensions, so a video wall does not become a marathon. */
const MAX_POND = { width: 3840, height: 2400 }

/** How far inside the boundary a koi starts feeling it, in nominal fish lengths. */
const AWARENESS_FISH_LENGTHS = 2.2

/**
 * Clamps a value into an inclusive band.
 *
 * @param value - The value to clamp.
 * @param min - Band floor.
 * @param max - Band ceiling.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Derives the nominal koi length for a pond.
 *
 * @param width - Virtual pond width in CSS pixels.
 * @param height - Virtual pond height in CSS pixels.
 * @returns The nominal nose-to-tail length in CSS pixels.
 */
export function nominalFishLength(width: number, height: number): number {
  const shorter = Math.min(Math.max(width, 0), Math.max(height, 0))
  return clamp(shorter * FISH_LENGTH_RATIO, MIN_FISH_LENGTH, MAX_FISH_LENGTH)
}

/**
 * The window a frame of the given size shows, centred on the pond.
 *
 * Centring is what makes every presentation continuous with every other: a
 * card, a debug panel, and a fullscreen tab all look into the middle of the
 * same water, and growing the frame reveals more pond around the same centre.
 *
 * @param pond - The environment whose pond is being windowed, or its dimensions.
 * @param frameWidth - The presenting frame's width in CSS pixels.
 * @param frameHeight - The presenting frame's height in CSS pixels.
 * @returns The window rectangle in pond space.
 *
 * @example Following a frame resize without touching the world
 * ```typescript
 * pond = { ...pond, view: pondWindow(pond, frame.clientWidth, frame.clientHeight) }
 * sessions.forEach((session) => session.shell.send('pond', pond))
 * ```
 */
export function pondWindow(pond: { width: number; height: number }, frameWidth: number, frameHeight: number): PondWindow {
  return {
    x: (pond.width - frameWidth) / 2,
    y: (pond.height - frameHeight) / 2,
    width: Math.max(frameWidth, 0),
    height: Math.max(frameHeight, 0),
  }
}

/**
 * Describes the pond for a screen snapshot and a presenting frame.
 *
 * The virtual pond derives from the *screen*, not the frame — the frame only
 * decides how much of that pond is visible. Call this once, when the scene
 * first opens; afterwards follow frame resizes with {@link pondWindow} alone
 * so the world the fish swim in never moves underneath them.
 *
 * @param screenWidth - Screen width in CSS pixels, as `window.screen` reports it.
 * @param screenHeight - Screen height in CSS pixels.
 * @param frameWidth - The presenting frame's width in CSS pixels.
 * @param frameHeight - The presenting frame's height in CSS pixels.
 * @param reducedMotion - Whether the visitor asked for reduced motion.
 * @returns The environment to announce to every fish.
 *
 * @example Announcing the world once at startup
 * ```typescript
 * const pond = describePond(screen.width, screen.height, root.clientWidth, root.clientHeight, motionQuery.matches)
 * ```
 */
export function describePond(
  screenWidth: number,
  screenHeight: number,
  frameWidth: number,
  frameHeight: number,
  reducedMotion: boolean
): PondEnvironment {
  const width = clamp(screenWidth, MIN_POND.width, MAX_POND.width)
  const height = clamp(screenHeight, MIN_POND.height, MAX_POND.height)
  const fishLength = nominalFishLength(width, height)
  return {
    width,
    height,
    margin: fishLength * MARGIN_FISH_LENGTHS,
    fishLength,
    view: pondWindow({ width, height }, frameWidth, frameHeight),
    depthLevels: DEPTH_LEVELS,
    reducedMotion,
  }
}

/**
 * The centre of the pond, which the shoal loosely orbits.
 *
 * @param pond - The announced environment.
 * @returns The pond-space centre point.
 */
export function pondCentre(pond: PondEnvironment): Vec2 {
  return { x: pond.width / 2, y: pond.height / 2 }
}

/** How far from the pond's centre a koi enters, as a fraction of the shorter pond axis. */
const ENTRY_RADIUS_RATIO = 0.32

/** How far a koi's entry angle wanders off its evenly spaced station, in radians. */
const ENTRY_ANGLE_JITTER = 0.42

/** The band a koi's entry radius is drawn from, as multipliers on the base radius. */
const ENTRY_RADIUS_BAND = { min: 0.55, max: 1.35 }

/** How far a koi's entry heading wanders off the tangent, in radians. */
const ENTRY_HEADING_JITTER = 0.85

/** Where the entry jitter's draw band starts on the koi's seed. */
const ENTRY_DRAWS = 40

/** The closest two koi may open, in nominal fish lengths. */
const ENTRY_SEPARATION_FISH_LENGTHS = 1.05

/** The furthest from the centre a koi may open, as a fraction of the shorter pond axis. */
const ENTRY_REACH_RATIO = 0.46

/** How many relaxation passes settle the opening shoal. */
const ENTRY_RELAX_PASSES = 24

/**
 * One koi's raw jittered entry, before the shoal is relaxed apart.
 *
 * @param pond - The announced environment.
 * @param seed - The koi's stable seed.
 * @returns Its unrelaxed entry position.
 */
function rawEntry(pond: PondEnvironment, seed: number): Vec2 {
  const draw = (index: number): number => randomPseudo(seed + ENTRY_DRAWS + index)
  // magic: The seeds are multiples of 977, and 977 mod 360 is coprime with 360 — so taking the residue fans the seven koi out on an almost perfectly even 51-degree spacing, which guarantees a base separation no random draw reliably would.
  const angle = (seed % 360) * (Math.PI / 180) + (draw(0) - 0.5) * 2 * ENTRY_ANGLE_JITTER
  const centre = pondCentre(pond)
  // why: Measured on the shorter axis so every koi enters inside the pond proper rather than out in the margin.
  const radius =
    Math.min(pond.width, pond.height) *
    ENTRY_RADIUS_RATIO *
    (ENTRY_RADIUS_BAND.min + draw(1) * (ENTRY_RADIUS_BAND.max - ENTRY_RADIUS_BAND.min))
  return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius }
}

/**
 * Where one koi enters the pond, and pointing which way.
 *
 * Entry is a property of the pond rather than of any fish's brain, which is why
 * it lives here: seven apps that each chose their own entry would either
 * collide on one spot or need to negotiate, and neither is the point of the
 * demo. The evenly spaced base stations plus the deterministic relaxation
 * guarantee a minimum opening separation; the seeded jitter around the
 * stations — angle, radius, and heading — breaks the circle they would
 * otherwise draw, so the first paint reads as a shoal that formed naturally
 * rather than seven placed markers.
 *
 * Every app computes the *whole* opening shoal and takes its own slot: the
 * relaxation needs all seven positions, and since every seed is shared
 * knowledge, computing them all is what keeps the apps agreeing without a
 * message.
 *
 * @param pond - The announced environment.
 * @param seed - The koi's stable seed, from `koiSeed`.
 * @returns Its entry nose position and heading.
 *
 * @example Placing a koi at boot
 * ```typescript
 * const entry = entryStation(pond, koiSeed('lit'))
 * const motion = createKoiMotion({ profile, pond, ...entry, depth: 3 })
 * ```
 */
export function entryStation(pond: PondEnvironment, seed: number): { position: Vec2; heading: number } {
  const seeds = KOI_FRAMEWORKS.map((framework) => koiSeed(framework))
  const slot = seeds.indexOf(seed)
  const positions = (slot === -1 ? [seed] : seeds).map((each) => rawEntry(pond, each))

  const centre = pondCentre(pond)
  const shorter = Math.min(pond.width, pond.height)
  const separation = pond.fishLength * ENTRY_SEPARATION_FISH_LENGTHS
  const reach = shorter * ENTRY_REACH_RATIO
  for (let pass = 0; pass < ENTRY_RELAX_PASSES; pass += 1) {
    // how: Overlapping pairs push each other apart by half their shortfall, then everyone is pulled back inside the opening reach; a couple of dozen passes settle seven points well past visual convergence.
    for (let a = 0; a < positions.length; a += 1) {
      for (let b = a + 1; b < positions.length; b += 1) {
        const first = positions[a]
        const second = positions[b]
        if (first === undefined || second === undefined) {
          continue
        }
        const dx = second.x - first.x
        const dy = second.y - first.y
        const distance = Math.hypot(dx, dy)
        if (distance >= separation || distance === 0) {
          continue
        }
        const push = (separation - distance) / (2 * distance)
        first.x -= dx * push
        first.y -= dy * push
        second.x += dx * push
        second.y += dy * push
      }
    }
    for (const position of positions) {
      const fromCentre = Math.hypot(position.x - centre.x, position.y - centre.y)
      if (fromCentre > reach) {
        const scale = reach / fromCentre
        position.x = centre.x + (position.x - centre.x) * scale
        position.y = centre.y + (position.y - centre.y) * scale
      }
    }
  }

  const position = positions[slot === -1 ? 0 : slot] ?? centre
  const settled = Math.atan2(position.y - centre.y, position.x - centre.x)
  // why: A tangential heading starts the shoal circulating instead of converging — seven fish all pointed at the centre meet there, and the opening seconds read as a collapse.
  const tangent = settled + Math.PI / 2 + (randomPseudo(seed + ENTRY_DRAWS + 2) - 0.5) * 2 * ENTRY_HEADING_JITTER
  return { position, heading: Math.atan2(Math.sin(tangent), Math.cos(tangent)) }
}

/** The rectangle pond space occupies, pond plus margins. */
export interface PondBounds {
  /** Leftmost pond-space x. */
  left: number
  /** Topmost pond-space y. */
  top: number
  /** Rightmost pond-space x. */
  right: number
  /** Bottommost pond-space y. */
  bottom: number
}

/**
 * The rectangle pond space occupies.
 *
 * @param pond - The announced environment.
 * @returns Its bounds in pond space.
 */
export function pondBounds(pond: PondEnvironment): PondBounds {
  return {
    left: -pond.margin,
    top: -pond.margin,
    right: pond.width + pond.margin,
    bottom: pond.height + pond.margin,
  }
}

/**
 * Whether a pond-space point currently falls inside the visible window.
 *
 * @param pond - The announced environment.
 * @param point - The point to test.
 * @param slack - Extra pixels of tolerance beyond each window edge.
 * @returns `true` when the point would paint on screen.
 *
 * @example Skipping render work for an off-screen koi
 * ```typescript
 * if (!isVisible(pond, nose, bodyLength)) {
 *   return
 * }
 * ```
 */
export function isVisible(pond: PondEnvironment, point: Vec2, slack = 0): boolean {
  const { view } = pond
  return (
    point.x >= view.x - slack &&
    point.y >= view.y - slack &&
    point.x <= view.x + view.width + slack &&
    point.y <= view.y + view.height + slack
  )
}

/**
 * Places a point at a fraction across the visible window.
 *
 * A gallery driving the pond speaks in fractions of what the visitor can see,
 * so the mapping goes through the view rather than the pond proper.
 *
 * @param pond - The announced environment.
 * @param fx - Fraction across the window's width, 0 to 1.
 * @param fy - Fraction down the window's height, 0 to 1.
 * @returns The pond-space point.
 */
export function pondPoint(pond: PondEnvironment, fx: number, fy: number): Vec2 {
  return {
    x: pond.view.x + pond.view.width * fx,
    y: pond.view.y + pond.view.height * fy,
  }
}

/** How much water a koi's frame box claims around its body, as a multiple of body length. */
const FRAME_BOX_RATIO = 1.7

/** A koi's square screen footprint: the sub-rect of pond space its canvas needs to cover. */
export interface KoiFrameBox {
  /** Pond-space x of the box's left edge. */
  x: number
  /** Pond-space y of the box's top edge. */
  y: number
  /** Box edge length in CSS pixels. */
  size: number
  /** Whether any of the box currently falls inside the visible window. */
  visible: boolean
}

/**
 * The square of pond space one koi's canvas must cover this frame.
 *
 * The box is centred on the body's midpoint — half a length behind the nose —
 * and sized generously enough that fins, tail sweep, banking, and the contact
 * shadow always land inside it whatever the pose. Rendering only this box
 * instead of the whole view is what keeps seven independent renderers cheap:
 * the box's area is a small constant, not a function of the frame.
 *
 * @param nose - The koi's nose in pond space.
 * @param heading - The koi's heading in radians.
 * @param length - The koi's current nose-to-tail length in CSS pixels.
 * @param view - The visible window.
 * @param out - The box to write into, reused to keep the render loop allocation-free.
 * @returns The box, `visible: false` when nothing of it would paint on screen.
 *
 * @example Skipping the render for an off-screen koi
 * ```typescript
 * const box = koiFrameBox(state.position, state.heading, state.length, pond.view, scratch)
 * if (!box.visible) {
 *   return
 * }
 * ```
 */
export function koiFrameBox(
  nose: Vec2,
  heading: number,
  length: number,
  view: PondWindow,
  out: KoiFrameBox = { x: 0, y: 0, size: 0, visible: false }
): KoiFrameBox {
  const size = length * FRAME_BOX_RATIO
  const centreX = nose.x - Math.cos(heading) * length * 0.5
  const centreY = nose.y - Math.sin(heading) * length * 0.5
  out.x = centreX - size / 2
  out.y = centreY - size / 2
  out.size = size
  out.visible = out.x < view.x + view.width && out.x + size > view.x && out.y < view.y + view.height && out.y + size > view.y
  return out
}

/** How hard the pond boundary is pushing on a koi, and which way it should turn. */
export interface BoundaryPressure {
  /** How urgently the boundary is felt, 0 (not at all) to 1 (about to leave). */
  urgency: number
  /** Unit vector pointing back toward open water, or `{ x: 0, y: 0 }` when nothing is felt. */
  inward: Vec2
}

/**
 * Reports how hard the pond's edge is pushing on a koi.
 *
 * Pressure is forward-aware: it counts only the edges the koi is actually
 * heading toward, and it grows with both proximity and how squarely the koi is
 * pointed at them. A fish running parallel to an edge feels nothing at all.
 *
 * @param pond - The announced environment.
 * @param position - The koi's nose in pond space.
 * @param heading - The koi's heading in radians.
 * @returns The felt pressure and the direction back to open water.
 *
 * @example Curving away from the boundary
 * ```typescript
 * const pressure = boundaryPressure(pond, nose, heading)
 * if (pressure.urgency > 0) {
 *   steer(pressure.inward, pressure.urgency * traits.directionalCaution)
 * }
 * ```
 */
export function boundaryPressure(pond: PondEnvironment, position: Vec2, heading: number): BoundaryPressure {
  const bounds = pondBounds(pond)
  const reach = pond.fishLength * AWARENESS_FISH_LENGTHS
  const forwardX = Math.cos(heading)
  const forwardY = Math.sin(heading)

  // how: Each edge contributes only when the koi is closing on it; the contributions add, so a corner pushes harder than a wall.
  let inwardX = 0
  let inwardY = 0
  let urgency = 0

  /**
   * Folds one edge's contribution into the running pressure.
   *
   * @param gap - Distance from the koi to that edge; negative once past it.
   * @param normalX - Inward unit normal, horizontal component.
   * @param normalY - Inward unit normal, vertical component.
   */
  const consider = (gap: number, normalX: number, normalY: number): void => {
    const closing = -(forwardX * normalX + forwardY * normalY)
    if (closing <= 0) {
      return
    }
    const nearness = clamp(1 - gap / reach, 0, 1)
    if (nearness <= 0) {
      return
    }
    // magic: Squaring the nearness keeps the far half of the reach almost free and makes the last stretch decisive.
    const weight = nearness * nearness * closing
    inwardX += normalX * weight
    inwardY += normalY * weight
    urgency = Math.max(urgency, weight)
  }

  consider(position.x - bounds.left, 1, 0)
  consider(bounds.right - position.x, -1, 0)
  consider(position.y - bounds.top, 0, 1)
  consider(bounds.bottom - position.y, 0, -1)

  const magnitude = Math.hypot(inwardX, inwardY)
  if (magnitude === 0) {
    return { urgency: 0, inward: { x: 0, y: 0 } }
  }
  return { urgency: clamp(urgency, 0, 1), inward: { x: inwardX / magnitude, y: inwardY / magnitude } }
}
