/**
 * Runs the development servers from an Nx target: a long-running executor
 * wrapping the headless `hf dev`, alive until a shutdown signal and closing
 * gracefully on it.
 *
 * @module @hyperfrontend/features/nx/executors/serve
 */
export type { ServeExecutorSchema } from './executor'
export { default, serveExecutor } from './executor'
