/**
 * The `typecheck` executor: runs the TypeScript compiler over a project's library and spec configurations without emitting files.
 *
 * @module @hyperfrontend/workspace/executors/typecheck
 */

export type { TypecheckExecutorOptions } from './options'
export { typecheckExecutor, typecheckExecutor as default } from './executor'
