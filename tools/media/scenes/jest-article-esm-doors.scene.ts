import { doorsStage } from '../src/doors/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * How a green ESM suite missed a broken ESM build, from "I Replaced Jest With
 * 1,200 Lines of Code".
 *
 * The Jest-era suites that claimed to test each package's ESM format wrote
 * `await import()`, and `ts-jest` compiled that to `require()`. The package's
 * `exports` map sent `require()` to the CommonJS build, which worked, so the
 * suites were green while the ES module build behind the `import` condition
 * never ran. Native ESM consumers were the only callers that reached it, and
 * it refused to load.
 */
export default defineScriptedScene({
  slug: 'jest-article-esm-doors',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(276),
  hue: identity.hue,
  stage: doorsStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 120_000 }],
  config: {
    suite: { caption: 'ESM suite', code: "await import('pkg')" },
    consumer: { caption: 'ESM consumer', code: "import { x } from 'pkg'" },
    transform: 'ts-jest',
    packageLabel: 'pkg "exports"',
    working: { condition: '"require"', file: 'index.cjs.js' },
    broken: { condition: '"import"', file: 'index.esm.js' },
  },
})
