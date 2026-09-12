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
 * Every string is real behaviour. The header and its dim hint, the `0 selected`
 * count, the `❯` pointer and `☐` / `☑` boxes, the filter query appended to the
 * message, the collapsed summary line and the `{ result, value }` shape are
 * what `multiselect` renders and returns; the choice list is the scene's own,
 * because the package has no opinion about what you ask.
 *
 * Verified against `libs/questions/src/prompts/multiselect.ts` (`buildLines`
 * writes the header with the searchable hint, then the selected count, then
 * one line per visible choice from `renderChoice`; the submitted frame is the
 * message followed by the joined labels), `libs/questions/src/render.ts` (the
 * glyphs) and `libs/questions/src/types.ts` (`MultiselectConfig.choices`,
 * `searchable`, and the `PromptOutcome` shapes, including `value: undefined` on
 * cancellation).
 */
export default defineScriptedScene({
  slug: 'questions-prompt',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 12,
  stage: panelStage,
  holdMs: 1_700,
  gif: { colours: 64, lossy: 70, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 6_700, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    heading: 'Ask a question. Get a value back, never an exception.',
    caption: 'A cancelled prompt is a result, not a throw: the caller branches instead of catching.',
    restMs: 1_500,
    panels: [
      {
        title: 'setup.mjs',
        kind: 'code',
        weight: 1.15,
        rows: [
          { text: 'const picked = await multiselect({', atMs: 200, typeMs: 520 },
          { text: "  message: 'Select features',", atMs: 780, typeMs: 380 },
          { text: '  searchable: true,', atMs: 1_200, typeMs: 260 },
          { text: '  choices: [', atMs: 1_500, typeMs: 170 },
          { text: "    { label: 'Playwright', value: 'e2e' },", atMs: 1_700, typeMs: 460 },
          { text: "    { label: 'Prettier', value: 'fmt' },", atMs: 2_220, typeMs: 420 },
          { text: "    { label: 'Vitest', value: 'unit' },", atMs: 2_700, typeMs: 400 },
          { text: '  ],', atMs: 3_160, typeMs: 100 },
          { text: '})', atMs: 3_300, typeMs: 100 },
          { text: "if (picked.result === 'cancelled') return", atMs: 8_700, typeMs: 640, tone: 'muted' },
          { text: 'scaffold(picked.value)', atMs: 9_420, typeMs: 400, emphasis: true },
        ],
      },
      {
        title: 'node setup.mjs',
        kind: 'result',
        chrome: true,
        weight: 0.85,
        rows: [
          { text: '? Select features (type to filter, space to toggle, enter to submit)', atMs: 3_800, untilMs: 5_200, tone: 'plain' },
          { text: '  0 selected', atMs: 3_800, untilMs: 5_200, tone: 'muted' },
          { text: '❯ ☐ Playwright', atMs: 3_800, untilMs: 5_200, tone: 'accent' },
          { text: '  ☐ Prettier', atMs: 3_800, untilMs: 5_200, tone: 'muted' },
          { text: '  ☐ Vitest', atMs: 3_800, untilMs: 5_200, tone: 'muted' },

          { text: '? Select features pl (type to filter)', atMs: 5_200, untilMs: 7_400, tone: 'plain' },
          { text: '  0 selected', atMs: 5_200, untilMs: 6_300, tone: 'muted' },
          { text: '❯ ☐ Playwright', atMs: 5_200, untilMs: 6_300, tone: 'accent' },

          { text: '  1 selected', atMs: 6_300, untilMs: 7_400, tone: 'muted' },
          { text: '❯ ☑ Playwright', atMs: 6_300, untilMs: 7_400, tone: 'success' },

          { text: '? Select features Playwright', atMs: 7_400, tone: 'success' },
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
