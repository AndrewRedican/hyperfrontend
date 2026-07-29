/**
 * Host-side SDK for embedding hyperfrontend features (shell factory, display modes, lifecycle).
 *
 * @module @hyperfrontend/features/host
 */
export type { PresentPayload, ViewportPayload } from '../shared/presentation'
export type { RequestHandler, RequestOptions } from '../shared/request'
export type {
  ActionDescription,
  BackdropBehavior,
  BoxPosition,
  DismissSource,
  FeatureContract,
  FeaturePermission,
  SandboxOptions,
  SecurityProtocol,
  ShellOptions,
  UnresponsiveInfo,
  UnresponsivePolicy,
} from '../shared/types'
export type { CreateShellOptions, DisplayModeMap } from './create-shell'
export type { HeartbeatState, HeartbeatStatus } from './heartbeat'
export type { ExperiencePlugin, ExperiencePluginContext } from './plugins'
export type { ViewportReporter } from './sizing'
export type { DisplayModeMount, MountContext, MountResult, ShellHandle } from './types'
export { DisplayMode } from '../shared/types'
export { createShell } from './create-shell'
export { mountDialog } from './display-modes/dialog'
export { mountEmbedded } from './display-modes/embedded'
export { mountPopup } from './display-modes/popup'
export { builtInDisplayModes } from './display-modes/registry'
export { mountStandalone } from './display-modes/standalone'
