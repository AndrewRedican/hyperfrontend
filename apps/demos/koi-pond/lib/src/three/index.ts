/**
 * The koi's three.js adapter: everything that knows what a renderer is.
 *
 * Kept behind its own entry point so the rest of the pond — the host, the
 * contract, the simulation maths — never pulls a rendering engine into its
 * bundle. Import this only from something that is going to draw.
 *
 * @module @hyperfrontend/demo-koi-lib/three
 */
export type { KoiDebugFlags, KoiDebugLayer } from './debug.js'
export type { Koi, KoiCollisionChain, KoiDepthResponse, KoiMetrics } from './koi.js'
export type { KoiUniforms } from './materials.js'
export type { PondView, PondViewport } from './pond-view.js'
export type { KoiCameraFraming, KoiLightingPreset } from './scene.js'

export { NO_DEBUG, createKoiDebugLayer } from './debug.js'
export { toBufferGeometry } from './geometry.js'
export { createKoi } from './koi.js'
export { applyAppearance, createEyeMaterial, createFinMaterial, createKoiUniforms, createSkinMaterial } from './materials.js'
export { createPondRenderer, createPondView, sizePondRenderer } from './pond-view.js'
export { KOI_LIGHTING_PRESETS, PRODUCTION_FRAMING, createLighting, createProductionCamera, placeCamera } from './scene.js'
