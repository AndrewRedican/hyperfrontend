/**
 * Hostee-side SDK for feature apps (feature initialization and lifecycle).
 *
 * @module @hyperfrontend/features/hostee
 */
export type { ViewportPayload } from '../shared/presentation'
export type { RequestHandler, RequestOptions } from '../shared/request'
export type { ActionDescription, DisplayMode, FeatureContract, FeatureOptions, SecurityProtocol } from '../shared/types'
export type { FeatureHandle } from './types'
export { createFeature } from './create-feature'
