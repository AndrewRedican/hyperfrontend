/**
 * Who swims over whom.
 *
 * The host owns the koi containers, so it owns their z-order, so it owns the
 * depth model outright. A fish may *ask* to change level — usually to get out of
 * a crossing — but the host is what decides, and it refuses more often than it
 * agrees: a level change is held behind a cooldown and takes over a second to
 * roll through, which is what stops the shoal flickering between orderings
 * every time two koi come near each other.
 *
 * The spread itself follows the living roster. However many koi swim right
 * now is how many levels are dealt: a lone koi holds the surface at full
 * scale and full light rather than a canonical slot in the deep, and a shoal
 * past seven doubles levels up exactly as an even spread demands. Joining and
 * leaving re-deal the spread, and every koi whose slot moved glides there.
 */
import type { DepthState } from '@hyperfrontend/demo-koi-lib'
import type { KoiInstanceId } from './instance-id'
import { advanceDepth, beginDepthChange, grantsDepth, renderedDepth, spreadDepths, startDepth } from '@hyperfrontend/demo-koi-lib'

/** The host's record of where every koi sits in the water column. */
export interface DepthDirector {
  /**
   * Deals a joining koi into the spread, re-spreading everyone else.
   *
   * @param id - The instance that joined.
   * @param now - Host clock reading.
   * @returns The other instances whose level moved with the re-deal.
   */
  add(id: KoiInstanceId, now: number): KoiInstanceId[]
  /**
   * Drops a leaving koi and re-spreads the remainder.
   *
   * @param id - The instance that left.
   * @param now - Host clock reading.
   * @returns The instances whose level moved with the re-deal.
   */
  remove(id: KoiInstanceId, now: number): KoiInstanceId[]
  /**
   * Considers a koi's request to change level.
   *
   * @param id - Which koi asked.
   * @param level - The level it asked for.
   * @param now - Host clock reading.
   * @returns `true` when the change was granted and should be sent on.
   */
  request(id: KoiInstanceId, level: number, now: number): boolean
  /**
   * Advances every koi's transition, reporting the ones that just settled.
   *
   * @param now - Host clock reading.
   * @returns The koi whose transitions completed on this tick.
   */
  advance(now: number): KoiInstanceId[]
  /**
   * The level a koi renders at right now, fractional while it rolls.
   *
   * @param id - Which koi.
   * @param now - Host clock reading.
   * @returns The rendered level.
   */
  levelOf(id: KoiInstanceId, now: number): number
  /**
   * The level a koi holds, ignoring any transition in flight.
   *
   * @param id - Which koi.
   * @returns The settled level.
   */
  settledLevel(id: KoiInstanceId): number
}

/**
 * Creates the depth director with an empty water column; koi are dealt in as
 * their sessions are raised.
 *
 * @returns The director.
 *
 * @example Granting a depth request
 * ```typescript
 * if (director.request(session.id, level, Date.now())) {
 *   session.shell.send('depth', { level: director.settledLevel(session.id) })
 * }
 * ```
 */
export function createDepthDirector(): DepthDirector {
  const states = new Map<KoiInstanceId, DepthState>()

  /**
   * Re-deals the even spread over the living roster, gliding every koi whose
   * slot moved.
   *
   * @param joined - An instance to seat settled at its slot, straight in.
   * @param now - Host clock reading.
   * @returns The already-swimming instances whose level moved.
   */
  const respread = (joined: KoiInstanceId | null, now: number): KoiInstanceId[] => {
    const levels = spreadDepths(states.size)
    const moved: KoiInstanceId[] = []
    let index = 0
    for (const [id, state] of states) {
      const slot = levels[index] ?? 0
      index += 1
      if (id === joined) {
        states.set(id, startDepth(slot, now))
        continue
      }
      if ((state.target ?? state.level) === slot) {
        continue
      }
      // why: A koi mid-roll re-bases on the level it is actually rendering at, so the glide to its new slot starts where the eye left it instead of snapping back.
      states.set(id, beginDepthChange({ level: Math.round(renderedDepth(state, now)), target: null, since: state.since }, slot, now))
      moved.push(id)
    }
    return moved
  }

  return {
    add(id, now) {
      states.set(id, startDepth(0, now))
      return respread(id, now)
    },

    remove(id, now) {
      if (!states.delete(id)) {
        return []
      }
      return respread(null, now)
    },

    request(id, level, at) {
      const state = states.get(id)
      if (state === undefined || !grantsDepth(state, level, at)) {
        return false
      }
      states.set(id, beginDepthChange(state, level, at))
      return true
    },

    advance(at) {
      const settled: KoiInstanceId[] = []
      for (const [id, state] of states) {
        const next = advanceDepth(state, at)
        if (next !== state) {
          states.set(id, next)
          settled.push(id)
        }
      }
      return settled
    },

    levelOf(id, at) {
      const state = states.get(id)
      return state === undefined ? 0 : renderedDepth(state, at)
    },

    settledLevel(id) {
      const state = states.get(id)
      // why: A koi mid-roll is told the level it is heading for, so its own render agrees with the layer the host has already restacked it onto.
      return state === undefined ? 0 : (state.target ?? state.level)
    },
  }
}
