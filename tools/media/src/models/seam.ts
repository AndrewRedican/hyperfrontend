import type { Mark } from './banner'

/** One of the four ideas the figure annotates, numbered where it applies and named in the legend. */
export interface SeamAnnotation {
  /** What the badge stands for, as the legend reads it. */
  label: string
}

/** Everything a scene tells the seam stage. */
export interface SeamConfig {
  /** The small capitals over the host window. */
  hostCaption: string
  /** The origin in the host's address bar. */
  hostOrigin: string
  /** The label on the shell's tab. */
  shellLabel: string
  /** The mark on the shell's tab. */
  shellMark: Mark
  /** The small capitals on the boundary. */
  boundaryCaption: string
  /** The small capitals inside the hostee window. */
  hosteeCaption: string
  /** The origin in the hostee's address bar. */
  hosteeOrigin: string
  /** The line under the channel. */
  channelLabel: string
  /** The four ideas, in badge order: loading, boundary, contract, deployment. */
  annotations: readonly [SeamAnnotation, SeamAnnotation, SeamAnnotation, SeamAnnotation]
}
