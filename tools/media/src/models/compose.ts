import type { Mark } from './banner'

/** One application that arrives from its own origin and seats into the host. */
export interface ComposeFeature {
  /** The origin in its address pill. */
  origin: string
  /** What it is built with, set as a tag inside its window. */
  framework: string
  /** When it starts sliding into its slot. */
  dockAtMs: number
}

/** Which way a message crosses a feature's wire. */
export type ComposeDirection = 'to-host' | 'to-feature'

/** One message crossing between the host and a seated feature. */
export interface ComposeMessage {
  /** Index of the feature whose wire it crosses. */
  feature: number
  /** Which way it goes. */
  direction: ComposeDirection
  /** When it leaves. */
  atMs: number
  /** The action name set beside the dot. */
  label: string
}

/** Everything a scene tells the compose stage. */
export interface ComposeConfig {
  /** The origin in the host's address pill. */
  hostOrigin: string
  /** The mark drawn in the host's hub, where every wire meets. */
  mark: Mark
  /** The applications, in slot order, top to bottom. */
  features: readonly ComposeFeature[]
  /** The messages that cross once the wires are live. */
  messages: readonly ComposeMessage[]
  /** How long a feature takes to slide into its slot; 1200 ms when omitted. */
  dockMs?: number
  /** How long the frame holds after the last message has landed; 1000 ms when omitted. */
  restMs?: number
}
