/**
 * The koi contract, importable on its own so a consumer that only needs the
 * protocol never pulls the geometry in behind it.
 *
 * @module @hyperfrontend/demo-koi-lib/contract
 */
export type { KoiActionDescription, KoiContract } from './koi-fish.contract.js'
export type { FeatureLink, KoiRuntime } from './wire.js'
export { KOI_CONTRACT_VERSION, koiFishContract } from './koi-fish.contract.js'
export { wireKoiContract } from './wire.js'
