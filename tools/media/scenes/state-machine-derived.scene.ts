import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * The same `start()` three times, landing somewhere different each time.
 *
 * This package models one thing: the lifecycle of an async operation, out of
 * four booleans. The argument for it is not that four booleans are cheaper than
 * a state chart, it is that `isLoading` is one boolean and there are three
 * different reasons a screen can be loading. So the frame dispatches the five
 * actions that separate them and repaints the store beside the code: `start`,
 * `fail`, `start`, `success`, `start`.
 *
 * The reason it works is the reducer's `START` handler, which spreads the
 * previous state and sets `inProgress` alone. It does not clear `fail`, so the
 * second `start()` arrives on `{ inProgress: true, fail: true }` and `retrying`
 * is true; it does not clear `success` either, so the third arrives on
 * `{ inProgress: true, success: true }` and `restarting` is true, which is the
 * state a table is in while it refreshes with the old rows still up. `SUCCESS`
 * and `FAIL` do clear each other, which is why the two failure flags never
 * stack. Each repaint names every selector that is true, `inProgress` included,
 * because `inProgress` is true at all three of those moments and saying so is
 * the whole point of the caption.
 *
 * `halt` is drawn and never moves. That is deliberate: the two selectors it
 * gates, `paused` and `cancelled`, are reachable, but ARCHITECTURE.md's
 * transition table also claims a `paused` row that `START` resumes, and the
 * reducer does no such thing (it never clears `halt`, so a paused store that is
 * started again is still paused). Showing a transition the implementation does
 * not perform would have been the one dishonest frame in the scene.
 *
 * Verified against `libs/state-machine/src/reducer/reducer.ts` (the `START`
 * spread, and `SUCCESS`/`FAIL` clearing one another),
 * `libs/state-machine/src/state/state.ts` (the initial state is four falses),
 * `libs/state-machine/src/selectors/selectors.ts` (`retrying` is
 * `inProgress && !success && fail`, `restarting` is
 * `inProgress && success && !fail`, `done` is `!inProgress && (success || fail)`,
 * and `notStarted` ignores `halt`), `libs/state-machine/src/models/index.ts`
 * (the four flag names), `libs/state-machine/src/store/store.ts` (`Store`
 * carries `dispatch`, `getState` and `subscribe`, and starts from the reducer's
 * own initial state), `libs/state-machine/src/actions/actions.ts` (`fail` takes
 * an error, the rest take an optional payload) and
 * `libs/state-machine/src/index.ts` (every name used on the left is exported
 * from the root entry; the import itself is left off screen for room). The flag combinations behind `retrying` and
 * `restarting` are asserted in `selectors.spec.ts`, and the per-action results
 * in `reducer.spec.ts`.
 */
export default defineScriptedScene({
  slug: 'state-machine-derived',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 172,
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 75, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 8_200, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    heading: 'The same start() dispatched three times lands in three different states.',
    caption: 'A lone isLoading is true at three of those five, and says the same thing at each one.',
    restMs: 1_400,
    panels: [
      {
        title: '@hyperfrontend/state-machine',
        kind: 'code',
        weight: 1.05,
        rows: [
          { text: 'const store = new Store()', atMs: 200, typeMs: 380 },
          { text: 'store.subscribe((state) => {', atMs: 640, typeMs: 340 },
          { text: '  render(derivedState(state))', atMs: 1_000, typeMs: 340 },
          { text: '})', atMs: 1_360, typeMs: 90 },
          { text: '', atMs: 1_500 },
          { text: 'store.dispatch(start())', atMs: 3_400, typeMs: 380 },
          { text: "store.dispatch(fail(Error('offline')))", atMs: 4_900, typeMs: 640 },
          { text: 'store.dispatch(start())', atMs: 6_300, typeMs: 380 },
          { text: 'store.dispatch(success(rows))', atMs: 7_600, typeMs: 440 },
          { text: 'store.dispatch(start())', atMs: 8_950, typeMs: 380 },
        ],
      },
      {
        title: 'state → derivedState',
        kind: 'result',
        weight: 0.95,
        rows: [
          { text: 'inProgress   false', atMs: 2_900, untilMs: 4_050, tone: 'muted' },
          { text: 'success      false', atMs: 2_900, untilMs: 4_050, tone: 'muted' },
          { text: 'fail         false', atMs: 2_900, untilMs: 4_050, tone: 'muted' },
          { text: 'halt         false', atMs: 2_900, untilMs: 4_050, tone: 'muted' },
          { text: '', atMs: 2_900, untilMs: 4_050 },
          { text: 'notStarted', atMs: 2_900, untilMs: 4_050, marker: '›', tone: 'accent' },

          { text: 'inProgress   true', atMs: 4_050, untilMs: 5_700, tone: 'plain' },
          { text: 'success      false', atMs: 4_050, untilMs: 5_700, tone: 'muted' },
          { text: 'fail         false', atMs: 4_050, untilMs: 5_700, tone: 'muted' },
          { text: 'halt         false', atMs: 4_050, untilMs: 5_700, tone: 'muted' },
          { text: '', atMs: 4_050, untilMs: 5_700 },
          { text: 'inProgress', atMs: 4_050, untilMs: 5_700, marker: '›', tone: 'accent' },

          { text: 'inProgress   false', atMs: 5_700, untilMs: 6_950, tone: 'muted' },
          { text: 'success      false', atMs: 5_700, untilMs: 6_950, tone: 'muted' },
          { text: 'fail         true', atMs: 5_700, untilMs: 6_950, tone: 'danger' },
          { text: 'halt         false', atMs: 5_700, untilMs: 6_950, tone: 'muted' },
          { text: '', atMs: 5_700, untilMs: 6_950 },
          { text: 'done', atMs: 5_700, untilMs: 6_950, marker: '›', tone: 'muted' },
          { text: 'failed', atMs: 5_700, untilMs: 6_950, marker: '›', tone: 'danger' },

          { text: 'inProgress   true', atMs: 6_950, untilMs: 8_350, tone: 'plain' },
          { text: 'success      false', atMs: 6_950, untilMs: 8_350, tone: 'muted' },
          { text: 'fail         true  ← START kept it', atMs: 6_950, untilMs: 8_350, tone: 'danger' },
          { text: 'halt         false', atMs: 6_950, untilMs: 8_350, tone: 'muted' },
          { text: '', atMs: 6_950, untilMs: 8_350 },
          { text: 'inProgress', atMs: 6_950, untilMs: 8_350, marker: '›', tone: 'muted' },
          { text: 'retrying', atMs: 6_950, untilMs: 8_350, marker: '›', tone: 'accent', emphasis: true },
          { text: '  a retry, not a first attempt', atMs: 6_950, untilMs: 8_350, tone: 'muted' },

          { text: 'inProgress   false', atMs: 8_350, untilMs: 9_500, tone: 'muted' },
          { text: 'success      true', atMs: 8_350, untilMs: 9_500, tone: 'success' },
          { text: 'fail         false', atMs: 8_350, untilMs: 9_500, tone: 'muted' },
          { text: 'halt         false', atMs: 8_350, untilMs: 9_500, tone: 'muted' },
          { text: '', atMs: 8_350, untilMs: 9_500 },
          { text: 'done', atMs: 8_350, untilMs: 9_500, marker: '›', tone: 'muted' },
          { text: 'successful', atMs: 8_350, untilMs: 9_500, marker: '›', tone: 'success' },

          { text: 'inProgress   true', atMs: 9_500, tone: 'plain' },
          { text: 'success      true  ← START kept it', atMs: 9_500, tone: 'success' },
          { text: 'fail         false', atMs: 9_500, tone: 'muted' },
          { text: 'halt         false', atMs: 9_500, tone: 'muted' },
          { text: '', atMs: 9_500 },
          { text: 'inProgress', atMs: 9_500, marker: '›', tone: 'muted' },
          { text: 'restarting', atMs: 9_500, marker: '›', tone: 'accent', emphasis: true },
          { text: '  a refresh, not a first load', atMs: 9_500, tone: 'muted' },
        ],
      },
    ],
  },
})
