import type { Mark } from './banner'

/** One object in the graph. */
export interface GraphNode {
  /** Name the edges refer to it by. */
  id: string
  /** Text inside the node. */
  label: string
  /** Horizontal centre, in CSS pixels of the frame. */
  x: number
  /** Vertical centre, in CSS pixels of the frame. */
  y: number
}

/** One reference from an object to another. */
export interface GraphEdge {
  /** Node the reference is held on. */
  from: string
  /** Node it points at. */
  to: string
  /** The property that holds it, set beside the edge. */
  label: string
  /**
   * How far the edge bows away from the straight line, in pixels.
   *
   * Negative bows upward, positive downward, zero is a straight edge. A back
   * reference is drawn as an arc so it cannot be mistaken for the forward edge
   * it doubles back over.
   */
  bow?: number
}

/** One move of the traversal. */
export interface GraphStep {
  /** Index of the edge the cursor follows. */
  edge: number
  /** When the cursor sets off along it. */
  atMs: number
  /**
   * Whether the edge lands on a node the traversal has already visited.
   *
   * A step that does is a cycle: the edge lights, the count ticks up, and the
   * cursor comes back along the edge to carry on from where it was.
   */
  cycle?: boolean
}

/** The package API the walk stands for. */
export interface GraphApi {
  /** The function name, as a reader would import it. */
  name: string
  /** The package's mark, drawn beside the name. */
  mark: Mark
}

/** Everything a scene tells the graph stage. */
export interface GraphConfig {
  /** The call whose behaviour the walk shows. */
  api: GraphApi
  /** The objects. */
  nodes: readonly GraphNode[]
  /** The references between them. */
  edges: readonly GraphEdge[]
  /** Node the traversal starts from. */
  start: string
  /** The traversal, in order. */
  steps: readonly GraphStep[]
  /** How long the cursor takes to travel one edge. */
  travelMs: number
  /** How long the frame holds after the walk ends. */
  restMs?: number
}
