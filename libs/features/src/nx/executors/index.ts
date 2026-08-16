/**
 * Nx executors entry point: the `build` and `serve` executors plus their
 * option shapes, for programmatic invocation and typed composition.
 *
 * @module @hyperfrontend/features/nx/executors
 */
export type { BuildExecutorSchema } from './build/executor'
export type { ServeExecutorSchema } from './serve/executor'
export { runBuildExecutor } from './build/executor'
export { serveExecutor } from './serve/executor'
