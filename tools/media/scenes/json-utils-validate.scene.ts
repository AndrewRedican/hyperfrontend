import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * Four things wrong with one config, and the one call that finds all four.
 *
 * A validator that stops at the first failure turns a broken config into a
 * queue: fix the port, run it again, fix the URL, run it again. This one does
 * not, because `collectAllErrors` defaults to true. So the config on the left
 * breaks four different rules at once, and the column on the right is the
 * whole of what came back from a single `validate(config, schema)`: a message,
 * a keyword code and a JSON Pointer for each, in the order the engine pushed
 * them, which is every failing property first and `required` last.
 *
 * The fourth error is the one worth pausing on. `Missing required property` is
 * reported at `/` rather than at `/retries`, because `required` is checked
 * against the object that should have held the key, and a pointer can only
 * address something that is there. Three of the four violations are a line you
 * can see in the left column; the missing one is not, and the pointer says so.
 *
 * The caption carries the other half of this package's defensiveness. With
 * `safePatterns: true` a pattern goes through `checkPatternSafety` before
 * `RegExp` is ever constructed, so an unsafe one comes back as an error rather
 * than as an execution. Handing it a pattern that is both unsafe and
 * syntactically invalid returns the ReDoS refusal rather than the syntax
 * complaint, which is how you can tell the gate runs ahead of the compiler.
 *
 * Verified against `libs/utils/json/src/validate/validate.ts` (the entry point
 * and the `collectAllErrors ?? true` default), `libs/utils/json/src/validate/context.ts`
 * (`pushPath` escapes and builds the pointer, `addError` falls back to `/` at the root),
 * `libs/utils/json/src/validate/keywords/number-bounds.ts`, `libs/utils/json/src/validate/keywords/string-bounds.ts`,
 * `libs/utils/json/src/validate/keywords/type.ts` and `libs/utils/json/src/validate/keywords/properties.ts`
 * (the four messages and the `minimum`, `pattern`, `type` and `required` codes),
 * `libs/utils/json/src/types/validation.ts` (the `message`, `path` and `code` field names),
 * `libs/utils/json/src/validate/utils/pattern-safety.ts` (the nested-quantifier heuristic and its reason) and
 * `libs/utils/json/src/validate/validate.spec.ts` (the `safePatterns` and error-collection behaviour). Every
 * string in the right-hand column was then reproduced by running this exact schema and config through the source.
 */
export default defineScriptedScene({
  slug: 'json-utils-validate',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 72, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 9_300, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'One call over the whole object. Every rule it broke, with the pointer that found it.',
    caption: "safePatterns: true rejects '^(a+)+$' by inspection, before any regex is compiled.",
    restMs: 1_400,
    panels: [
      {
        title: 'check-config.mjs',
        kind: 'code',
        weight: 1.15,
        rows: [
          { text: 'const schema = {', atMs: 200, typeMs: 240 },
          { text: "  type: 'object',", atMs: 500, typeMs: 240 },
          { text: "  required: ['url', 'retries'],", atMs: 800, typeMs: 380 },
          { text: '  properties: {', atMs: 1_240, typeMs: 200 },
          { text: "    port: { type: 'integer', minimum: 1024 },", atMs: 1_500, typeMs: 540 },
          { text: "    url: { type: 'string', pattern: '^https://' },", atMs: 2_100, typeMs: 600 },
          { text: "    timeout: { type: 'integer' },", atMs: 2_760, typeMs: 400 },
          { text: '  },', atMs: 3_220, typeMs: 100 },
          { text: '}', atMs: 3_360, typeMs: 80 },
          { text: 'const config = {', atMs: 3_560, typeMs: 240 },
          { text: '  port: 80,', atMs: 3_860, typeMs: 160 },
          { text: "  url: 'http://shop.example.com',", atMs: 4_080, typeMs: 400 },
          { text: "  timeout: '5000',", atMs: 4_540, typeMs: 240 },
          { text: '}', atMs: 4_840, typeMs: 80 },
        ],
      },
      {
        title: 'node check-config.mjs',
        kind: 'result',
        chrome: true,
        rows: [
          { text: 'const { errors } = validate(config, schema)', atMs: 5_200, typeMs: 620, tone: 'accent' },
          { text: '', atMs: 5_940 },
          { text: 'path            code', atMs: 6_060, tone: 'muted' },

          { text: '/port           minimum', atMs: 6_320, tone: 'danger' },
          { text: '  Number must be at least 1024, got 80', atMs: 6_500, tone: 'plain' },

          { text: '/url            pattern', atMs: 6_900, tone: 'danger' },
          { text: '  String does not match pattern: ^https://', atMs: 7_080, tone: 'plain' },

          { text: '/timeout        type', atMs: 7_480, tone: 'danger' },
          { text: '  Expected type integer but got string', atMs: 7_660, tone: 'plain' },

          { text: '/               required', atMs: 8_060, tone: 'danger' },
          { text: '  Missing required property: retries', atMs: 8_240, tone: 'plain' },

          { text: '', atMs: 8_440 },
          { text: '4 errors · collectAllErrors: true', atMs: 8_620, marker: '›', emphasis: true, tone: 'accent' },
        ],
      },
    ],
  },
})
