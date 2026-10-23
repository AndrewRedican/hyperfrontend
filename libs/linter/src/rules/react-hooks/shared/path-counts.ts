/**
 * Path counting over a code path's segments, for checking that a hook runs exactly once per
 * render: how many paths reach a segment from the start, how many lead from it to the end, the
 * shortest distance back to the start, and which segments sit inside a cycle. Exception edges
 * do not count, and a segment ending in an uncaught throw ends no path. Where control falls off
 * the end from several segments, or from one that also loops back, the count goes through one
 * end segment those join, as the previous linter's code paths had it.
 *
 * @module rules/react-hooks/shared/path-counts
 */

import type { CodePath, Segment } from '../../../flow/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * The reachable segments among some.
 *
 * @param segments - The predecessors or successors of a segment
 * @returns Those control can reach
 */
function reachable(segments: readonly Segment[]): Segment[] {
  return segments.filter((segment) => segment.reachable)
}

/**
 * Counts the paths of one code path, remembering what it has counted.
 *
 * @example Spot a hook that runs on only some paths
 * ```ts
 * // function Profile({ user }) {
 * //   if (!user) return null
 * //   const name = useName(user)
 * //   return name
 * // }
 * const counter = new PathCounter(profilePath)
 * const hook = flow.segmentOf(useNameCall)
 * counter.toEnd(profilePath.initial) // => 2n (two paths through Profile)
 * counter.fromStart(hook) * counter.toEnd(hook) // => 1n (only one runs the hook)
 * ```
 *
 * @example Mark a hook called in a loop
 * ```ts
 * // function List({ items }) { for (const item of items) useRow(item) }
 * const counter = new PathCounter(listPath)
 * counter.toEnd(listPath.initial) // counting fills counter.cyclic
 * counter.cyclic.has(flow.segmentOf(useRowCall).id) // => true
 * ```
 */
export class PathCounter {
  /** The segments found inside a cycle so far, filled in as counting walks into them. */
  readonly cyclic = createSet<number>()

  /** The code path counted. */
  private readonly path: CodePath

  /** The counts of paths from the start, by segment number. */
  private readonly fromStartCache = createMap<number, bigint>()

  /** The counts of paths to the end, by segment number. */
  private readonly toEndCache = createMap<number, bigint>()

  /** The shortest distances to the start, by segment number; null while one is being computed. */
  private readonly distanceCache = createMap<number, number | null>()

  /** The segments control falls off the end from, when they join an end segment of their own. */
  private readonly joining: readonly Segment[]

  /**
   * Prepares to count a code path.
   *
   * @param path - The code path whose segments are counted
   */
  constructor(path: CodePath) {
    this.path = path
    const fallOff = path.final.filter((segment) => segment.reachable && !endsInReturn(segment))
    this.joining = fallOff.length > 1 || fallOff.some((segment) => reachable(segment.nexts).length > 0) ? fallOff : []
  }

  /**
   * Whether control leaves the path at a segment with no other segment after it: the segment
   * is final itself rather than joining the end segment.
   *
   * @param segment - The segment checked
   * @returns Whether no reachable segment follows it
   */
  endsAt(segment: Segment): boolean {
    return reachable(segment.nexts).length === 0 && !this.joining.includes(segment)
  }

  /**
   * The shortest distance from any reachable final segment, or the end segment the falling
   * segments join, back to the start.
   *
   * @returns The distance, infinite when no final segment is reachable
   */
  shortestFinalDistance(): number {
    let shortest = Infinity
    for (const final of this.path.final) {
      if (final.reachable && !this.joining.includes(final)) shortest = min(shortest, this.distanceToStart(final))
    }
    let joined = Infinity
    for (const segment of this.joining) joined = min(joined, this.distanceToStart(segment))
    return min(shortest, joined + 1)
  }

  /**
   * Records the segments of a cycle closed on a segment: from the one visited just before it to
   * the last, or the last alone when the cycle closes on the first segment visited.
   *
   * @param history - The segment numbers visited, in order
   * @param id - The segment number met again
   */
  private closeCycle(history: ReadonlySet<number>, id: number): void {
    const visited = [...history]
    for (const member of visited.slice(visited.indexOf(id) - 1)) this.cyclic.add(member)
  }

  /**
   * The number of paths from the start of the code path to a segment; a segment met again on
   * the way back counts none, and records no cycle.
   *
   * @param segment - The segment counted to
   * @param history - The segment numbers visited on the way, in order
   * @returns The number of paths
   */
  fromStart(segment: Segment, history: ReadonlySet<number> = createSet<number>()): bigint {
    if (history.has(segment.id)) return 0n
    const visited = createSet<number>(history).add(segment.id)
    const cached = this.fromStartCache.get(segment.id)
    if (cached !== undefined) return cached
    const prevs = reachable(segment.prevs)
    let paths = 0n
    if (this.path.thrown.includes(segment)) paths = 0n
    else if (prevs.length === 0) paths = 1n
    else for (const prev of prevs) paths += this.fromStart(prev, visited)
    // why: a reachable segment counted as reached by no path was met inside a cycle still open; it is counted again when asked again.
    if (segment.reachable && paths === 0n) this.fromStartCache.delete(segment.id)
    else this.fromStartCache.set(segment.id, paths)
    return paths
  }

  /**
   * The number of paths from a segment to the end of the code path; a segment met again on the
   * way closes a cycle and counts none.
   *
   * @param segment - The segment counted from
   * @param history - The segment numbers visited on the way, in order
   * @returns The number of paths
   */
  toEnd(segment: Segment, history: ReadonlySet<number> = createSet<number>()): bigint {
    if (history.has(segment.id)) {
      this.closeCycle(history, segment.id)
      return 0n
    }
    const visited = createSet<number>(history).add(segment.id)
    const cached = this.toEndCache.get(segment.id)
    if (cached !== undefined) return cached
    let paths = 0n
    if (this.path.thrown.includes(segment)) paths = 0n
    else if (this.endsAt(segment)) paths = 1n
    else {
      for (const next of reachable(segment.nexts)) paths += this.toEnd(next, visited)
      if (this.joining.includes(segment)) paths += 1n
    }
    this.toEndCache.set(segment.id, paths)
    return paths
  }

  /**
   * The number of segments on the shortest way back from a segment to the start, itself
   * included; infinite for a segment met again while its own distance is being computed.
   *
   * @param segment - The segment measured from
   * @returns The number of segments, infinite for one inside an open cycle
   */
  distanceToStart(segment: Segment): number {
    const cached = this.distanceCache.get(segment.id)
    if (cached === null) return Infinity
    if (cached !== undefined) return cached
    this.distanceCache.set(segment.id, null)
    const prevs = reachable(segment.prevs)
    let distance = 1
    if (prevs.length > 0) {
      distance = Infinity
      for (const prev of prevs) distance = min(distance, this.distanceToStart(prev))
      distance += 1
    }
    this.distanceCache.set(segment.id, distance)
    return distance
  }
}

/**
 * Whether a final segment ends in a return: it holds the return statement, or it is the empty
 * segment a return's branching argument joins into.
 *
 * @param segment - The final segment checked
 * @returns Whether control leaves it through a return rather than falling off the end
 */
function endsInReturn(segment: Segment): boolean {
  return segment.nodes.length === 0 || segment.nodes.some((node) => node.kind === 'ReturnStatement')
}
