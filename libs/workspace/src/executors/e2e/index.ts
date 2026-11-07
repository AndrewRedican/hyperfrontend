/**
 * The `e2e` executor: packs a library's build, installs the tarball into the e2e project that tests it, and runs that project's suites.
 *
 * @module @hyperfrontend/workspace/executors/e2e
 */

export type { E2eExecutorOptions, E2eFormat, E2eFormatEntry } from './options'
export { e2eExecutor, e2eExecutor as default, formatRun, libraryUnderTest, testingAliases } from './executor'
