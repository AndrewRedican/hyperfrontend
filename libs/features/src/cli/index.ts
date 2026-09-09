/**
 * The `hf` command surface as a library: the argv dispatcher behind the bin,
 * the `init`, `build`, `dev` and `serve` runners, the tiered config loader, and
 * the build-config resolver.
 *
 * @module @hyperfrontend/features/cli
 */
export type { CliFlags, ParsedArgs } from './args'
export type { RunFeaturesCliOptions } from './bin'
export type { BuildDeps, BuildRunnerInput, RunBuildOptions } from './commands/build'
export type { DevDeps, RunDevOptions } from './commands/dev'
export type { InitDeps, RunInitOptions } from './commands/init'
export type { RunServeOptions, ServeDeps } from './commands/serve'
export type { ResolveBuildConfigOptions, ResolvedBuildBundle } from './config/resolve'
export { parseCliArgs } from './args'
export { runFeaturesCli } from './bin'
export { runBuild } from './commands/build'
export { runDev } from './commands/dev'
export { runInit } from './commands/init'
export { runServe } from './commands/serve'
export { discoverConfigFile, DEV_CONFIG_BASENAME, FEATURE_CONFIG_BASENAME, SERVE_CONFIG_BASENAME } from './config/discover'
export { loadModuleFile } from './config/load-module'
export { resolveBuildConfig } from './config/resolve'
export { EXIT_CANCELLED, EXIT_ERROR, EXIT_OK } from './exit-codes'
export { USAGE } from './usage'
