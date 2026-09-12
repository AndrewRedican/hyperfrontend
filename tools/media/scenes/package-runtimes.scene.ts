import type { MatrixCell, MatrixSupport } from '../src/models/matrix'
import type { MediaProfile } from '../src/models/profile'
import { matrixStage } from '../src/matrix/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'
import { publishableLibraries } from './lib/libraries'

/**
 * The strip a compatibility matrix is composed for: the width of a readme
 * column, at a height that holds one row of cells.
 */
const RUNTIMES_PROFILE: MediaProfile = {
  id: 'runtimes',
  intent: 'the compatibility section of a package readme, at the width npm and GitHub render it',
  width: 640,
  height: 150,
  scale: 2,
  fps: 1,
}

/** The runtimes every strip lists, in order, keyed as the project configuration keys them. */
const RUNTIMES: ReadonlyArray<[key: string, label: string, detail: string]> = [
  ['node', 'Node.js', 'server-side, CLI and build tooling'],
  ['browser', 'Browsers', 'evergreen, ES2022'],
  ['webWorker', 'Web Workers', 'off the main thread'],
]

/**
 * Read a support level off a project's declaration.
 *
 * @param declared - The level as the project configuration states it.
 * @returns The level, with anything unrecognised read as unsupported.
 */
function toSupport(declared: string | undefined): MatrixSupport {
  return declared === 'full' || declared === 'partial' ? declared : 'none'
}

/**
 * The Node.js detail line: the version floor the manifest declares.
 *
 * @param range - The `engines.node` range, such as `>=18.0.0`.
 * @param fallback - What to say when there is no floor.
 * @returns A short line.
 */
function nodeDetail(range: string | undefined, fallback: string): string {
  const floor = /^>=\s*(\d+)/.exec(range ?? '')
  return floor === null ? fallback : `${floor[1]} or later`
}

/**
 * One compatibility strip per publishable package, drawn from each
 * project's own declaration and manifest.
 *
 * The strip replaces the two-row support table in the distribution readme and
 * only there: the table stays in the source, where the documentation site and
 * GitHub read it as text.
 */
export default publishableLibraries().map((library) => {
  const environments = library.project.metadata?.compatibility?.environments ?? {}
  const cells: MatrixCell[] = RUNTIMES.map(([key, label, detail]) => {
    const support = toSupport(environments[key])
    const line = key === 'node' && support !== 'none' ? nodeDetail(library.manifest.engines?.['node'], detail) : detail
    return { label, detail: support === 'none' ? 'not a target' : line, support }
  })
  return defineScriptedScene({
    slug: `runtimes-${library.shortName}`,
    asset: 'runtimes',
    outputs: ['still'],
    profile: RUNTIMES_PROFILE,
    themes: ['portable'],
    hue: packageIdentity(library.manifest.name).hue,
    stage: matrixStage,
    stills: [{ name: 'runtimes', atMs: 0, format: 'png', quality: 90, maxBytes: 60_000 }],
    config: { heading: 'Runs in', cells },
  })
})
