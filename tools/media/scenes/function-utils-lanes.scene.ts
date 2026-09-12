import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { chapter, sequenceStage } from '../src/sequence/stage'

/** The three calls every column makes, at the moments they are typed. */
const CALLS = [1_000, 2_700, 4_500] as const

/**
 * One call sequence, three wrappers, three different tapes.
 *
 * Every wrapper here changes what a call does without changing what it looks
 * like, so the only honest way to show them is to run the same thing through
 * each and print what came back. `send` returns its argument and throws while
 * `online` is false, and `online` is false for exactly the middle of three
 * calls. The first chapter puts the unwrapped call beside the run-once one;
 * the second puts the gated call beside the error-ignoring one. Two chapters
 * rather than four columns, because a column narrow enough to fit four across
 * a readme is a column that breaks the factory names in half.
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
 * the call-site names are the scene's own, because the package has no opinion
 * about what you wrap.
 */
export default defineScriptedScene({
  slug: 'function-utils-lanes',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 260,
  stage: sequenceStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 14_400, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    segments: [
      chapter(
        'Run it once, serve the cache after',
        panelStage,
        {
          heading: 'send(n) returns n, and throws while online is false: on the second call.',
          caption: 'The wrapper stored 1 on the first call and never called send again.',
          restMs: 1_200,
          panels: [
            {
              title: 'no wrapper',
              kind: 'code',
              rows: [
                { text: 'send(1)', atMs: CALLS[0], typeMs: 300 },
                { text: '1', atMs: CALLS[0] + 600, marker: '›', tone: 'success' },
                { text: '', atMs: CALLS[1] - 200 },
                { text: 'send(2)', atMs: CALLS[1], typeMs: 300 },
                { text: 'Error: offline', atMs: CALLS[1] + 650, marker: '›', tone: 'danger' },
                { text: '', atMs: CALLS[2] - 200 },
                { text: 'send(3)', atMs: CALLS[2], typeMs: 300, tone: 'muted', strike: true },
                { text: 'never runs', atMs: CALLS[2] + 650, marker: '›', tone: 'muted' },
                { text: '', atMs: 6_100 },
                { text: 'stopped at the throw', atMs: 6_100, tone: 'danger', emphasis: true },
              ],
            },
            {
              title: 'createRunOnceFunction(send)',
              kind: 'code',
              rows: [
                { text: 'runOnce(1)', atMs: CALLS[0], typeMs: 300 },
                { text: '1  ran', atMs: CALLS[0] + 700, marker: '›', tone: 'success' },
                { text: '', atMs: CALLS[1] - 200 },
                { text: 'runOnce(2)', atMs: CALLS[1], typeMs: 300 },
                { text: '1  cached', atMs: CALLS[1] + 800, marker: '›', tone: 'accent' },
                { text: '', atMs: CALLS[2] - 200 },
                { text: 'runOnce(3)', atMs: CALLS[2], typeMs: 300 },
                { text: '1  cached', atMs: CALLS[2] + 800, marker: '›', tone: 'accent' },
                { text: '', atMs: 6_100 },
                { text: 'never ran again', atMs: 6_250, tone: 'accent', emphasis: true },
              ],
            },
          ],
        },
        500
      ),
      chapter(
        'Gate a call, or swallow its throw',
        panelStage,
        {
          heading: 'The same three calls, and online is still false for the second.',
          caption: 'A shut gate returns undefined; the error-ignoring wrapper drops every value.',
          restMs: 1_200,
          panels: [
            {
              title: 'createConditionalExecutionFunction',
              kind: 'code',
              rows: [
                { text: '(send, () => online)', atMs: 200, typeMs: 340, tone: 'muted' },
                { text: 'conditional(1)', atMs: CALLS[0], typeMs: 320 },
                { text: '1  gate open', atMs: CALLS[0] + 750, marker: '›', tone: 'success' },
                { text: '', atMs: CALLS[1] - 200 },
                { text: 'conditional(2)', atMs: CALLS[1], typeMs: 320 },
                { text: 'undefined  gate shut', atMs: CALLS[1] + 850, marker: '›', tone: 'warning' },
                { text: '', atMs: CALLS[2] - 200 },
                { text: 'conditional(3)', atMs: CALLS[2], typeMs: 320 },
                { text: '3  gate open', atMs: CALLS[2] + 850, marker: '›', tone: 'success' },
                { text: 'skipped one, kept going', atMs: 6_300, tone: 'accent', emphasis: true },
              ],
            },
            {
              title: 'createErrorIgnoringFunction',
              kind: 'code',
              rows: [
                { text: '(send)', atMs: 200, typeMs: 200, tone: 'muted' },
                { text: 'errorIgnoring(1)', atMs: CALLS[0], typeMs: 320 },
                { text: 'undefined  ran', atMs: CALLS[0] + 850, marker: '›', tone: 'success' },
                { text: '', atMs: CALLS[1] - 200 },
                { text: 'errorIgnoring(2)', atMs: CALLS[1], typeMs: 320 },
                { text: 'undefined  swallowed', atMs: CALLS[1] + 950, marker: '›', tone: 'warning' },
                { text: '', atMs: CALLS[2] - 200 },
                { text: 'errorIgnoring(3)', atMs: CALLS[2], typeMs: 320 },
                { text: 'undefined  ran', atMs: CALLS[2] + 950, marker: '›', tone: 'success' },
                { text: 'carried on', atMs: 6_450, tone: 'success', emphasis: true },
              ],
            },
          ],
        }
      ),
    ],
  },
})
