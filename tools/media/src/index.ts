/**
 * Configuration-driven recorder turning browser sessions and scripted stages
 * into size-budgeted GIFs and stills, knowing nothing of the project it records
 * beyond the config it is handed.
 *
 * @module @hyperfrontend/media
 */
export type { ByteAnnotation, ByteConfig, ByteSegment, ByteTone } from './models/byte'
export type { Determinism, ReadyGate, RecordWindow, ServeSpec, Viewport } from './models/capture'
export type {
  BrowserConfig,
  EncoderConfig,
  MediaConfigInput,
  MediaDefaults,
  ResolvedMediaConfig,
  ResolvedRoots,
  VariantSpec,
} from './models/config'
export type { Dial, DialConfig, DialOverlay, DialState, DialStop, DialTone } from './models/dial'
export type { EncoderName, EncoderPreference, GifOptions, StillFormat, StillOptions } from './models/encode'
export type { FlowConfig, FlowEndpoint, FlowMessage, FlowSide, FlowTone } from './models/flow'
export type { GaugeConfig, GaugeGroup, GaugeStop, GaugeTone, GaugeTrack } from './models/gauge'
export type { LifecycleConfig, LifecyclePanel } from './models/lifecycle'
export type { Panel, PanelConfig, PanelKind, PanelRow, PanelTone } from './models/panel'
export type { MediaProfile, ProfileId, ProfileRef } from './models/profile'
export type { AssetSidecar, CheckOutcome, RunSummaryRow, VariantRecord } from './models/report'
export type { ScanConfig, ScanFile, ScanFinding, ScanTone } from './models/scan'
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
export type { ChapterFrame, RailPosition, SequenceConfig, SequencePlacement, SequenceSegment } from './models/sequence'
export type { Stage, StagedContent, StageInstant } from './models/stage'
export type { TerminalConfig, TerminalLine, TerminalSpan, TerminalStep, TerminalTone } from './models/terminal'
export type { MediaTheme, ThemeId, ThemeOverride, ThemeOverrides } from './models/theme'
export { byteStage } from './byte/stage'
export { defineConfig } from './config/define-config'
export { loadConfig } from './config/load-config'
export { dialStage } from './dial/stage'
export { flowStage } from './flow/stage'
export { gaugeStage } from './gauge/stage'
export { lifecycleStage } from './lifecycle/stage'
export { panelStage } from './panel/stage'
export { scanStage } from './scan/stage'
export { defineBrowserScene, defineScriptedScene } from './scene/define-scene'
export { discoverScenes } from './scene/discover'
export { chapter, sequenceStage } from './sequence/stage'
export { chaptersAt, placeSegments } from './sequence/timeline'
export { defineStage } from './stage/define-stage'
export { listProfiles, resolveProfile } from './stage/profiles'
export { terminalStage } from './terminal/stage'
export { resolveTheme } from './theme/resolve'
export { builtInTheme, listThemes } from './theme/themes'
