import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A widget rewrites the globals, and the code that read them first is unmoved.
 *
 * Every module under `built-in-copy/` reads its global exactly once, while it is being evaluated: `built-in-copy/object`
 * takes `globalThis.Object` and the two `Object.prototype` methods it wraps, `built-in-copy/json` takes `globalThis.JSON`.
 * What the importer gets back is the function value that was there at that moment, so a later write to `Object.keys`, to
 * `Object.prototype.hasOwnProperty` or to `JSON.parse` lands on the global and leaves the captured binding alone. The
 * frame is that difference and nothing else: two writes on the left, and on the right the same two questions asked
 * twice, once through the global and once through the copy. `raw` is the string `'{"role":"user"}'`, declared off
 * screen for room, and the package scope in the two import paths is elided for the same reason.
 *
 * The caption carries the part that matters most, because this is a mitigation rather than a defence. An ES module graph
 * evaluates in source order, so the copies here answer correctly only because the two `built-in-copy` imports sit above
 * `./vendor/analytics.js`. Move the widget above them and the capture happens after the tampering: run that way, the
 * captured `keys` returns `[]` too. That is the whole of what capturing at module initialization buys, and the whole of
 * what it does not.
 *
 * The right-hand column is composed as expression and value pairs rather than presented as a verbatim stdout, in the way
 * the other panel scenes in this directory are, but every value in it is real. The `hasOwnProperty` pair the package
 * also protects is left to the readme, because a third pair is one more than a readme-width frame holds.
 *
 * Verified against `libs/utils/immutable-api/src/built-in-copy/object/index.ts` (`const _Object = globalThis.Object` at
 * module scope, `keys` bound to `_Object.keys`, and `hasOwn` applying the captured `_hasOwnProperty` through
 * `Reflect.apply`), `libs/utils/immutable-api/src/built-in-copy/json/index.ts` (`const _JSON = globalThis.JSON`, and
 * `parse` bound to `_JSON.parse`), `libs/utils/immutable-api/package.json` (the two subpath entry points spelled out in
 * the imports) and `libs/utils/immutable-api/README.md` (that the copies are effective only when imported before
 * untrusted code runs). All six values in the right-hand column were then reproduced on node v24.18.0 by importing those
 * two source modules and applying exactly these three writes, in both orders.
 */
export default defineScriptedScene({
  slug: 'immutable-api-capture',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 288,
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 72, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 8_000, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    heading: 'A widget rewrites Object and JSON. Copies captured before it loaded still answer.',
    caption: 'Mitigation, not prevention: import order decides. Load the widget first and the copy captures the lie.',
    restMs: 1_400,
    panels: [
      {
        title: 'main.mjs',
        kind: 'code',
        weight: 1.2,
        rows: [
          { text: 'import { keys } from', atMs: 160, typeMs: 380 },
          { text: "  '…/immutable-api-utils/built-in-copy/object'", atMs: 580, typeMs: 640 },
          { text: 'import { parse } from', atMs: 1_280, typeMs: 380 },
          { text: "  '…/immutable-api-utils/built-in-copy/json'", atMs: 1_700, typeMs: 600 },
          { text: "import './vendor/analytics.js'", atMs: 2_360, typeMs: 420 },
          { text: '', atMs: 2_820 },
          { text: "const user = { id: 'u_17', role: 'guest' }", atMs: 2_860, typeMs: 520 },
          { text: '', atMs: 3_420 },
          { text: '// vendor/analytics.js, run by that import:', atMs: 3_460, typeMs: 520 },
          { text: 'Object.keys = () => []', atMs: 4_040, typeMs: 420 },
          { text: "JSON.parse = () => ({ role: 'admin' })", atMs: 4_520, typeMs: 600 },
        ],
      },
      {
        title: 'node main.mjs',
        kind: 'result',
        chrome: true,
        weight: 0.8,
        rows: [
          { text: 'Object.keys(user)', atMs: 5_500, tone: 'muted' },
          { text: '[]', atMs: 5_780, marker: '›', tone: 'danger' },
          { text: 'keys(user)', atMs: 6_100, tone: 'plain' },
          { text: "[ 'id', 'role' ]", atMs: 6_380, marker: '›', emphasis: true, tone: 'success' },
          { text: '', atMs: 6_560 },
          { text: "JSON.parse(raw).role", atMs: 6_640, tone: 'muted' },
          { text: "'admin'", atMs: 6_920, marker: '›', tone: 'danger' },
          { text: 'parse(raw).role', atMs: 7_240, tone: 'plain' },
          { text: "'user'", atMs: 7_520, marker: '›', emphasis: true, tone: 'success' },
        ],
      },
    ],
  },
})
