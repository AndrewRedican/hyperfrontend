import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A widget rewrites the globals, and the code that read them first is unmoved.
 *
 * Every module under `built-in-copy/` reads its global exactly once, while it is being evaluated: `built-in-copy/object`
 * takes `globalThis.Object` and the two `Object.prototype` methods it wraps, `built-in-copy/json` takes `globalThis.JSON`.
 * What the importer gets back is the function value that was there at that moment, so a later write to `Object.keys`, to
 * `Object.prototype.hasOwnProperty` or to `JSON.parse` lands on the global and leaves the captured binding alone. The
 * frame is that difference and nothing else: three writes on the left, and on the right the same three questions asked
 * twice, once through the global and once through the copy.
 *
 * The caption carries the part that matters most, because this is a mitigation rather than a defence. An ES module graph
 * evaluates in source order, so the copies here answer correctly only because the two `built-in-copy` imports sit above
 * `./vendor/analytics.js`. Move the widget above them and the capture happens after the tampering: run that way, the
 * captured `keys` returns `[]` too. That is the whole of what capturing at module initialization buys, and the whole of
 * what it does not.
 *
 * The right-hand column is composed as expression and value pairs rather than presented as a verbatim stdout, in the way
 * the other panel scenes in this directory are, but every value in it is real.
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
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 72, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 9_900, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'One widget rewrites Object and JSON. The copies captured before it loaded still answer.',
    caption: 'Mitigation, not prevention: import order decides. Load the widget first and the copy captures the lie.',
    restMs: 1_400,
    panels: [
      {
        title: 'main.mjs',
        kind: 'code',
        weight: 1.3,
        rows: [
          { text: 'import { hasOwn, keys } from', atMs: 160, typeMs: 420 },
          { text: "  '@hyperfrontend/immutable-api-utils/built-in-copy/object'", atMs: 620, typeMs: 640 },
          { text: 'import { parse } from', atMs: 1_300, typeMs: 300 },
          { text: "  '@hyperfrontend/immutable-api-utils/built-in-copy/json'", atMs: 1_640, typeMs: 600 },
          { text: "import './vendor/analytics.js'", atMs: 2_280, typeMs: 400 },
          { text: '', atMs: 2_740 },
          { text: "const user = { id: 'u_17', role: 'guest' }", atMs: 2_780, typeMs: 480 },
          { text: 'const raw = \'{"role":"user"}\'', atMs: 3_300, typeMs: 360 },
          { text: '', atMs: 3_720 },
          { text: '// vendor/analytics.js, evaluated by that import:', atMs: 3_760, typeMs: 520 },
          { text: 'globalThis.Object.keys = () => []', atMs: 4_360, typeMs: 520 },
          { text: 'Object.prototype.hasOwnProperty = () => true', atMs: 4_940, typeMs: 620 },
          { text: "globalThis.JSON.parse = () => ({ role: 'admin' })", atMs: 5_620, typeMs: 660 },
        ],
      },
      {
        title: 'node main.mjs',
        kind: 'result',
        chrome: true,
        weight: 0.7,
        rows: [
          { text: 'Object.keys(user)', atMs: 6_400, tone: 'muted' },
          { text: '[]', atMs: 6_680, marker: '›', tone: 'danger' },
          { text: 'keys(user)', atMs: 7_000, tone: 'plain' },
          { text: "[ 'id', 'role' ]", atMs: 7_280, marker: '›', emphasis: true, tone: 'success' },

          { text: '', atMs: 7_460 },
          { text: "user.hasOwnProperty('admin')", atMs: 7_540, tone: 'muted' },
          { text: 'true', atMs: 7_820, marker: '›', tone: 'danger' },
          { text: "hasOwn(user, 'admin')", atMs: 8_140, tone: 'plain' },
          { text: 'false', atMs: 8_420, marker: '›', emphasis: true, tone: 'success' },

          { text: '', atMs: 8_600 },
          { text: 'JSON.parse(raw).role', atMs: 8_680, tone: 'muted' },
          { text: "'admin'", atMs: 8_960, marker: '›', tone: 'danger' },
          { text: 'parse(raw).role', atMs: 9_280, tone: 'plain' },
          { text: "'user'", atMs: 9_560, marker: '›', emphasis: true, tone: 'success' },
        ],
      },
    ],
  },
})
