/**
 * SDK, CLI, and dev server for building and embedding hyperfrontend micro-frontend features.
 *
 * @module @hyperfrontend/features
 */
export type { AsyncIteratorExecutor, GeneratorCallback, PromiseExecutor, Tree } from './nx/model'
export type { EventHandler } from './shared/event-emitter'
export type { PresentPayload, ViewportPayload } from './shared/presentation'
export type { RequestHandler, RequestOptions } from './shared/request'
export type { ServeConfig, ServeHeaderRule } from './shared/serve-types'
export type {
  ActionDescription,
  BackdropBehavior,
  BoxPosition,
  DevAppConfig,
  DevConfig,
  DialogBoxConfig,
  DismissSource,
  DisplayConfig,
  ExperiencePlugin,
  ExperiencePluginContext,
  FeatureConfig,
  FeatureContract,
  FeatureDescriptor,
  FeatureOptions,
  FeaturePermission,
  FixedEmbedSize,
  PopupWindowConfig,
  ResolvedFeatureConfig,
  SandboxOptions,
  SecurityProtocol,
  ShellOptions,
  UnresponsiveInfo,
  UnresponsivePolicy,
} from './shared/types'
export { validateContract, validateFeatureConfig, validatePayload } from './shared/contract'
export { sdkInfo } from './shared/sdk-info'
export { defineServeConfig } from './shared/serve-types'
export { DisplayMode, defineConfig, defineDevConfig } from './shared/types'
