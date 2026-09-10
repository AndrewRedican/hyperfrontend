/**
 * Configuration-driven recorder turning browser sessions and scripted stages
 * into size-budgeted GIFs and stills, knowing nothing of the project it records
 * beyond the config it is handed.
 *
 * @module @hyperfrontend/media
 */
export type { Determinism, ReadyGate, RecordWindow, ServeSpec, Viewport } from './models/capture'
export type { BrowserConfig, EncoderConfig, MediaConfigInput, MediaDefaults, ResolvedMediaConfig, ResolvedRoots } from './models/config'
export type { EncoderName, EncoderPreference, GifOptions, StillFormat, StillOptions } from './models/encode'
export type { FlowConfig, FlowEndpoint, FlowMessage, FlowSide, FlowTheme, FlowThemeRef, FlowTone } from './models/flow'
export type { MediaProfile, ProfileId, ProfileRef } from './models/profile'
export type { AssetSidecar, CheckOutcome, RunSummaryRow } from './models/report'
export type {
  BrowserScene,
  BrowserSceneInput,
  Choreography,
  LoadedScene,
  MediaScene,
  SceneCommon,
  SceneOutput,
  ScriptedScene,
  ScriptedSceneInput,
  StillSpec,
} from './models/scene'
export type { Stage, StagedContent, StageInstant } from './models/stage'
export type {
  TerminalConfig,
  TerminalLine,
  TerminalSpan,
  TerminalStep,
  TerminalTheme,
  TerminalThemeRef,
  TerminalTone,
} from './models/terminal'
export { defineConfig } from './config/define-config'
export { loadConfig } from './config/load-config'
export { flowStage } from './flow/stage'
export { defineBrowserScene, defineScriptedScene } from './scene/define-scene'
export { discoverScenes } from './scene/discover'
export { defineStage } from './stage/define-stage'
export { listProfiles, resolveProfile } from './stage/profiles'
export { terminalStage } from './terminal/stage'
