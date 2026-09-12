import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * Three things wrong with one config, and the one call that finds all three.
 *
 * A validator that stops at the first failure turns a broken config into a
 * queue: fix the port, run it again, fix the URL, run it again. This one does
 * not, because `collectAllErrors` defaults to true. So the config on the left
 * breaks three different rules at once, and the column on the right is the
 * whole of what came back from a single `validate(config, schema)`: a message,
 * a keyword code and a JSON Pointer for each, in the order the engine pushed
 * them, which is every failing property first and `required` last. The
 * readme's `pattern` case is left out of the frame for room; it reports the
 * same way.
 *
 * The third error is the one worth pausing on. `Missing required property` is
 * reported at `/` rather than at `/retries`, because `required` is checked
 * against the object that should have held the key, and a pointer can only
 * address something that is there. Two of the three violations are a line you
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
  profile: 'compact',
  hue: 210,
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 72, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 7_500, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    restMs: 1_400,
    panels: [
      {
        title: 'check-config.mjs',
        kind: 'code',
        weight: 0.95,
        rows: [
          { text: 'const schema = {', atMs: 200, typeMs: 240 },
          { text: "  required: ['url', 'retries'],", atMs: 500, typeMs: 380, emphasisAtMs: 6_220 },
          { text: '  properties: {', atMs: 940, typeMs: 200 },
          { text: '    port: { minimum: 1024 },', atMs: 1_200, typeMs: 420 },
          { text: "    timeout: { type: 'integer' },", atMs: 1_680, typeMs: 420 },
          { text: '  },', atMs: 2_160, typeMs: 100 },
          { text: '}', atMs: 2_300, typeMs: 80 },
          { text: 'const config = {', atMs: 2_500, typeMs: 240 },
          { text: "  port: 80, url: 'https://shop.io',", atMs: 2_800, typeMs: 440, emphasisAtMs: 5_060 },
          { text: "  timeout: '5000',", atMs: 3_300, typeMs: 240, emphasisAtMs: 5_640 },
          { text: '}', atMs: 3_600, typeMs: 80 },
        ],
      },
      {
        title: 'node check-config.mjs',
        kind: 'result',
        chrome: true,
        weight: 1.05,
        rows: [
          { text: 'validate(config, schema).errors', atMs: 4_000, typeMs: 560, tone: 'accent' },
          { text: 'path        code', atMs: 4_800, tone: 'muted' },
          { text: '/port       minimum', atMs: 5_060, tone: 'danger' },
          { text: '  Number must be at least 1024, got 80', atMs: 5_240, tone: 'plain' },
          { text: '/timeout    type', atMs: 5_640, tone: 'danger' },
          { text: '  Expected type integer but got string', atMs: 5_820, tone: 'plain' },
          { text: '/           required', atMs: 6_220, tone: 'danger' },
          { text: '  Missing required property: retries', atMs: 6_400, tone: 'plain' },
          { text: '', atMs: 6_600 },
          { text: '3 errors · collectAllErrors: true', atMs: 6_780, marker: '›', emphasis: true, tone: 'accent' },
        ],
      },
    ],
  },
})
