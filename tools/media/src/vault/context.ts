import type { MediaTheme } from '../models/theme'
import type { VaultConfig } from '../models/vault'
import type { VaultLayout, VaultMetrics } from './layout'
import type { VaultTimeline } from './timeline'

/** What every renderer is handed for one instant. */
export interface VaultContext {
  /** The scene as configured. */
  config: VaultConfig
  /** Where everything sits. */
  layout: VaultLayout
  /** The measurements this profile is drawn at. */
  metrics: VaultMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Every moment on the timeline. */
  timeline: VaultTimeline
  /** Offset from the start of the timeline. */
  atMs: number
}
