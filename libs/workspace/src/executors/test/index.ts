/**
 * The `test` executor: runs a project's suites on Node's built-in test runner, in a process of its own that this entry also serves.
 *
 * @module @hyperfrontend/workspace/executors/test
 */

export type { TestExecutorOptions } from './options'
export { RUNNER_ENTRY, TESTING_PACKAGE, testExecutor, testExecutor as default } from './executor'
export { runTestsCli } from './runner'
