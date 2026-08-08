/**
 * Everything the koi pond's nine projects agree on: the model, the contract,
 * and the geometry.
 *
 * Deliberately not a simulation engine. Each of the seven fish apps composes
 * these primitives into its own swimming brain and its own renderer, in its own
 * framework's idiom — that independence is what the pond exists to show. What
 * lives here is only what all seven must agree on to appear in one scene: the
 * words, the wire, the shape of a koi, and the maths of the water.
 *
 * @module @hyperfrontend/demo-koi-lib
 */
export type { KoiActionDescription, KoiContract } from './contract/koi-fish.contract.js'
export type { BodyContour } from './geometry/body.js'
export type { Bounds } from './geometry/capsule.js'
export type { SpineState, SpineStep } from './geometry/spine.js'
export type { ClosestApproach, EncounterAction, EncounterResolution, EncounterSelf } from './geometry/steering.js'
export type { BoundaryPressure, PondBounds } from './geometry/virtual-pond.js'
export type { DepthState } from './model/depth.js'
export type {
  Disturbance,
  KoiBuild,
  KoiFramework,
  KoiIdentity,
  KoiOutline,
  KoiPalette,
  KoiPhase,
  KoiProfile,
  KoiTraits,
  NeighborObservation,
  PondEnvironment,
  Vec2,
} from './model/types.js'

export { KOI_CONTRACT_VERSION, koiFishContract } from './contract/koi-fish.contract.js'

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
} from './geometry/body.js'
export {
  boundsOverlap,
  chainBounds,
  chainGap,
  nearestSpinePoint,
  outlineContains,
  pointSegmentDistance,
  signedDistanceToChain,
} from './geometry/capsule.js'
export { SPINE_JOINTS, advanceSpine, createSpine, sampleSpine, spineGirth, widthProfile } from './geometry/spine.js'
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
} from './geometry/steering.js'
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
} from './geometry/virtual-pond.js'

export {
  DEPTH_COOLDOWN_MS,
  DEPTH_LEVELS,
  DEPTH_TRANSITION_MS,
  PASSING_SEPARATION,
  SURFACE_DEPTH,
  advanceDepth,
  beginDepthChange,
  canPass,
  depthBlur,
  depthFraction,
  depthOpacity,
  depthScale,
  depthZIndex,
  grantsDepth,
  mayRipple,
  renderedDepth,
  spreadDepths,
  startDepth,
} from './model/depth.js'
export { koiLabel, koiPalette } from './model/palette.js'
export { koiBuild, koiProfile, koiSeed, koiTraits } from './model/traits.js'
export { KOI_FRAMEWORKS } from './model/types.js'
