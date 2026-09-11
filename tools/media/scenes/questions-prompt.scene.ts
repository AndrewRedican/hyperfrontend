import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A question, programmed on the left and answered on the right.
 *
 * The whole of what this package is for is that the thing you write and the
 * thing the reader of your CLI experiences are two very different objects, and
 * that the second one comes back to you as a value rather than as an exception.
 * So the frame shows both at once: `multiselect` typing itself out on the left
 * while the session it produces plays on the right, narrowing as two characters
 * are typed, collapsing to one line on Enter, and settling on the discriminated
 * union the calling code branches on.
 *
 * The right-hand column repaints rather than only filling, which is what the
 * row lifetimes are for: a prompt's option list is on screen while the question
 * is open and gone once it is answered, exactly as it is in a real terminal.
 *
 * Every string is real behaviour. The filter, the collapsed summary line and
 * the `{ result, value }` shape are what `multiselect` does; the option list is
 * the scene's own, because the package has no opinion about what you ask.
 */
export default defineScriptedScene({
  slug: 'questions-prompt',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_700,
  gif: { colours: 64, lossy: 70, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 6_700, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'Ask a question. Get a value back, never an exception.',
    caption: 'A cancelled prompt is a result, not a throw: the caller branches instead of catching.',
    restMs: 1_500,
    panels: [
      {
        title: 'setup.mjs',
        kind: 'code',
        weight: 1.08,
        rows: [
          { text: "import { multiselect } from '@hyperfrontend/questions'", atMs: 200, typeMs: 950 },
          { text: '', atMs: 1_200 },
          { text: 'const picked = await multiselect({', atMs: 1_250, typeMs: 460 },
          { text: "  message: 'Select features',", atMs: 1_740, typeMs: 380 },
          { text: '  options: [', atMs: 2_150, typeMs: 170 },
          { text: "    { label: 'Playwright', value: 'e2e' },", atMs: 2_340, typeMs: 400 },
          { text: "    { label: 'Prettier',   value: 'fmt' },", atMs: 2_760, typeMs: 370 },
          { text: "    { label: 'Vitest',     value: 'unit' },", atMs: 3_150, typeMs: 370 },
          { text: '  ],', atMs: 3_540, typeMs: 130 },
          { text: '})', atMs: 3_690, typeMs: 130 },
          { text: '', atMs: 3_850 },
          { text: "if (picked.result === 'cancelled') {", atMs: 8_700, typeMs: 620, tone: 'muted' },
          { text: '  return', atMs: 9_340, typeMs: 160, tone: 'muted' },
          { text: '}', atMs: 9_520, typeMs: 90, tone: 'muted' },
          { text: 'scaffold(picked.value)', atMs: 9_640, typeMs: 420, emphasis: true },
        ],
      },
      {
        title: 'node setup.mjs',
        kind: 'result',
        chrome: true,
        rows: [
          { text: '? Select features', atMs: 4_100, untilMs: 7_400, tone: 'plain' },
          { text: '  ◯ Playwright', atMs: 4_300, untilMs: 5_200, tone: 'muted' },
          { text: '  ◯ Prettier', atMs: 4_300, untilMs: 5_200, tone: 'muted' },
          { text: '  ◯ Vitest', atMs: 4_300, untilMs: 5_200, tone: 'muted' },
          { text: '  ↑↓ move · space toggle · enter accept', atMs: 4_600, untilMs: 5_200, tone: 'muted' },

          { text: '  ◯ Playwright', atMs: 5_200, untilMs: 6_300, marker: '❯', tone: 'plain' },
          { text: '  filter: pl', atMs: 5_200, untilMs: 7_400, tone: 'accent' },

          { text: '  ◉ Playwright', atMs: 6_300, untilMs: 7_400, marker: '❯', tone: 'success' },
          { text: '  1 selected · enter accept', atMs: 6_500, untilMs: 7_400, tone: 'muted' },

          { text: '? Select features: Playwright', atMs: 7_400, tone: 'success' },
          { text: '', atMs: 7_600 },
          { text: "{ result: 'submitted', value: [ 'e2e' ] }", atMs: 7_800, marker: '›', emphasis: true, tone: 'accent' },
          { text: '', atMs: 8_000 },
          { text: 'Ctrl+C would have given you', atMs: 8_800, tone: 'muted' },
          { text: "{ result: 'cancelled', value: undefined }", atMs: 9_100, marker: '›', tone: 'muted' },
        ],
      },
    ],
  },
})
