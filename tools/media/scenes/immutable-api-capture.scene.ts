import { defineScriptedScene } from '../src/scene/define-scene'
import { vaultStage } from '../src/vault/stage'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('immutable-api-utils')

/**
 * A snapshot taken before the intruder.
 *
 * Every module under `built-in-copy/` reads its global once, while it is being
 * evaluated, and exports the function value that was there at that moment. So
 * the frame is a shelf of globals, a vault, and a third-party script: at
 * start-up a copy of each built-in falls off the shelf into the vault and the
 * lid locks; the script then walks in and rewrites the shelf; and each
 * question, asked of the shelf and then of the vault, is answered wrongly by
 * the shelf and correctly by the vault. The copies were photographed before
 * the intruder arrived, which is the whole of what capturing at module
 * initialisation buys.
 *
 * Verified against `libs/utils/immutable-api/src/built-in-copy/object/index.ts`
 * (`const _Object = globalThis.Object` at module scope, `keys` bound to
 * `_Object.keys`) and `libs/utils/immutable-api/src/built-in-copy/json/index.ts`
 * (`const _JSON = globalThis.JSON`, `parse` bound to `_JSON.parse`) on
 * 2026-09-12. The four answers were reproduced on node v24.18.0 by importing
 * those two source modules, then writing `Object.keys = () => []` and
 * `JSON.parse = () => ({ role: 'admin' })`: `Object.keys(user)` gives `[]` and
 * `keys(user)` gives `[ 'id', 'role' ]`; `JSON.parse(raw).role` gives `'admin'`
 * and `parse(raw).role` gives `'guest'`, with `raw` the string
 * `JSON.stringify(user)` so that every answer in the frame is about the one
 * value the asker shows.
 */
export default defineScriptedScene({
  slug: 'immutable-api-capture',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: vaultStage,
  holdMs: 1_800,
  gif: { colours: 128, lossy: 60, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 12_900, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    shelf: 'globalThis',
    intruder: 'analytics.js',
    value: "{ id: 'u_17', role: 'guest' }",
    restMs: 700,
    pairs: [
      {
        global: 'Object.keys',
        copy: 'keys',
        subpath: 'built-in-copy/object',
        replacement: '() => []',
        shelfAnswer: '[]',
        vaultAnswer: "[ 'id', 'role' ]",
      },
      {
        global: 'JSON.parse',
        copy: 'parse',
        subpath: 'built-in-copy/json',
        replacement: "() => 'admin'",
        shelfAnswer: "'admin'",
        vaultAnswer: "'guest'",
      },
    ],
  },
})
