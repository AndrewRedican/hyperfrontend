/**
 * Programmatic entry point for the hyperfrontend features CLI (`init`, `build`, `dev`).
 *
 * Exposes the argv dispatcher consumed by the `hf` bin plus the individual
 * command runners, the tiered config loader, and the build-config resolver so
 * the surface can be driven in-process and unit-tested.
 *
 * @module @hyperfrontend/features/cli
 */
export type { CliFlags, ParsedArgs } from './args'
export type { RunFeaturesCliOptions } from './bin'
export type { BuildDeps, BuildRunnerInput, RunBuildOptions } from './commands/build'
export type { DevDeps, RunDevOptions } from './commands/dev'
export type { InitDeps, RunInitOptions } from './commands/init'
export type { ResolveBuildConfigOptions, ResolvedBuildBundle } from './config/resolve'
export { parseCliArgs } from './args'
export { runFeaturesCli } from './bin'
export { runBuild } from './commands/build'
export { runDev } from './commands/dev'
export { runInit } from './commands/init'
export { discoverConfigFile, DEV_CONFIG_BASENAME, FEATURE_CONFIG_BASENAME } from './config/discover'
export { loadModuleFile } from './config/load-module'
export { resolveBuildConfig } from './config/resolve'
export { EXIT_CANCELLED, EXIT_ERROR, EXIT_OK } from './exit-codes'
export { USAGE } from './usage'
