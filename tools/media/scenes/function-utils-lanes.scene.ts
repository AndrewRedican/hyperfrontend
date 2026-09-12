import { lanesStage } from '../src/lanes/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('function-utils')

/**
 * Four lanes, the same three calls, four different fates.
 *
 * Every wrapper here changes what a call does without changing what it looks
 * like, so the frame runs the same thing through each and draws what
 * happens. `send` returns its argument and throws while `online` is false,
 * and `online` is false for exactly the middle of three calls. A token for
 * each call drops into every lane at the same moment; the switch in the
 * margin goes off before the second and comes back on before the third.
 *
 * The plain lane is the control: the first call returns 1, the second throws
 * and seals the lane, the third never runs. `createRunOnceFunction` stored 1
 * on the first call and never reaches `send` again: the later tokens ride
 * round the box and land as the stored 1. `createConditionalExecutionFunction`
 * re-reads its predicate on every call, so the gate turns the second token
 * back (the call returns `undefined`) and the third runs and returns 3.
 * `createErrorIgnoringFunction` is the only lane that meets the throw and
 * carries on, and it returns nothing of its own, so its tray collects checks
 * rather than values: the middle one slashed, for the throw it swallowed.
 *
 * Verified against `libs/utils/function/src/create-run-once-function.ts`
 * (the stored result returned before `func` is reached),
 * `create-conditional-execution-function.ts` (the predicate called again on
 * every invocation, and a skipped call falling off the end to `undefined`)
 * and `create-error-ignoring-function.ts` (the bare `func(...args)` inside
 * `try`, which is what discards the value) on 2026-09-12. `send` and `online`
 * are the scene's own, because the package has no opinion about what you wrap.
 */
export default defineScriptedScene({
  slug: 'function-utils-lanes',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: lanesStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 50, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 8_300, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    fn: 'send',
    toggle: 'online',
    lanes: [
      { kind: 'plain', name: 'send' },
      { kind: 'once', name: 'createRunOnce\nFunction' },
      { kind: 'gate', name: 'createConditional\nExecutionFunction' },
      { kind: 'shield', name: 'createError\nIgnoringFunction' },
    ],
    calls: [
      { atMs: 600, arg: '1' },
      { atMs: 3_300, arg: '2' },
      { atMs: 6_000, arg: '3' },
    ],
    offAtMs: 2_400,
    onAtMs: 5_400,
    restMs: 1_100,
  },
})
