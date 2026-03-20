export type { KnownPlatform, RepositoryPlatform } from './platform'
export type { RepositoryResolutionMode, RepositoryInferenceSource, RepositoryResolution } from './resolution'
export type { CompareUrlFormatter, RepositoryConfig, CreateRepositoryConfigOptions } from './repository-config'
export { isKnownPlatform, detectPlatformFromHostname, PLATFORM_HOSTNAMES } from './platform'
export { createRepositoryConfig, isRepositoryConfig } from './repository-config'
export {
  createDisabledResolution,
  createExplicitResolution,
  createInferredResolution,
  isRepositoryResolution,
  DEFAULT_INFERENCE_ORDER,
} from './resolution'
