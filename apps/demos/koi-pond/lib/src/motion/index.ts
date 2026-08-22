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

export { DEFAULT_MOTION_LIMITS, DEFAULT_MOTION_TRIM, createKoiMotion } from './koi-motion.js'
