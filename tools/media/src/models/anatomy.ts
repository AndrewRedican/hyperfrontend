import type { Mark } from './banner'

/** One layer of the channel, drawn as a ring of the cross-section and named beside it. */
export interface AnatomyLayer {
  /** The package's name without its scope. */
  name: string
  /** The package's mark. */
  mark: Mark
  /** What the layer does, in a few words. */
  note: string
}

/** Everything a scene tells the anatomy stage. */
export interface AnatomyConfig {
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
  /** The layers the channel is made of, outermost first. */
  layers: readonly AnatomyLayer[]
  /** The four ideas, in badge order: loading, boundary, contract, deployment. */
  annotations: readonly [string, string, string, string]
}
