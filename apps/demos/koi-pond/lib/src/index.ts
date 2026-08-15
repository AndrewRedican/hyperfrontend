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
export type { KoiSection } from './koi3d/anatomy.js'
export type {
  KoiAppearance,
  KoiCaudalShape,
  KoiConfig,
  KoiConfigInput,
  KoiEyeShape,
  KoiFinShape,
  KoiHeadShape,
  KoiMotionInput,
  KoiPhysical,
  KoiResolution,
  KoiSwimTrim,
} from './koi3d/config.js'
export type { FinPart } from './koi3d/fin-mesh.js'
export type { MeshBounds, MeshBuilder, MeshData } from './koi3d/mesh-data.js'
export type { KoiPatch, KoiPatternData, KoiPatternName } from './koi3d/pattern.js'
export type { SpinePose, SpineStation, SwimParameters } from './koi3d/spine-pose.js'
export type { KoiSwimState } from './koi3d/swim-state.js'
export type { Bounds } from './geometry/capsule.js'
export type { SpineState, SpineStep } from './geometry/spine.js'
export type { Itinerary, PaceSchedule, WaypointLeg } from './geometry/behaviour.js'
export type { ClosestApproach, EncounterAction, EncounterMemory, EncounterResolution, EncounterSelf } from './geometry/steering.js'
export type { BoundaryPressure, KoiFrameBox, PondBounds } from './geometry/virtual-pond.js'
export type { DepthState } from './model/depth.js'
export type {
  Disturbance,
  KoiBuild,
  KoiFramework,
  KoiIdentity,
  KoiOutline,
  KoiPalette,
  KoiPhase,
  KoiPhenotype,
  KoiProfile,
  KoiTraits,
  NeighborObservation,
  PondEnvironment,
  PondWindow,
  Vec2,
} from './model/types.js'

export { KOI_CONTRACT_VERSION, koiFishContract } from './contract/koi-fish.contract.js'

export {
  boundsOverlap,
  chainBounds,
  chainGap,
  nearestSpinePoint,
  outlineContains,
  pointSegmentDistance,
  signedDistanceToChain,
} from './geometry/capsule.js'
export { SHORE_ABSENT_S, createItinerary, createPaceSchedule, slipsAway, wrapAcross } from './geometry/behaviour.js'
export { SPINE_JOINTS, advanceSpine, createSpine, sampleSpine, spineGirth, widthProfile } from './geometry/spine.js'
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
} from './geometry/steering.js'
export {
  MARGIN_FISH_LENGTHS,
  boundaryPressure,
  describePond,
  entryStation,
  isVisible,
  koiFrameBox,
  nominalFishLength,
  pondBounds,
  pondCentre,
  pondPoint,
  pondWindow,
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
  swimDepth,
} from './model/depth.js'
export { koiLabel, koiPalette } from './model/palette.js'
export type { PondViewSpec } from './model/pond-view.js'
export { POND_VIEW, pxPerUnit } from './model/pond-view.js'
export { koiBuild, koiPhenotype, koiProfile, koiSeed, koiTraits, koiTrim } from './model/traits.js'
export { KOI_FRAMEWORKS } from './model/types.js'

export { sampleSection, sectionPoint } from './koi3d/anatomy.js'
export { bodyRingCount, buildBodyMesh, eyeTheta, surfaceNormal, surfacePoint } from './koi3d/body-mesh.js'
export {
  CAUDAL_BLEND,
  CAUDAL_BLEND_HEIGHT,
  CAUDAL_ROOT,
  DEFAULT_APPEARANCE,
  DEFAULT_MOTION,
  DEFAULT_PHYSICAL,
  DEFAULT_RESOLUTION,
  DEFAULT_TRIM,
  PIVOT_STATION,
  resolveKoiConfig,
} from './koi3d/config.js'
export { FIN_PART, buildCaudalFin, buildFinSet, buildMembraneFin } from './koi3d/fin-mesh.js'
export { buildBarbels, buildEye, buildEyes } from './koi3d/head-mesh.js'
export { createMeshBuilder, finishMesh, mergeMeshes, meshBounds, meshTriangleCount, pushQuad, pushVertex } from './koi3d/mesh-data.js'
export { KOI_PATTERNS, MAX_PATCHES, buildPattern, packPatches } from './koi3d/pattern.js'
export { SPINE_SAMPLES, STILL_SWIM, evaluateSpine, sampleSpinePose } from './koi3d/spine-pose.js'
export { MOTION_PRESETS, createSwimState, targetSwim } from './koi3d/swim-state.js'
