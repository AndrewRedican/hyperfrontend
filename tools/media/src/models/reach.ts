import type { Mark } from './banner'

/** One project of the workspace, drawn as a tile with the task beside it. */
export interface ReachNode {
  /** Name the edges refer to it by. */
  id: string
  /** The project's name, set inside the tile. */
  label: string
  /** Horizontal centre, in CSS pixels of the frame. */
  x: number
  /** Vertical centre, in CSS pixels of the frame. */
  y: number
}

/** One import between two projects, along which a change travels from the imported to the importer. */
export interface ReachEdge {
  /** The project that is imported, where a change sets off. */
  from: string
  /** The project that imports it, where the change arrives. */
  to: string
  /**
   * Whether the import brings in types alone.
   *
   * A type-only import is stripped before a test runs, so the change sets off
   * along the edge and fades before it arrives: the edge is drawn dashed and
   * the task at its end stays dark.
   */
  typeOnly?: boolean
  /**
   * Whether the import is made from a spec file alone.
   *
   * A test task runs the specs, so the change arrives along it like any value
   * import; the edge is drawn dotted so a reader can tell the two apart.
   */
  fromSpec?: boolean
}

/** One line of caption, shown from its moment until the next caption's. */
export interface ReachCaption {
  /** When it appears. */
  atMs: number
  /** What it says, one short line. */
  text: string
}

/** One leg of the ripple: the change travelling along an edge. */
export interface ReachStep {
  /** Index of the edge the change travels. */
  edge: number
  /** When it sets off. */
  atMs: number
}

/** The package API the ripple stands for. */
export interface ReachApi {
  /** The function name, as a reader would import it. */
  name: string
  /** The package's mark, drawn beside the name. */
  mark: Mark
}

/** Everything a scene tells the reach stage. */
export interface ReachConfig {
  /** The call whose decision the ripple shows. */
  api: ReachApi
  /** The command line that asks for it, set plainly beside the call. */
  command: string
  /** The captions, in order. */
  captions: readonly ReachCaption[]
  /** The name of the task each tile carries. */
  task: string
  /** The projects. */
  nodes: readonly ReachNode[]
  /** The imports between them. */
  edges: readonly ReachEdge[]
  /** The project a file changes in. */
  changed: string
  /** When the file changes. */
  changeAtMs: number
  /** The legs of the ripple, in order. */
  steps: readonly ReachStep[]
  /** How long the change takes to travel one edge. */
  travelMs: number
  /** How long the frame holds after the last task lights. */
  restMs?: number
}
