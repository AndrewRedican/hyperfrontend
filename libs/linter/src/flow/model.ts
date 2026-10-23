/**
 * The control-flow model: a program, each function, static block and field initialiser is a
 * code path made of segments, straight runs of evaluation joined by the edges control may take,
 * as the previous linter's code path analysis shaped them.
 *
 * @module flow/model
 */

import type { Node } from '../code/model'

/**
 * A straight run of evaluation, entered from its predecessors and left to its successors.
 *
 * @example Link segments and see reachability follow
 * ```ts
 * const start = new Segment(0, [], true)
 * const next = new Segment(1, [start])
 * const orphan = new Segment(2, [])
 * start.nexts[0] === next // => true
 * next.reachable // => true
 * orphan.reachable // => false
 * ```
 */
export class Segment {
  /** The segment's number within its analysis, in creation order. */
  readonly id: number
  /** The segments control comes from. */
  readonly prevs: Segment[] = []
  /** The segments control goes to. */
  readonly nexts: Segment[] = []
  /** The segments inside a try block from which an exception may reach this catch or finally segment. */
  readonly thrownFrom: Segment[] = []
  /** The catch or finally segments an exception thrown in this segment may reach. */
  readonly thrownTo: Segment[] = []
  /** Whether control can reach the segment from its path's start. */
  readonly reachable: boolean
  /** The nodes evaluated in the segment, in evaluation order. */
  readonly nodes: Node[] = []

  /**
   * Opens a segment after its predecessors.
   *
   * @param id - The segment's number
   * @param prevs - The segments control comes from
   * @param initial - Whether the segment starts a path, which makes it reachable without predecessors
   */
  constructor(id: number, prevs: readonly Segment[], initial = false) {
    this.id = id
    this.reachable = initial || prevs.some((prev) => prev.reachable)
    for (const prev of prevs) this.link(prev)
  }

  /**
   * Adds an edge from a predecessor, once.
   *
   * @param prev - The segment control comes from
   */
  link(prev: Segment): void {
    if (this.prevs.includes(prev)) return
    this.prevs.push(prev)
    prev.nexts.push(this)
  }

  /**
   * Adds an exception edge from a segment of a try block.
   *
   * @param source - The segment an exception may leave
   */
  linkThrown(source: Segment): void {
    this.thrownFrom.push(source)
    source.thrownTo.push(this)
  }
}

/** The segments of one program, function, static block or field initialiser. */
export interface CodePath {
  /** The node whose evaluation the path describes. */
  readonly root: Node
  /** The path holding the root, or null for the program's. */
  readonly upper: CodePath | null
  /** The segment evaluation starts in. */
  readonly initial: Segment
  /** Every segment, in creation order. */
  readonly segments: Segment[]
  /** The segments evaluation ends in: those ending in a return and the one falling off the end. */
  readonly final: Segment[]
  /** The segments ending in a throw no catch of the path handles. */
  readonly thrown: Segment[]
}

/** The control flow of one program. */
export interface FlowAnalysis {
  /** Every code path, the program's first. */
  readonly paths: readonly CodePath[]
  /** The segment a node is evaluated in, or undefined for a node that is never evaluated as such. */
  readonly segmentOf: (node: Node) => Segment | undefined
  /** The path a segment belongs to. */
  readonly pathOf: (segment: Segment) => CodePath
  /** The segments control is in at the end of a switch case's statements. */
  readonly caseEnd: (switchCase: Node) => readonly Segment[]
}
