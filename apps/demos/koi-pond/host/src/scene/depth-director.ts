/**
 * Who swims over whom.
 *
 * The host owns the koi containers, so it owns their z-order, so it owns the
 * depth model outright. A fish may *ask* to change level — usually to get out of
 * a crossing — but the host is what decides, and it refuses more often than it
 * agrees: a level change is held behind a cooldown and takes over a second to
 * roll through, which is what stops the shoal flickering between orderings
 * every time two koi come near each other.
 */
import type { DepthState, KoiFramework } from '@hyperfrontend/demo-koi-lib'
import {
  KOI_FRAMEWORKS,
  advanceDepth,
  beginDepthChange,
  grantsDepth,
  renderedDepth,
  spreadDepths,
  startDepth,
} from '@hyperfrontend/demo-koi-lib'

/** The host's record of where every koi sits in the water column. */
export interface DepthDirector {
  /**
   * Considers a koi's request to change level.
   *
   * @param framework - Which koi asked.
   * @param level - The level it asked for.
   * @param now - Host clock reading.
   * @returns `true` when the change was granted and should be sent on.
   */
  request(framework: KoiFramework, level: number, now: number): boolean
  /**
   * Advances every koi's transition, reporting the ones that just settled.
   *
   * @param now - Host clock reading.
   * @returns The koi whose transitions completed on this tick.
   */
  advance(now: number): KoiFramework[]
  /**
   * The level a koi renders at right now, fractional while it rolls.
   *
   * @param framework - Which koi.
   * @param now - Host clock reading.
   * @returns The rendered level.
   */
  levelOf(framework: KoiFramework, now: number): number
  /**
   * The level a koi holds, ignoring any transition in flight.
   *
   * @param framework - Which koi.
   * @returns The settled level.
   */
  settledLevel(framework: KoiFramework): number
}

/**
 * Creates the depth director with the shoal spread across the water column.
 *
 * @param now - Host clock reading at open.
 * @returns The director.
 *
 * @example Granting a depth request
 * ```typescript
 * if (director.request(framework, level, Date.now())) {
 *   session.shell.send('depth', { level: director.settledLevel(framework) })
 * }
 * ```
 */
export function createDepthDirector(now: number): DepthDirector {
  const levels = spreadDepths(KOI_FRAMEWORKS.length)
  const states = new Map<KoiFramework, DepthState>()
  KOI_FRAMEWORKS.forEach((framework, index) => {
    states.set(framework, startDepth(levels[index] ?? 0, now))
  })

  return {
    request(framework, level, at) {
      const state = states.get(framework)
      if (state === undefined || !grantsDepth(state, level, at)) {
        return false
      }
      states.set(framework, beginDepthChange(state, level, at))
      return true
    },

    advance(at) {
      const settled: KoiFramework[] = []
      for (const [framework, state] of states) {
        const next = advanceDepth(state, at)
        if (next !== state) {
          states.set(framework, next)
          settled.push(framework)
        }
      }
      return settled
    },

    levelOf(framework, at) {
      const state = states.get(framework)
      return state === undefined ? 0 : renderedDepth(state, at)
    },

    settledLevel(framework) {
      const state = states.get(framework)
      // why: A koi mid-roll is told the level it is heading for, so its own render agrees with the layer the host has already restacked it onto.
      return state === undefined ? 0 : (state.target ?? state.level)
    },
  }
}
