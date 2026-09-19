import type { Mark } from './banner'

/** One package, drawn as a chip: its mark, its name, and what need it answered. */
export interface EcosystemChip {
  /** The package's name without its scope, as its chip reads. */
  name: string
  /** The package's mark. */
  mark: Mark
  /** The need that produced it, set under the chip; absent for a package the story does not single out. */
  note?: string
}

/** A group of packages drawn together inside one outline. */
export interface EcosystemCluster {
  /** The small capitals at the outline's top left. */
  caption: string
  /** The chips, in reading order. */
  chips: readonly EcosystemChip[]
}

/** An arrow from one chip to another, named by the packages at either end. */
export interface EcosystemEdge {
  /** Name of the package the arrow leaves. */
  from: string
  /** Name of the package the arrow points at. */
  to: string
}

/** Everything a scene tells the ecosystem stage. */
export interface EcosystemConfig {
  /** The small capitals at the top left of the figure, or an empty string for none. */
  caption: string
  /** The line under the caption, or an empty string for none. */
  note: string
  /** When the count was taken, set small at the top right, or an empty string for none. */
  stamp: string
  /** The package at the centre, drawn larger than the rest. */
  hub: EcosystemChip
  /** The packages under the hub, in a column, top to bottom. */
  spine: readonly EcosystemChip[]
  /** The small capitals under the spine. */
  spineCaption: string
  /** The cluster to the left of the spine. */
  left: EcosystemCluster
  /** The cluster to the right of the spine. */
  right: EcosystemCluster
  /** The cluster along the foot of the figure, laid out in rows. */
  foot: EcosystemCluster
  /** The arrows that carry the story; the full dependency graph is deliberately not drawn. */
  edges: readonly EcosystemEdge[]
}
