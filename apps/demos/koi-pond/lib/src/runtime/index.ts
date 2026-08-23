/**
 * The loop a koi app runs: the brain, the renderer seam, and the frames, wire
 * traffic, and lifecycle between them.
 *
 * @module @hyperfrontend/demo-koi-lib/runtime
 */
export type { KoiRenderer, KoiRendererFactory } from './koi-renderer.js'
export type { KoiMotionFactory, KoiRuntimeInit } from './koi-runtime.js'

export { createKoiRuntime } from './koi-runtime.js'
