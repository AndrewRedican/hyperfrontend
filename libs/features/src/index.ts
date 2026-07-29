/**
 * SDK, CLI, and dev server for building and embedding hyperfrontend micro-frontend features.
 *
 * @module @hyperfrontend/features
 */
export type { RequestHandler, RequestOptions } from './shared/request'
export type {
  ActionDescription,
  BackdropBehavior,
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
export { DisplayMode, defineConfig, defineDevConfig } from './shared/types'
