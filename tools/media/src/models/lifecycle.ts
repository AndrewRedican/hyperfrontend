/** One page in the frame: a way of mounting the same widget. */
export interface LifecyclePanel {
  /** What this page does differently, set over it. */
  title: string
  /** Whether the page calls the teardown each mount handed back. */
  teardown: boolean
  /** One line under the page, saying why the counts look as they do. */
  note: string
}

/** Everything a scene tells the lifecycle stage. */
export interface LifecycleConfig {
  /** One line over the pages, naming what the frame is about. */
  heading?: string
  /** One line under them, arriving once the last cycle has run. */
  caption?: string
  /** The pages, left to right. */
  panels: readonly LifecyclePanel[]
  /** How many times the widget is mounted. */
  cycles: number
  /** How long one mount and unmount takes. */
  cycleMs: number
  /** When the first mount happens. */
  startMs?: number
  /** How many listeners one mount attaches, for the count under the page. */
  listenersPerMount: number
  /** How long the frame holds after the last unmount. */
  restMs?: number
}
