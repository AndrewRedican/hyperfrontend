import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * One call sequence, four wrappers, four different tapes.
 *
 * Every wrapper here changes what a call does without changing what it looks
 * like, so the only honest way to show them is to run the same thing through
 * all four and print what came back. `send` returns its argument and throws
 * while `online` is false, and `online` is false for exactly the middle of
 * three calls; the four columns are the four tapes that produces.
 *
 * The unwrapped column is the control: the first call returns 1, the second
 * throws, and the third never runs at all, because an uncaught throw ends the
 * script rather than the call. `createRunOnceFunction` never reaches the
 * failure; it stored 1 on the first call and hands that back for the other two
 * without calling `send` again, ignoring their arguments entirely.
 * `createConditionalExecutionFunction` re-reads its predicate on every call, so
 * the middle one is skipped and the third still runs and returns 3.
 * `createErrorIgnoringFunction` is the only column that meets the throw and
 * carries on.
 *
 * Two rows are worth reading twice, because a reader would guess both wrong. A
 * skipped conditional call returns `undefined`: the wrapper is declared
 * `ReturnType<T> | void` and falling off the end of it leaves a value the
 * caller can test. And the error-ignoring wrapper is constrained to void
 * functions and returns nothing of its own, so `undefined` is also what it
 * hands back on the two calls that succeeded; wrapping a function that returns
 * something is legal and quietly loses the something.
 *
 * The package README is wrong in two places this scene deliberately does not
 * follow: its CDN snippet destructures a `safeFunction` the package has never
 * exported, and its API table calls a skipped conditional call `void` where the
 * value is `undefined`.
 *
 * Verified against `libs/utils/function/src/index.ts` (the exported names),
 * `libs/utils/function/src/create-run-once-function.ts` (the stored result
 * returned before `func` is reached), `libs/utils/function/src/create-conditional-execution-function.ts`
 * (the no-argument predicate, called again on every invocation, and the
 * `ReturnType<T> | void` return) and `libs/utils/function/src/create-error-ignoring-function.ts`
 * (the bare `func(...args)` inside the `try`, which is what discards the
 * value). Every tape on screen was executed against those exact sources on Node
 * v24.18.0 on 2026-09-10: `send` gives 1 then `Error: offline`, run-once gives
 * 1, 1, 1 from a single underlying invocation, conditional gives 1, `undefined`
 * and 3, and error-ignoring gives `undefined` three times. `send`, `online` and
 * the four call-site names are the scene's own, because the package has no
 * opinion about what you wrap.
 */
export default defineScriptedScene({
  slug: 'function-utils-lanes',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 75, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 6_600, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'send returns n, and throws while online is false. Online is false for the second of these three calls.',
    caption: 'A shut gate returns undefined, and the error-ignoring wrapper is typed for void functions, so it drops every value.',
    restMs: 1_600,
    panels: [
      {
        title: 'send',
        kind: 'code',
        weight: 0.69,
        rows: [
          { text: 'no wrapper', atMs: 250, typeMs: 340, tone: 'muted' },
          { text: '', atMs: 1_100 },
          { text: 'send(1)', atMs: 1_100, typeMs: 320 },
          { text: '1', atMs: 1_750, marker: '›', tone: 'success' },
          { text: '', atMs: 2_900 },
          { text: 'send(2)', atMs: 2_900, typeMs: 320 },
          { text: 'throws', atMs: 3_600, marker: '›', tone: 'danger' },
          { text: '', atMs: 5_100 },
          { text: 'send(3)', atMs: 5_100, typeMs: 320, tone: 'muted', strike: true },
          { text: 'never runs', atMs: 5_800, marker: '›', tone: 'muted' },
          { text: '', atMs: 7_300 },
          { text: 'stopped here', atMs: 7_300, tone: 'danger', emphasis: true },
        ],
      },
      {
        title: 'createRunOnceFunction',
        kind: 'code',
        weight: 0.94,
        rows: [
          { text: '(send)', atMs: 250, typeMs: 340, tone: 'muted' },
          { text: '', atMs: 1_100 },
          { text: 'runOnce(1)', atMs: 1_100, typeMs: 320 },
          { text: '1  ran', atMs: 1_840, marker: '›', tone: 'success' },
          { text: '', atMs: 2_900 },
          { text: 'runOnce(2)', atMs: 2_900, typeMs: 320 },
          { text: '1  cached', atMs: 3_770, marker: '›', tone: 'accent' },
          { text: '', atMs: 5_100 },
          { text: 'runOnce(3)', atMs: 5_100, typeMs: 320 },
          { text: '1  cached', atMs: 5_970, marker: '›', tone: 'accent' },
          { text: '', atMs: 7_460 },
          { text: 'never ran again', atMs: 7_460, tone: 'accent', emphasis: true },
        ],
      },
      {
        title: 'createConditionalExecutionFunction',
        kind: 'code',
        weight: 1.3,
        rows: [
          { text: '(send, () => online)', atMs: 250, typeMs: 340, tone: 'muted' },
          { text: '', atMs: 1_100 },
          { text: 'conditional(1)', atMs: 1_100, typeMs: 320 },
          { text: '1  gate open', atMs: 1_930, marker: '›', tone: 'success' },
          { text: '', atMs: 2_900 },
          { text: 'conditional(2)', atMs: 2_900, typeMs: 320 },
          { text: 'undefined  gate shut', atMs: 3_940, marker: '›', tone: 'warning' },
          { text: '', atMs: 5_100 },
          { text: 'conditional(3)', atMs: 5_100, typeMs: 320 },
          { text: '3  gate open', atMs: 6_140, marker: '›', tone: 'success' },
          { text: '', atMs: 7_620 },
          { text: 'skipped one', atMs: 7_620, tone: 'accent', emphasis: true },
        ],
      },
      {
        title: 'createErrorIgnoringFunction',
        kind: 'code',
        weight: 1.07,
        rows: [
          { text: '(send)', atMs: 250, typeMs: 340, tone: 'muted' },
          { text: '', atMs: 1_100 },
          { text: 'errorIgnoring(1)', atMs: 1_100, typeMs: 320 },
          { text: 'undefined  ran', atMs: 2_020, marker: '›', tone: 'success' },
          { text: '', atMs: 2_900 },
          { text: 'errorIgnoring(2)', atMs: 2_900, typeMs: 320 },
          { text: 'undefined  swallowed', atMs: 4_110, marker: '›', tone: 'warning' },
          { text: '', atMs: 5_100 },
          { text: 'errorIgnoring(3)', atMs: 5_100, typeMs: 320 },
          { text: 'undefined  ran', atMs: 6_310, marker: '›', tone: 'success' },
          { text: '', atMs: 7_780 },
          { text: 'carried on', atMs: 7_780, tone: 'success', emphasis: true },
        ],
      },
    ],
  },
})
