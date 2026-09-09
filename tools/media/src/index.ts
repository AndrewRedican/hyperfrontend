/**
 * Configuration-driven recorder turning real browser sessions into
 * size-budgeted GIFs and stills, knowing nothing of the project it records
 * beyond the config it is handed.
 *
 * @module @hyperfrontend/media
 */
export type { Determinism, ReadyGate, RecordWindow, ServeSpec, Viewport } from './models/capture'
export type { BrowserConfig, EncoderConfig, MediaConfigInput, MediaDefaults, ResolvedMediaConfig, ResolvedRoots } from './models/config'
export type { EncoderName, EncoderPreference, GifOptions, StillFormat, StillOptions } from './models/encode'
export type { AssetSidecar, CheckOutcome, RunSummaryRow } from './models/report'
export type { BrowserScene, BrowserSceneInput, Choreography, LoadedScene, SceneOutput, StillSpec } from './models/scene'
export { defineConfig } from './config/define-config'
export { loadConfig } from './config/load-config'
export { defineBrowserScene } from './scene/define-scene'
export { discoverScenes } from './scene/discover'
