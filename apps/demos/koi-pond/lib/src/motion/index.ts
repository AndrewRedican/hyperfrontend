/**
 * The koi steering brain: the judgement every koi swims by, and the trim,
 * limits, and hooks that shape it.
 *
 * @module @hyperfrontend/demo-koi-lib/motion
 */
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
} from './koi-motion.js'
export type { KoiCrossing, KoiFlankField, KoiTurnTier, KoiTurnTierName, KoiTurnTierWindows, KoiTurnTiers } from './manoeuvre.js'
export type { KoiFlight, KoiFlightAim, KoiFlightTerms } from './predict.js'

export { DEFAULT_MOTION_LIMITS, DEFAULT_MOTION_TRIM, createKoiMotion } from './koi-motion.js'
export { chooseTurnTier, flankCrowding } from './manoeuvre.js'
export { KOI_PATH_MAX_POINTS, predictFlight, stepFlight } from './predict.js'
