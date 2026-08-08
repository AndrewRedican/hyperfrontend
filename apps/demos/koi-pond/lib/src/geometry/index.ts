/**
 * Koi geometry: the pond's coordinate space, the spine, the silhouette, the
 * proximity maths, and the steering verbs.
 *
 * @module @hyperfrontend/demo-koi-lib/geometry
 */
export type { BodyContour } from './body.js'
export type { Bounds } from './capsule.js'
export type { SpineState, SpineStep } from './spine.js'
export type { ClosestApproach, EncounterAction, EncounterResolution, EncounterSelf } from './steering.js'
export type { BoundaryPressure, PondBounds } from './virtual-pond.js'

export {
  CAUDAL_STATION,
  DORSAL_STATION,
  PECTORAL_STATION,
  bodyContour,
  caudalPath,
  contourPath,
  dorsalPath,
  jointAtStation,
  pectoralPath,
} from './body.js'
export {
  boundsOverlap,
  chainBounds,
  chainGap,
  nearestSpinePoint,
  outlineContains,
  pointSegmentDistance,
  signedDistanceToChain,
} from './capsule.js'
export { SPINE_JOINTS, advanceSpine, createSpine, sampleSpine, spineGirth, widthProfile } from './spine.js'
export {
  ENCOUNTER_CLEARANCE,
  ENCOUNTER_HORIZON_S,
  closestApproach,
  givesWay,
  headingAwayFrom,
  headingTo,
  resolveEncounter,
  turnToward,
  wanderOffset,
  wrapAngle,
} from './steering.js'
export {
  MARGIN_FISH_LENGTHS,
  boundaryPressure,
  describePond,
  entryStation,
  isVisible,
  nominalFishLength,
  pondBounds,
  pondPoint,
  rescalePoint,
} from './virtual-pond.js'
