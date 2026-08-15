/**
 * The host's view of the shoal.
 *
 * Every koi reports its own outline and knows nothing about the others. This is
 * where those reports are collected and turned back into each fish's local
 * world — the host is the only thing in the pond that can see all seven, and
 * relaying a filtered view is how it coordinates them without ever telling one
 * fish what another should do.
 *
 * There is no broadcast in the SDK and none is wanted here: each koi gets a
 * different answer, because each koi has different neighbours.
 */
import type { KoiFramework, KoiOutline, NeighborObservation, PondEnvironment, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { boundsOverlap, chainBounds, signedDistanceToChain } from '@hyperfrontend/demo-koi-lib'

/** How far out a koi is told about its neighbours, in nominal fish lengths. */
export const RELAY_REACH = 3.4

/** How much slack a hover hit-test allows, in nominal fish lengths, so a deep koi stays easy to point at. */
export const HOVER_SLACK = 0.14

/** The longest a report is carried forward before it is trusted as-is, in seconds. */
export const DEAD_RECKON_MAX_S = 0.6

/** The longest a silent koi's last report keeps taking part in hover and relay work, in seconds. */
export const STALE_REPORT_S = 3

/** The host's live picture of the shoal. */
export interface Relay {
  /**
   * Records one koi's latest outline.
   *
   * @param outline - What the koi reported.
   * @param at - When it arrived, in milliseconds on the caller's clock.
   */
  record(outline: KoiOutline, at: number): void
  /**
   * Forgets a koi whose session has closed.
   *
   * @param framework - Which koi left.
   */
  forget(framework: KoiFramework): void
  /**
   * The neighbours one koi should be told about.
   *
   * @param framework - Whose view to build.
   * @param pond - The announced world, which sets the relay reach.
   * @param now - The moment to reckon every report forward to.
   * @returns The observations to relay, nearest first.
   */
  neighborsFor(framework: KoiFramework, pond: PondEnvironment, now: number): NeighborObservation[]
  /**
   * Which koi the host's pointer is over.
   *
   * @param point - The pointer in pond space.
   * @param pond - The announced world, which sets the hit-test slack.
   * @param now - The moment to reckon every report forward to.
   * @param slackScale - Widens the hit slack; a fingertip needs more than a cursor.
   * @returns The koi under the pointer, or `null` over open water.
   */
  pick(point: Vec2, pond: PondEnvironment, now: number, slackScale?: number): KoiFramework | null
  /** Every outline currently known, in report order. */
  readonly outlines: readonly KoiOutline[]
}

/**
 * Reads a koi's nose, or the origin when it reported an empty spine.
 *
 * @param outline - The reported outline.
 * @returns The nose position.
 */
function noseOf(outline: KoiOutline): Vec2 {
  return outline.spine[0] ?? { x: 0, y: 0 }
}

/**
 * Reads a koi's nose-to-tail length from its reported spine.
 *
 * @param outline - The reported outline.
 * @returns The length in CSS pixels.
 */
function lengthOf(outline: KoiOutline): number {
  const nose = outline.spine[0]
  const tail = outline.spine.at(-1)
  if (nose === undefined || tail === undefined) {
    return 0
  }
  return Math.hypot(tail.x - nose.x, tail.y - nose.y)
}

/**
 * Carries a report forward to the present along its own heading.
 *
 * A report is a snapshot of the past — under load, of a receding past. Sliding
 * it along the course the koi itself declared keeps hover and neighbour work
 * honest between reports, without ever inventing a turn the fish did not make.
 *
 * @param outline - The reported outline.
 * @param ageS - Seconds since it arrived, already capped.
 * @returns The outline as the koi has plausibly moved it.
 */
function reckoned(outline: KoiOutline, ageS: number): KoiOutline {
  if (ageS <= 0 || outline.speed <= 0) {
    return outline
  }
  const dx = Math.cos(outline.heading) * outline.speed * ageS
  const dy = Math.sin(outline.heading) * outline.speed * ageS
  return { ...outline, spine: outline.spine.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
}

/**
 * Creates the host's picture of the shoal.
 *
 * @returns The relay.
 *
 * @example Relaying each koi its own view
 * ```typescript
 * relay.record(outline, now)
 * session.shell.send('neighbors', relay.neighborsFor(session.framework, pond, now))
 * ```
 */
export function createRelay(): Relay {
  const reported = new Map<KoiFramework, { outline: KoiOutline; at: number }>()

  const current = (entry: { outline: KoiOutline; at: number }, now: number): KoiOutline => {
    const ageS = Math.min(Math.max(0, (now - entry.at) / 1000), DEAD_RECKON_MAX_S)
    return reckoned(entry.outline, ageS)
  }

  // why: A koi whose reports stopped is a ghost — hovering it or steering the shoal around its frozen outline would coordinate the living against the dead.
  const stale = (entry: { outline: KoiOutline; at: number }, now: number): boolean => now - entry.at > STALE_REPORT_S * 1000

  return {
    record(outline, at) {
      reported.set(outline.framework, { outline, at })
    },

    forget(framework) {
      reported.delete(framework)
    },

    neighborsFor(framework, pond, now) {
      const entry = reported.get(framework)
      if (entry === undefined || stale(entry, now)) {
        return []
      }
      const self = current(entry, now)
      const reach = pond.fishLength * RELAY_REACH
      const selfBounds = chainBounds(self.spine, self.girth)
      const selfNose = noseOf(self)

      const near: Array<{ distance: number; observation: NeighborObservation }> = []
      for (const [other, otherEntry] of reported) {
        if (other === framework || stale(otherEntry, now)) {
          continue
        }
        const outline = current(otherEntry, now)
        // how: A box-overlap rejection is the broad phase. At seven bodies a spatial index costs more to maintain than the twenty-one comparisons it would save.
        if (!boundsOverlap(selfBounds, chainBounds(outline.spine, outline.girth), reach)) {
          continue
        }
        const nose = noseOf(outline)
        near.push({
          distance: Math.hypot(nose.x - selfNose.x, nose.y - selfNose.y),
          observation: {
            framework: other,
            x: nose.x,
            y: nose.y,
            heading: outline.heading,
            speed: outline.speed,
            depth: outline.depth,
            length: lengthOf(outline),
            // why: The widest half-width travels with the observation so a neighbour's clearance can respect a heavier build.
            girth: outline.girth.reduce((widest, halfWidth) => Math.max(widest, halfWidth), 0),
          },
        })
      }
      // why: Nearest first, so a koi that only reads the head of the list still reads the encounter that matters most.
      near.sort((a, b) => a.distance - b.distance)
      return near.map((entry) => entry.observation)
    },

    pick(point, pond, now, slackScale = 1) {
      const slack = pond.fishLength * HOVER_SLACK * slackScale
      let picked: KoiFramework | null = null
      let bestDepth = -1
      let bestDistance = Number.POSITIVE_INFINITY
      for (const entry of reported.values()) {
        if (stale(entry, now)) {
          continue
        }
        const outline = current(entry, now)
        const distance = signedDistanceToChain(point, outline.spine, outline.girth)
        if (distance > slack) {
          continue
        }
        // why: The koi nearest the surface is the one a visitor believes they are pointing at, whatever the geometry says about the one below it.
        if (outline.depth > bestDepth || (outline.depth === bestDepth && distance < bestDistance)) {
          bestDepth = outline.depth
          bestDistance = distance
          picked = outline.framework
        }
      }
      return picked
    },

    get outlines() {
      return [...reported.values()].map((entry) => entry.outline)
    },
  }
}
