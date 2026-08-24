/**
 * Configuration-driven recorder that turns real browser sessions into
 * size-budgeted GIFs and stills.
 *
 * Everything workspace-specific arrives through `defineConfig` and the scene
 * files it points at, so this module never learns a path, a port or a command
 * belonging to the project it is recording.
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
