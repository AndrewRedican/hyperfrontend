/**
 * Legacy framework detection for AngularJS, Backbone, Ember, and jQuery.
 *
 * @module @hyperfrontend/project-scope/tech/legacy
 */
export type { LegacyFrameworkDetection, LegacyFrameworkDetector } from './types'
export { angularJSDetector } from './angularjs'
export { backboneDetector } from './backbone'
export { detectLegacyFrameworks, legacyDetectors } from './detect-all'
export { emberDetector } from './ember'
export { jqueryDetector } from './jquery'
