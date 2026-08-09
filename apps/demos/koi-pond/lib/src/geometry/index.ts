/**
 * Koi geometry: the pond's coordinate space, the spine, the proximity maths,
 * and the steering verbs.
 *
 * @module @hyperfrontend/demo-koi-lib/geometry
 */
export type { Bounds } from './capsule.js'
export type { SpineState, SpineStep } from './spine.js'
export type { ClosestApproach, EncounterAction, EncounterMemory, EncounterResolution, EncounterSelf } from './steering.js'
export type { BoundaryPressure, PondBounds } from './virtual-pond.js'

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
  createEncounterMemory,
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
  pondCentre,
  pondPoint,
  pondWindow,
} from './virtual-pond.js'
