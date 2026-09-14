/** How far a runtime is supported. */
export type MatrixSupport = 'full' | 'partial' | 'none'

/** One runtime and how the package stands with it. */
export interface MatrixCell {
  /** The runtime's name. */
  label: string
  /** One short line under the name: a version floor, or what partial means. */
  detail: string
  /** How far the runtime is supported. */
  support: MatrixSupport
}

/** Everything a scene tells the matrix stage. */
export interface MatrixConfig {
  /** One line over the cells, or undefined for none. */
  heading?: string
  /** The runtimes, left to right. */
  cells: readonly MatrixCell[]
}
