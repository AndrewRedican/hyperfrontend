/**
 * The `hooks` generator: installs the stubs Git runs for the hooks a workspace configures, and writes a first configuration where there is none.
 *
 * @module @hyperfrontend/workspace/generators/hooks
 */

export type { StubRequest } from './generator'
export type { HooksGeneratorOptions } from './options'
export { DEFAULT_HOOKS, hooksGenerator, hooksGenerator as default, stubDirectory, writeHooksSetup, writeStubs } from './generator'
