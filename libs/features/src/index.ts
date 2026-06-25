/**
 * Vendor-agnostic SDK, CLI, and dev server for building and embedding hyperfrontend micro-frontend features.
 *
 * @module @hyperfrontend/features
 */
export type {
  ActionDescription,
  DevConfig,
  DisplayDefaults,
  EmbedSizing,
  FeatureConfig,
  FeatureContract,
  FeatureOptions,
  ResolvedFeatureConfig,
  SecurityProtocol,
  ShellOptions,
  UnresponsiveInfo,
  UnresponsivePolicy,
} from './shared/types'
export { validateContract, validateFeatureConfig, validatePayload } from './shared/contract'
export { sdkInfo } from './shared/sdk-info'
export { DisplayMode, defineConfig, defineDevConfig } from './shared/types'
