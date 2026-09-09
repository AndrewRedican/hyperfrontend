/**
 * Builds a feature's shell package from an Nx target, wrapping the headless
 * `hf build` and reporting a missing rollup native binding as the install
 * command that fixes it.
 *
 * @module @hyperfrontend/features/nx/executors/build
 */
export type { BuildExecutorSchema } from './executor'
export { default, runBuildExecutor } from './executor'
