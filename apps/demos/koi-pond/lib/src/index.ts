/**
 * Everything the koi pond's ten projects agree on: the model, the contract,
 * the geometry, and the steering brain.
 *
 * Each of the eight fish apps renders the shoal in its own framework's idiom,
 * and that independence is what the pond exists to show. What lives here is
 * what every fish app must agree on to appear in one scene: the words, the
 * wire, the shape of a koi, the maths of the water, and the judgement each koi
 * swims by.
 *
 * @module @hyperfrontend/demo-koi-lib
 */
export type { KoiActionDescription, KoiContract } from './contract/koi-fish.contract.js'
export type { FeatureLink, KoiRuntime } from './contract/wire.js'
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
export type {
  KoiDecision,
  KoiDecisionCause,
  KoiDesire,
  KoiMotion,
  KoiMotionBand,
  KoiMotionInit,
  KoiMotionLimits,
  KoiMotionOptions,
  KoiMotionTrim,
  KoiState,
  KoiSteerContext,
} from './motion/koi-motion.js'
export type { KoiCrossing, KoiFlankField, KoiTurnTier, KoiTurnTierName, KoiTurnTierWindows, KoiTurnTiers } from './motion/manoeuvre.js'
export type { KoiFlight, KoiFlightAim, KoiFlightTerms } from './motion/predict.js'
export type { KoiRenderer, KoiRendererFactory } from './runtime/koi-renderer.js'
export type { KoiMotionFactory, KoiRuntimeInit } from './runtime/koi-runtime.js'
export type { DepthState } from './model/depth.js'
export type {
  Disturbance,
  KoiBuild,
  KoiCardLink,
  KoiCardPanel,
  KoiFramework,
  KoiIdentity,
  KoiIntent,
  KoiIntentKind,
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
export { wireKoiContract } from './contract/wire.js'

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
  encounterClearance,
  givesWay,
  headingAwayFrom,
  headingTo,
  resolveEncounter,
  turnToward,
  wanderOffset,
  wrapAngle,
} from './geometry/steering.js'
export { DEFAULT_MOTION_LIMITS, DEFAULT_MOTION_TRIM, createKoiMotion } from './motion/koi-motion.js'
export { chooseTurnTier, flankCrowding } from './motion/manoeuvre.js'
export { KOI_PATH_MAX_POINTS, predictFlight, stepFlight } from './motion/predict.js'
export { createKoiRuntime } from './runtime/koi-runtime.js'
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
export { koiBuild, koiPhenotype, koiProfile, koiSeed, koiTraits, koiTrim, koiVariantSeed } from './model/traits.js'
export { FRAMEWORK_SITES, KOI_FRAMEWORKS, KOI_POND_SOURCE_URL, koiSourceUrl } from './model/types.js'
export type { KoiCardDetails, KoiCardText, KoiMemoryState } from './model/card.js'
export { describeKoiCard } from './model/card.js'

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
